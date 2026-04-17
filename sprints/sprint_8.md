# Sprint 8 — Notifications & Real-time

## Sprint Goal

Xây dựng hệ thống thông báo in-app, real-time WebSocket để squad members thấy nhau check-in ngay lập tức, Widget API nhẹ cho Android, và sync pending events khi user quay lại sau offline. Không có push notification (FCM để sau).

**Screens covered:** J-01 (Notification Center), J-02 (Widget), K-01 (Real-time toasts)

**Duration:** 1 tuần

**Depends on:** Sprint 2, Sprint 4, Sprint 5, Sprint 6

---

## Task 1 — GET /api/notifications

**Mô tả:** Lấy danh sách in-app notifications của current user (màn hình J-01).

**Query params:** `?category=social|challenge|system&is_read=false&page=1`

**Response:**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "friend_request",
      "category": "social",
      "title": "New Friend Request",
      "body": "maya_z wants to be your friend",
      "metadata": {
        "sender_id": "uuid",
        "sender_name": "Maya Z.",
        "request_id": "uuid"
      },
      "is_read": false,
      "created_at": "2026-04-22T10:00:00Z"
    }
  ],
  "unread_count": 5,
  "total": 47,
  "page": 1
}
```

**Category mapping:**

| type | category |
|------|----------|
| friend_request, friend_accepted | social |
| challenge_invite, challenge_start, heart_lost, nudge | challenge |
| badge_earned | system |

**TDD:**

```text
- Test: chỉ trả notifications của chính user
- Test: filter ?is_read=false → chỉ chưa đọc
- Test: filter ?category=social → chỉ social
- Test: unread_count tính đúng bằng COUNT query riêng
- Test: sort created_at DESC
- Test: không có auth → 401
```

**Done when:**

- `unread_count` từ single `COUNT(*)` query, không load toàn bộ rồi đếm
- Index: `notifications(user_id, is_read, created_at DESC)`

---

## Task 2 — PUT /api/notifications/read

**Mô tả:** Đánh dấu một hoặc tất cả notification đã đọc.

**Request body:**

```json
{ "notification_ids": ["uuid1", "uuid2"] }
```

hoặc

```json
{ "mark_all": true }
```

**TDD:**

```text
- Test: mark specific → chỉ những id đó is_read = true
- Test: mark_all → tất cả notifications của user is_read = true
- Test: mark notification của người khác → skip (không 403)
- Test: notification đã read → idempotent
```

**Done when:**

- Batch update: `WHERE id IN (...) AND user_id = current_user`
- Trả về `{ updated_count: N }`

---

## Task 3 — DELETE /api/notifications/:id

**TDD:**

```text
- Test: xóa của chính mình → 200
- Test: xóa của người khác → 403
- Test: không tồn tại → 404
```

**Done when:**

- Hard delete

---

## Task 4 — WebSocket Setup (Real-time Events)

**Mô tả:** Socket.io attach vào custom Next.js server (`server.ts`). User kết nối → join rooms theo challenge_ids. Server emit events khi có action.

**Events:**

| Event | Trigger | Payload |
| ----- | ------- | ------- |
| `checkin:new` | Member check-in | `{ user_id, username, avatar_url, challenge_id, caption }` |
| `heart:lost` | Squad mất tim | `{ challenge_id, missed_user_id, hearts_remaining }` |
| `member:ready` | Member toggle ready | `{ challenge_id, user_id, is_ready }` |
| `challenge:started` | Challenge active | `{ challenge_id }` |
| `notification:new` | Có notification mới | `{ notification }` |

**Connection flow:**

```text
Client connect với JWT (query param: ?token=...)
Server verify JWT → join rooms challenge:{id} cho mỗi active challenge của user
Server emit events khi trigger
Client disconnect → rời rooms
```

**TDD:**

```text
- Test: connect JWT hợp lệ → connected, joined rooms
- Test: connect không có JWT → disconnect ngay
- Test: connect JWT hết hạn → disconnect ngay
- Test: user A check-in challenge X → user B (cùng challenge) nhận 'checkin:new'
- Test: user A check-in challenge X → user C (challenge khác) không nhận
- Test: server restart → client auto-reconnect (socket.io built-in)
```

**Done when:**

- `server.ts` custom Next.js server attach `io` vào HTTP server
- JWT verification trong socket middleware
- Emit từ API routes: `req.io.to('challenge:X').emit('checkin:new', ...)`
- Rooms: `challenge:{challenge_id}`

---

## Task 5 — GET /api/widget/summary

**Mô tả:** Endpoint cực nhẹ cho Android Widget (màn hình J-02). Trả chỉ số cần thiết, không load full profile.

**Response:**

```json
{
  "current_streak": 12,
  "active_challenges": [
    {
      "id": "uuid",
      "title": "5AM Warrior",
      "hearts_left": 3,
      "total_hearts": 4,
      "my_checkin_today": false,
      "time_until_reset": 3600,
      "members_checked_in": 2,
      "members_total": 4
    }
  ],
  "unread_notifications": 3
}
```

**TDD:**

```text
- Test: chỉ trả active challenges
- Test: my_checkin_today đúng cho current cycle
- Test: time_until_reset tính bằng giây
- Test: không có active challenge → active_challenges = []
- Test: response time < 200ms
```

**Done when:**

- Single query JOIN challenges + challenge_members + checkins hôm nay
- Cache 60 giây (widget không cần real-time)

---

## Task 6 — GET /api/sync (Pending Overlays khi User Online)

**Mô tả:** Khi user mở app sau offline, lấy danh sách events cần hiển thị overlay (màn hình K-03).

**Response:**

```json
{
  "pending_overlays": [
    {
      "type": "heart_lost",
      "data": {
        "challenge_id": "uuid",
        "challenge_title": "5AM Warrior",
        "missed_user": "john_doe",
        "hearts_remaining": 2
      }
    },
    {
      "type": "badge_unlocked",
      "data": {
        "badge_id": "uuid",
        "badge_name": "Week Warrior",
        "badge_icon_url": "..."
      }
    }
  ]
}
```

**Logic:**

```text
1. Query notifications WHERE shown_at IS NULL AND type IN ('heart_lost', 'badge_earned', 'challenge_start')
2. Trả về dưới dạng overlays
3. UPDATE shown_at = NOW() cho tất cả trong kết quả
```

**TDD:**

```text
- Test: user offline 2 ngày, 3 events → trả 3 overlays
- Test: sau /sync → events không xuất hiện lại
- Test: overlays sort oldest first (hiển thị lần lượt)
- Test: user đã nhận qua WebSocket (shown_at != NULL) → không trả lại
```

**Done when:**

- Field `shown_at TIMESTAMP NULLABLE` đã có trong `notifications` (Sprint 1 migration)
- Atomic: query + update trong 1 transaction

---

## Dependency Map

```text
Sprint 4, 5, 6 (events) → Task 1 (notification center hiển thị)
Task 4 (WebSocket) → Sprint 5 Task 1 (checkin emit WS event)
Task 4 (WebSocket) → Sprint 6 Task 3 (heart lost emit WS event)
Task 5 (widget) → Sprint 7 Task 9 (stats)
Task 6 (sync) → Task 1 (dùng chung notifications table)
```
