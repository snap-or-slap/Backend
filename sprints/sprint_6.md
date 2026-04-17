# Sprint 6 — Cron Jobs & Automated Game Logic

## Sprint Goal

Xây dựng toàn bộ tự động hóa phía server: cron jobs trừ tim, chuyển trạng thái challenge, xử lý game over / completion, và snapshot stats. Sau sprint này challenge tự vận hành Formation → Active → End mà không cần thủ công.

**Screens covered:** Logic nền của D-01 (Active tab), D-02 (Formation tab), K-03 (Squad Alert)

**Duration:** 1 tuần

**Depends on:** Sprint 4, Sprint 5

---

## Task 1 — Cron Infrastructure Setup

**Mô tả:** Tạo endpoint `/api/crons/[jobName]` được Railway Cron gọi theo lịch, bảo vệ bằng `CRON_SECRET` header. Mỗi job là function độc lập, idempotent.

**Architecture:**

- Railway Cron → HTTP POST `/api/crons/{jobName}` mỗi phút
- Endpoint verify `Authorization: Bearer CRON_SECRET`
- Mỗi job log start/end/error ra stdout

**TDD:**

```text
- Test: không có CRON_SECRET header → 401
- Test: sai CRON_SECRET → 401
- Test: đúng secret → 200, job chạy
- Test: gọi 2 lần đồng thời → idempotent, không double-process
```

**Done when:**

- `src/app/api/crons/[jobName]/route.ts` hoạt động
- `CRON_SECRET` env var set trên Railway
- Chạy lại 2 lần không gây side effect kép

---

## Task 2 — Cron: Formation → Active Transition

**Mô tả:** Chạy mỗi phút. Kiểm tra challenges `formation` có `start_at <= NOW()`, đủ member → chuyển `active`, thiếu member → `cancelled`.

**Logic:**

```text
SELECT * FROM challenges WHERE status = 'formation' AND start_at <= NOW()

Với mỗi challenge:
  IF accepted_count >= 2:
    UPDATE status = 'active'
    Tạo notification 'challenge_start' cho mỗi member
  ELSE:
    UPDATE status = 'cancelled', end_reason = 'host_cancelled'
    Tạo notification cho mỗi member
```

**TDD:**

```text
- Test: start_at 5 phút trước, 3 accepted members → status = 'active'
- Test: start_at 5 phút trước, 1 member → status = 'cancelled'
- Test: start_at 5 phút sau → bỏ qua
- Test: challenge đã active → bỏ qua (idempotent)
- Test: chạy cron 2 lần → không xử lý lại challenge đã chuyển trạng thái
```

**Done when:**

- DB transaction: cron chạy đồng thời với user join không gây race condition
- Log: `[CRON] formation-to-active: processed N challenges`

---

## Task 3 — Cron: Daily Heart Deduction

**Mô tả:** Job phức tạp nhất. Chạy mỗi phút, xử lý challenge có `reset_time` vừa qua trong cửa sổ 2 phút. Xác định ai miss check-in → trừ tim → kiểm tra game over / completion.

**Logic:**

```text
SELECT * FROM challenges
WHERE status = 'active'
  AND last_processed_cycle < current_cycle_number
  AND reset_time trong cửa sổ [NOW()-2min, NOW()]

Với mỗi challenge:
  1. SET last_processed_cycle = current_cycle (optimistic lock)
  2. missed_members = members chưa có checkin trong cycle này
  3. IF missed_members > 0: hearts_left -= 1
  4. IF hearts_left <= 0: status = 'failed', end_reason = 'out_of_hearts'
  5. ELSE: current_step += 1
  6. IF current_step >= duration_days: status = 'completed'
  7. Tạo notifications cho tất cả member
```

**TDD:**

```text
- Test: 3/4 member check-in → 1 miss → trừ 1 tim
- Test: 0/4 member check-in → trừ 1 tim (max 1 tim/chu kỳ)
- Test: hearts_left = 1, có miss → hearts_left = 0 → status = 'failed'
- Test: current_step = duration_days - 1, không miss → status = 'completed'
- Test: cron chạy 2 lần cùng cycle → không trừ tim 2 lần (last_processed_cycle guard)
- Test: challenge đã failed/completed → skip
```

**Done when:**

- `last_processed_cycle` set TRƯỚC khi xử lý (tránh race condition)
- DB transaction: update hearts + tạo notifications + update step là atomic
- Log: `[CRON] heart-deduction: challenge {id} -1 heart, {N} left`

---

## Task 4 — Cron: Auto-cancel Underpopulated Formation

**Mô tả:** Gộp trong Task 2 nhưng tách test coverage riêng. Hủy challenge formation có `start_at` đã qua nhưng < 2 accepted members.

**TDD:**

```text
- Test: formation, start_at - 10 phút, 1 member → cancelled
- Test: formation, start_at - 1 phút, 1 member → chưa xử lý (grace period)
- Test: formation, start_at passed, 2 members → active
```

**Done when:**

- Notification: "Your challenge 'X' was cancelled because not enough members joined."

---

## Task 5 — Challenge Completion Snapshot

**Mô tả:** Khi challenge chuyển `completed` hoặc `failed`, tạo snapshot `final_stats` JSONB để màn hình History đọc nhanh — không tính lại từ raw data.

**Logic:**

```text
ON status → completed/failed:
  final_stats = {
    total_checkins,
    member_stats: [{ user_id, checkin_count, completion_rate }],
    top_performer_id,
    hearts_remaining,
    actual_steps_completed,
    danger_zones: [cycle_numbers mất tim]
  }

  UPDATE challenges SET final_stats = final_stats
  recalculateUserStats(user_id) cho tất cả member
  checkBadges(user_id) cho tất cả member
```

**TDD:**

```text
- Test: completion_rate per member = checkins / total_steps * 100
- Test: top_performer là người completion_rate cao nhất
- Test: final_stats lưu vào challenges.final_stats JSONB
- Test: user_stats được cập nhật cho tất cả member
- Test: badge check được gọi sau snapshot
```

**Done when:**

- `final_stats` đủ để History screen không cần thêm query
- `challenges_count` và `success_rate` trong user_stats cập nhật đúng

---

## Task 6 — POST /api/challenges/:id/cancel (Cancel Active)

**Mô tả:** Host hủy challenge đang Active giữa chừng.

**Request body:** `{ "reason": "optional" }`

**TDD:**

```text
- Test: non-host → 403
- Test: challenge không active → 409
- Test: cancel thành công → status = 'cancelled', end_reason = 'host_cancelled'
- Test: cancel → snapshot partial stats được tạo
- Test: cancel → notification cho tất cả member
```

**Done when:**

- Snapshot tạo kể cả khi cancel giữa chừng
- Activity `challenge_cancelled` tạo cho mỗi member

---

## Dependency Map

```text
Sprint 4 (challenges, challenge_members) → Task 2, 3, 4
Sprint 5 (checkins) → Task 3
Task 1 (cron infra) → Task 2, 3, 4
Task 3 (deduction + step) → Task 5 (completion → snapshot)
Task 5 (snapshot) → Sprint 9 (History dùng final_stats)
```
