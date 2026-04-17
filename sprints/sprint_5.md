# Sprint 5 — Active Challenge & Check-in System

## Sprint Goal

Xây dựng luồng check-in hàng ngày — trái tim của app: submit bằng chứng, upload ảnh lên Supabase Storage, đếm ngược đến reset, hiển thị trạng thái từng member. Sau sprint này, một challenge `Active` có thể được check-in đầy đủ.

**Screens covered:** F-01 (Active Challenge Detail), F-02 (Check-in Action), F-03 (Check-in Success)

**Duration:** 1 tuần

**Depends on:** Sprint 1, Sprint 2, Sprint 4

---

## Task 1 — POST /api/challenges/:id/checkins

**Mô tả:** User submit check-in cho chu kỳ hiện tại. Upload ảnh (evidence) lên **Supabase Storage**, lưu caption và URL vào DB. Đây là action quan trọng nhất, cần validation chặt nhất.

**Request:** `multipart/form-data`

```text
evidence: File (ảnh JPEG/PNG/HEIC, max 10MB)
caption:  string (optional, max 280 ký tự)
```

**Response:**

```json
{
  "checkin": {
    "id": "uuid",
    "cycle_number": 6,
    "evidence_url": "https://supabase.co/storage/...",
    "caption": "Day 6 done!",
    "checked_in_at": "2026-04-22T07:30:00Z"
  },
  "streak": 6,
  "squad_status": {
    "hearts_left": 4,
    "members_checked_in": 2,
    "members_total": 4
  },
  "badge_unlocked": null
}
```

**TDD:**

```text
- Test: user không phải member của challenge → 403
- Test: challenge không ở status 'active' → 409
- Test: đã check-in trong chu kỳ này rồi → 409 { error: "Already checked in for this cycle" }
- Test: check-in ngoài window hợp lệ → 400 { error: "Check-in window expired" }
- Test: không có file evidence → 400 { error: "Evidence photo is required" }
- Test: file không phải ảnh (PDF, exe...) → 400
- Test: file > 10MB → 400
- Test: check-in thành công → evidence_url trong DB trỏ về Supabase Storage URL
- Test: check-in thành công → streak tăng đúng
- Test: check-in thành công → badge check trigger được gọi
- Test: check-in thành công → activity 'checkin_done' được tạo
- Test: check-in thành công → real-time event gửi đến squad members qua WebSocket
```

**Done when:**

- `cycle_number` tính dựa trên số ngày kể từ `start_at` (không phải ID tự tăng)
- Upload Supabase Storage: path `checkins/{challenge_id}/{user_id}/{cycle}.jpg`
- Transaction: upload thành công TRƯỚC, rồi mới insert DB. Nếu DB lỗi → xóa ảnh đã upload
- Dùng `storage.ts` helper từ Sprint 2 Task 7

---

## Task 2 — GET /api/challenges/:id/checkins/today

**Mô tả:** Lấy trạng thái check-in của tất cả member trong cycle hiện tại. Dùng cho màn hình F-01 (Member Grid).

**Response:**

```json
{
  "cycle_number": 6,
  "reset_at": "2026-04-22T22:00:00Z",
  "time_until_reset": 52800,
  "members": [
    {
      "user_id": "uuid",
      "username": "maya_z",
      "avatar_url": "...",
      "status": "checked_in",
      "checked_in_at": "2026-04-22T07:30:00Z"
    },
    {
      "user_id": "uuid2",
      "username": "john_d",
      "avatar_url": "...",
      "status": "pending",
      "checked_in_at": null
    }
  ]
}
```

**Status values:**

- `checked_in` — đã check-in trong chu kỳ này
- `pending` — chưa check-in, vẫn còn thời gian
- `failed` — chu kỳ trước bị miss (làm mất tim)

**TDD:**

```text
- Test: trả đúng status cho từng member
- Test: time_until_reset tính bằng giây, âm nếu đã qua reset_time
- Test: user ngoài squad → 403
```

**Done when:**

- `status: 'failed'` chỉ apply cho chu kỳ trước (không phải chu kỳ hiện tại đang chạy)
- Single query JOIN challenge_members + checkins, không N+1

---

## Task 3 — GET /api/challenges/:id/checkins/gallery

**Mô tả:** Lấy toàn bộ ảnh check-in của cả squad. Dùng cho màn hình G-01 (History Gallery).

**Query params:** `?page=1&per_page=20&user_id=uuid`

**Response:**

```json
{
  "checkins": [
    {
      "id": "uuid",
      "user": { "id": "uuid", "username": "maya_z", "avatar_url": "..." },
      "evidence_url": "...",
      "caption": "...",
      "cycle_number": 6,
      "checked_in_at": "..."
    }
  ],
  "total": 48,
  "page": 1
}
```

**TDD:**

```text
- Test: phân trang hoạt động đúng
- Test: filter theo user_id chỉ trả ảnh của user đó
- Test: sort mặc định mới nhất trước
- Test: challenge chưa active → 409
- Test: member ngoài squad trên private challenge → 403
```

**Done when:**

- Offset-based pagination, giới hạn 20/page
- evidence_url là Supabase Storage public URL

---

## Task 4 — POST /api/challenges/:id/nudge/:memberId

**Mô tả:** Gửi in-app notification nhắc nhở member chưa check-in. Giới hạn 1 nudge/người/ngày.

**TDD:**

```text
- Test: gửi nudge cho member đã check-in rồi → 400
- Test: gửi nudge 2 lần trong ngày cho cùng 1 người → 429
- Test: nudge thành công → notification 'nudge' tạo cho receiver
- Test: không phải member → 403
- Test: nudge chính mình → 400
```

**Done when:**

- Rate limit check bằng DB timestamp (không cần Redis)
- Notification metadata gồm `{ challenger_name, challenge_title }`

---

## Task 5 — GET /api/challenges/:id/stats

**Mô tả:** Thống kê tổng hợp cho Active Detail và History: top performer, danger zones, completion rate.

**Response:**

```json
{
  "challenge_id": "uuid",
  "total_checkins": 48,
  "completion_rate": 85.7,
  "hearts_lost_at": [3, 7],
  "top_performer": {
    "user_id": "uuid",
    "username": "maya_z",
    "checkin_count": 14,
    "completion_rate": 100.0
  },
  "member_stats": [
    {
      "user_id": "uuid",
      "username": "...",
      "checkin_count": 12,
      "missed_count": 2,
      "completion_rate": 85.7
    }
  ]
}
```

**TDD:**

```text
- Test: completion_rate = checkins / (members * elapsed_cycles) * 100
- Test: top_performer là người completion_rate cao nhất
- Test: hearts_lost_at là array cycle_number khi mất tim
- Test: challenge formation → 409
```

**Done when:**

- Single aggregated query, không loop trong code
- Cache 5 phút cho challenges đã completed

---

## Task 6 — Check-in Window Validation Service

**Mô tả:** Xác định xem thời điểm hiện tại có nằm trong window check-in hợp lệ không. Window: từ sau `reset_time` hôm qua → trước `reset_time` hôm nay.

**Logic:**

```text
current_cycle = FLOOR((NOW() - start_at) / 1 day) + 1
cycle_start   = start_at + (current_cycle - 1) days (tại reset_time)
cycle_end     = cycle_start + 1 day
valid         = cycle_start <= NOW() < cycle_end
```

**TDD:**

```text
- Test: giờ 15:00, reset_time = 22:00 → window open
- Test: giờ 23:00, reset_time = 22:00 → window mới (chu kỳ tiếp)
- Test: challenge chưa bắt đầu → không cho check-in
- Test: chu kỳ đã qua → không cho check-in
```

**Done when:**

- Hàm `getCurrentCycle(challenge)` export từ `src/lib/services/checkinService.ts`
- Tất cả tính toán theo UTC

---

## Task 7 — Badge Check Trigger (Post-checkin)

**Mô tả:** Sau check-in thành công, kiểm tra badge mới. Chạy async, không block response.

**Badges cần check:**

| Badge | Condition |
|-------|-----------|
| `first_checkin` | checkin_count == 1 |
| `streak_7` | streak >= 7 |
| `streak_30` | streak >= 30 |
| `challenge_completed_1` | completed challenges == 1 |
| `squad_mvp` | completion_rate == 100% khi challenge kết thúc |
| `early_adopter` | user_id trong top 1000 signup |

**TDD:**

```text
- Test: user đạt streak 7 lần đầu → badge 'streak_7' được tạo trong user_badges
- Test: user đã có badge rồi → không tạo duplicate
- Test: badge check không block response
- Test: badge earned → notification 'badge_earned' + activity 'badge_earned' được tạo
- Test: response checkin có field badge_unlocked nếu badge vừa earned
```

**Done when:**

- `checkBadges(userId)` chạy background sau checkin (`setImmediate`)
- DB transaction để tránh duplicate khi race condition
- `user_badges(user_id, badge_id)` có UNIQUE constraint

---

## Dependency Map

```text
Sprint 2 Task 7 (storage helper) → Task 1 (dùng để upload evidence)
Sprint 4 (challenge active) → Task 1, 2, 3, 4, 5, 6
Task 1 (checkin) → Task 7 (badge check)
Task 6 (window validation) → Task 1
Sprint 6 (cron) → dùng cycle_number logic từ Task 6
Sprint 8 (WebSocket) → Task 1 (emit checkin:new event)
```
