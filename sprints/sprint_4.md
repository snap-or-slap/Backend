# Sprint 4 — Challenge Core (Create, Invite, Formation)

## Sprint Goal
Xây dựng toàn bộ vòng đời giai đoạn đầu của Challenge: tạo mới, mời bạn, quản lý Formation hub (slot, ready status, countdown), và state machine chuyển trạng thái. Sau sprint này, một challenge có thể đi từ `creation` → `formation` → sẵn sàng `active`.

**Screens covered:** D-03 (Create Challenge), E-01 (Invitation), E-02 (Formation Hub), D-02 (Challenges in Formation tab)  
**Duration:** 1.5 tuần  
**Depends on:** Sprint 1, Sprint 2, Sprint 3

---

## Task 1 — POST /api/challenges (Tạo challenge mới)

**Mô tả:** Tạo challenge mới với đầy đủ thông tin. Creator tự động trở thành `host` và `accepted` member đầu tiên. Trạng thái ban đầu là `formation`.

**Request body:**
```json
{
  "title": "5AM Warrior",
  "description": "Thử thách dậy sớm tập thể dục",
  "cover_url": "https://...",
  "duration_days": 14,
  "frequency": "daily",
  "frequency_days": null,
  "start_at": "2026-04-25T05:00:00Z",
  "reset_time": "22:00:00",
  "total_hearts": 4,
  "max_members": 5,
  "is_private": false,
  "invited_user_ids": ["uuid-1", "uuid-2"]
}
```

**Response:** `201 { challenge: { id, title, status: 'formation', ... } }`

**TDD:**
```
- Test: title rỗng → 400
- Test: duration_days < 1 → 400
- Test: start_at trong quá khứ → 400
- Test: total_hearts < 1 → 400
- Test: max_members < 2 → 400 (challenge cần ít nhất 2 người)
- Test: invited_user_ids chứa user không phải bạn của creator → 400 { error: "Can only invite friends" }
- Test: tạo thành công → creator có role 'host', status 'accepted' trong challenge_members
- Test: tạo thành công với invited_user_ids → tạo challenge_member records với status 'invited' cho từng người
- Test: tạo thành công → notification 'challenge_invite' gửi cho từng người được mời
- Test: frequency = 'custom' nhưng frequency_days null → 400
```

**Done when:**
- Challenge được tạo với `status = 'formation'`, `hearts_left = total_hearts`, `current_step = 0`
- `challenge_members` có 1 record cho host (role='host', status='accepted', is_ready=false)
- Với mỗi `invited_user_id`: 1 record (role='member', status='invited')

---

## Task 2 — GET /api/challenges (Danh sách challenges của user)

**Mô tả:** Lấy tất cả challenges mà current user là member (accepted). Phân loại theo `status` thành 3 tab: Formation, Active, History.

**Query params:** `?status=formation|active|history`

**Response:**
```json
{
  "challenges": [
    {
      "id": "uuid",
      "title": "5AM Warrior",
      "status": "formation",
      "start_at": "...",
      "reset_time": "22:00:00",
      "duration_days": 14,
      "current_step": 0,
      "total_steps": 14,
      "hearts_left": 4,
      "total_hearts": 4,
      "member_count": 2,
      "max_members": 5,
      "members": [{ "id", "username", "avatar_url", "is_ready" }],
      "health_status": "on_track" | "danger",
      "my_checkin_today": false,
      "time_until_reset": 14400
    }
  ]
}
```

**TDD:**
```
- Test: chỉ trả challenges mà user đã accepted (không trả invited/declined)
- Test: filter ?status=formation → chỉ trả formation challenges
- Test: filter ?status=active → có thêm field my_checkin_today và time_until_reset
- Test: filter ?status=history → trả completed/failed/cancelled
- Test: không có param → trả tất cả
- Test: health_status = 'danger' khi bất kỳ member nào chưa check-in và còn < 2 tiếng đến reset_time
```

**Done when:**
- Không N+1: single query với JOIN challenge_members
- `time_until_reset` tính theo múi giờ UTC (số giây còn lại đến reset_time ngày hôm nay)
- `my_checkin_today` check trong bảng `checkins` theo cycle_number hiện tại

---

## Task 3 — GET /api/challenges/:id (Chi tiết challenge)

**Mô tả:** Lấy đầy đủ chi tiết một challenge. Chỉ member (accepted) mới xem được private challenge.

**Response:** Toàn bộ thông tin challenge + danh sách members đầy đủ + checkin status hôm nay của mỗi member.

**TDD:**
```
- Test: user không phải member của private challenge → 403
- Test: challenge public → user ngoài vẫn xem được basic info
- Test: member → xem đầy đủ bao gồm checkin status mỗi người hôm nay
- Test: challenge không tồn tại → 404
```

**Done when:**
- Response bao gồm `members[].checkin_status: 'checked_in' | 'pending' | 'failed'`
- `failed` = người này đã làm mất tim trong chu kỳ trước

---

## Task 4 — POST /api/challenges/:id/invite (Mời thêm người)

**Mô tả:** Host mời thêm bạn bè vào Formation (còn slot và chưa Active).

**Request body:** `{ "user_ids": ["uuid-1"] }`

**TDD:**
```
- Test: chỉ host mới invite được → non-host member → 403
- Test: challenge đang Active → 409 { error: "Challenge already started" }
- Test: slot đã đầy → 409 { error: "No more slots available" }
- Test: user không phải bạn của host → 400
- Test: user đã là member (invited/accepted) → 409
- Test: invite thành công → tạo challenge_member + notification
```

**Done when:**
- Không thể invite khi `status != 'formation'`
- Notification `challenge_invite` gửi cho người được mời

---

## Task 5 — POST /api/challenges/:id/join (Chấp nhận lời mời)

**Mô tả:** User chấp nhận lời mời tham gia challenge (từ màn hình E-01 Invitation).

**TDD:**
```
- Test: user có status 'invited' → update sang 'accepted'
- Test: user không có invitation → 403
- Test: challenge đã full (max_members reached) → 409
- Test: challenge đang Active (không còn trong Formation) → 409
- Test: challenge đã bị cancel → 409
- Test: join thành công → notification gửi cho host: "X accepted your invitation"
- Test: join thành công → tạo activity 'challenge_joined' cho user
```

**Done when:**
- Sau khi join, user xuất hiện trong Formation Hub với is_ready = false

---

## Task 6 — POST /api/challenges/:id/decline (Từ chối lời mời)

**Mô tả:** User từ chối lời mời.

**TDD:**
```
- Test: user có status 'invited' → update sang 'declined'
- Test: user không có invitation → 403
- Test: decline thành công → không có notification cho host (hoặc có nếu muốn)
```

**Done when:**
- Status = 'declined', không chiếm slot nữa

---

## Task 7 — PUT /api/challenges/:id/ready (Toggle sẵn sàng)

**Mô tả:** Member bấm "Ready" trên Formation Hub để xác nhận sẵn sàng bắt đầu.

**Request body:** `{ "is_ready": true | false }`

**TDD:**
```
- Test: accepted member toggle ready → is_ready cập nhật trong challenge_members
- Test: host cũng phải ready (không tự động)
- Test: invited member (chưa accept) cố toggle → 403
- Test: challenge đã Active → 409 (không cần ready nữa)
- Test: khi tất cả member ready → notification cho host: "All members are ready!"
```

**Done when:**
- Readiness count được tính từ `SELECT COUNT(*) WHERE is_ready = true` (không cache)

---

## Task 8 — POST /api/challenges/:id/leave (Rời nhóm trước khi Active)

**Mô tả:** Member rời Formation (chỉ trước khi Active).

**TDD:**
```
- Test: regular member leave → xóa record khỏi challenge_members
- Test: host cố leave → 400 { error: "Host cannot leave. Cancel the challenge instead." }
- Test: challenge đang Active → 400 (không thể leave khi đang chạy)
- Test: leave thành công → thông báo cho các member còn lại
```

**Done when:**
- Slot trống lại, có thể invite người khác vào

---

## Task 9 — DELETE /api/challenges/:id (Host hủy challenge)

**Mô tả:** Host hủy challenge trong giai đoạn Formation.

**TDD:**
```
- Test: chỉ host mới hủy được → 403 nếu không phải host
- Test: challenge đang Active → 400 (dùng endpoint khác để cancel active)
- Test: hủy thành công → status = 'cancelled', end_reason = 'host_cancelled'
- Test: hủy thành công → notification gửi cho tất cả member đã accept: "Challenge was cancelled"
```

**Done when:**
- Sau khi cancel, không thể join/leave/ready nữa
- Tạo activity 'challenge_cancelled' cho tất cả member

---

## Task 10 — PUT /api/challenges/:id/settings (Host chỉnh sửa trước Active)

**Mô tả:** Host chỉnh sửa reset_time hoặc total_hearts trước khi challenge bắt đầu.

**Request body:**
```json
{ "reset_time": "21:00:00", "total_hearts": 3 }
```

**TDD:**
```
- Test: non-host → 403
- Test: challenge đã Active → 409 (locked)
- Test: giảm total_hearts < số người hiện tại → 400 (nếu có rule này)
- Test: cập nhật thành công → hearts_left cũng cập nhật nếu chưa có ai bị trừ
- Test: cập nhật thành công → thông báo cho tất cả member về thay đổi
```

**Done when:**
- `Lock Mechanism`: khi status chuyển sang 'active', mọi edit bị từ chối
- Sau khi edit, is_ready của tất cả member bị reset về false (cần confirm lại)

---

## Task 11 — GET /api/challenges/public (Tìm challenge công khai)

**Mô tả:** Danh sách các public challenge đang ở Formation, có thể xin tham gia.

**Query params:** `?q=keyword&page=1`

**TDD:**
```
- Test: chỉ trả status = 'formation' và is_private = false
- Test: challenge đã đầy slot không xuất hiện
- Test: challenge mà user đã là member không xuất hiện
```

**Done when:**
- Trả về `{ challenges: [...], total, page }`
- Có thể thêm `POST /api/challenges/:id/request-join` nếu muốn public join flow

---

## Challenge State Machine

```
creation
    ↓ [POST /api/challenges]
FORMATION
    ↓ [Cron: start_at reached + min members met]      ↓ [DELETE /api/challenges/:id]
  ACTIVE                                            CANCELLED
    ↓ [Cron: all steps completed]  ↓ [Cron: hearts_left = 0]
 COMPLETED                        FAILED
```

Toàn bộ state transition logic được đặt trong `src/lib/services/challengeStateService.ts`.

---

## Dependency Map

```
Sprint 2 (users) → Task 1, 4, 5, 6, 7, 8, 9
Sprint 3 (friends) → Task 1 (invited_user_ids phải là friends), Task 4
Task 1 (create) → Task 2, 3, 4
Task 5 (join) → Task 7 (ready)
Task 9 (cancel) → Sprint 5 (cron sẽ skip cancelled challenges)
Task 11 → Sprint 5 (public join logic)
```
