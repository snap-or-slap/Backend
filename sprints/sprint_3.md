# Sprint 3 — Friends & Social System

## Sprint Goal
Xây dựng toàn bộ hệ thống xã hội: tìm kiếm người dùng, gửi/nhận/phản hồi lời mời kết bạn, danh sách bạn bè, và privacy layer (kiểm tra quan hệ trước khi trả về data profile).

**Screens covered:** C-05 (Add/Search Friends, Friend Profile), C-06 (Identity Preview, Squadmate Preview)  
**Duration:** 1 tuần  
**Depends on:** Sprint 1, Sprint 2

---

## Task 1 — GET /api/users/search?q=username

**Mô tả:** Tìm kiếm user theo `username` (prefix match hoặc exact). Trả về avatar, display_name, username, mutual friend count, trạng thái quan hệ với current user.

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "maya_z",
      "display_name": "Maya Z.",
      "avatar_url": "...",
      "mutual_friends_count": 3,
      "relationship": "friend" | "pending_sent" | "pending_received" | "none"
    }
  ]
}
```

**TDD:**
```
- Test: search "maya" → trả về tất cả user có username bắt đầu bằng "maya"
- Test: user có is_private = true → KHÔNG xuất hiện trong kết quả (trừ khi search exact username)
- Test: search exact username của private user → xuất hiện nhưng có flag "is_private: true" và thiếu stats
- Test: current user không xuất hiện trong kết quả của chính mình
- Test: q < 2 ký tự → 400 (tránh full table scan)
- Test: mutual_friends_count tính đúng
- Test: không có auth → 401
```

**Done when:**
- Query dùng `ILIKE 'q%'` + index trên `users.username`
- Mutual friends count được tính bằng 1 query (không N+1)
- Kết quả giới hạn 20 items, có pagination

---

## Task 2 — POST /api/friends/request

**Mô tả:** Gửi lời mời kết bạn đến `receiver_id`. Tạo bản ghi trong `friend_requests`.

**Request body:** `{ "receiver_id": "uuid" }`

**TDD:**
```
- Test: gửi request thành công → status 'pending' trong DB
- Test: gửi lại cho người đã là bạn → 409 { error: "Already friends" }
- Test: gửi lại cho người đã gửi request trước → 409 { error: "Request already sent" }
- Test: người kia đã gửi request cho mình trước → tự động accept (hoặc 409 báo "They already sent you a request")
- Test: gửi request cho chính mình → 400
- Test: receiver_id không tồn tại → 404
- Test: tạo notification cho receiver sau khi gửi request
```

**Done when:**
- Không thể có 2 bản ghi pending giữa cùng 2 user
- Notification `{ type: 'friend_request', metadata: { sender_id, sender_name } }` được tạo cho receiver

---

## Task 3 — PUT /api/friends/request/:requestId/respond

**Mô tả:** Chấp nhận hoặc từ chối lời mời kết bạn.

**Request body:** `{ "action": "accept" | "decline" }`

**TDD:**
```
- Test: accept → status = 'accepted', tạo activity cho cả 2 user
- Test: accept → notification 'friend_accepted' gửi cho người đã gửi request
- Test: decline → status = 'declined', không tạo activity
- Test: người không phải receiver của request cố respond → 403
- Test: requestId không tồn tại → 404
- Test: request đã được xử lý (đã accepted/declined) cố respond lại → 409
```

**Done when:**
- Khi accept: tạo 2 activity records (cho cả sender và receiver): `{ type: 'friend_added' }`
- Khi accept: mutual friend count của cả hai cập nhật tự động (qua query, không cache)

---

## Task 4 — GET /api/friends

**Mô tả:** Lấy danh sách bạn bè của current user. Trả về thông tin cơ bản + current streak + active challenge count.

**Response:**
```json
{
  "friends": [
    {
      "id": "uuid",
      "username": "...",
      "display_name": "...",
      "avatar_url": "...",
      "active_challenges_count": 2,
      "current_streak": 12
    }
  ],
  "total": 15,
  "page": 1
}
```

**TDD:**
```
- Test: trả đúng danh sách bạn bè (không bao gồm declined/pending)
- Test: bạn bè xóa account (is_active = false) không xuất hiện
- Test: pagination hoạt động đúng
- Test: không có auth → 401
```

**Done when:**
- Query JOIN friend_requests + users + challenge_members + checkins cho streak
- Kết quả sắp xếp theo `display_name` asc, có thể thêm sort param

---

## Task 5 — GET /api/friends/requests/pending

**Mô tả:** Lấy danh sách lời mời kết bạn đang chờ xử lý (incoming).

**Response:** `{ "requests": [{ "id", "sender": { id, username, display_name, avatar_url }, "created_at" }] }`

**TDD:**
```
- Test: chỉ trả về requests mà current user là receiver và status = 'pending'
- Test: không trả về requests mà current user đã gửi đi
```

**Done when:**
- Badge count cho notification center có thể tính từ endpoint này

---

## Task 6 — DELETE /api/friends/:friendUserId

**Mô tả:** Xóa quan hệ bạn bè (unfriend).

**TDD:**
```
- Test: xóa thành công → friend_request record bị delete (hoặc status = 'removed')
- Test: xóa người không phải bạn → 404
- Test: sau khi unfriend, profile của người kia quay về trạng thái 'none' với privacy
```

**Done when:**
- Xóa cả 2 chiều (sender và receiver đều mất nhau)
- Không tạo notification khi unfriend

---

## Task 7 — GET /api/users/:userId/profile (Privacy Layer)

**Mô tả:** Lấy thông tin profile của user khác. **Backend phải kiểm tra quan hệ** trước khi trả về data. Đây là endpoint quan trọng nhất của sprint.

**Logic trả về theo quan hệ:**

| Quan hệ | Data trả về |
|---------|-------------|
| `friend` | Full profile: stats, badges, activities, challenges |
| `squadmate` (cùng challenge, chưa kết bạn) | Shared challenge info, current progress, co-squadmates. Ẩn activities |
| `none` (người lạ) | Chỉ display_name + avatar nếu `is_private = false`. Nếu search exact username: warning flag `is_stranger: true` |
| `pending` | Tương tự `none` |

**Response (friend case):**
```json
{
  "user": { "id", "username", "display_name", "avatar_url", "bio" },
  "relationship": "friend",
  "stats": {
    "current_streak": 24,
    "challenges_joined": 8,
    "completion_rate": 87.5
  },
  "badges": [{ "id", "name", "icon_url" }],
  "latest_activities": [{ "type", "metadata", "created_at" }],
  "shared_challenge": null
}
```

**Response (squadmate case):**
```json
{
  "user": { "id", "username", "display_name", "avatar_url" },
  "relationship": "squadmate",
  "shared_challenge": {
    "id", "title",
    "target_user_progress": { "current_step": 5, "total_steps": 14 },
    "co_squadmates": [{ "id", "username", "avatar_url" }]
  },
  "stats": null,
  "badges": null,
  "latest_activities": null
}
```

**Response (stranger case):**
```json
{
  "user": { "id", "username", "display_name", "avatar_url" },
  "relationship": "none",
  "is_stranger_warning": true,
  "stats": null,
  "badges": null,
  "latest_activities": null
}
```

**TDD:**
```
- Test: bạn bè → trả full data bao gồm stats và activities
- Test: người lạ → stats, badges, activities đều null
- Test: người lạ có is_private = true → 404 hoặc chỉ trả { id, relationship: 'none' }
- Test: squadmate → có shared_challenge, không có activities
- Test: current_streak tính đúng (số ngày liên tiếp check-in)
- Test: completion_rate tính đúng (checkins_done / total_possible_checkins * 100)
- Test: tự xem profile của mình → redirect hoặc trả về full data
```

**Done when:**
- Logic kiểm tra quan hệ là single DB query (không gọi 3 query riêng)
- Không có N+1 query trong bất kỳ trường hợp nào
- Shared context query: `SELECT challenge_id FROM challenge_members WHERE user_id IN (current, target) GROUP BY challenge_id HAVING COUNT(*) = 2`

---

## Task 8 — Streak Calculation Service

**Mô tả:** Hàm tính `current_streak` cho một user. Dùng cho profile preview và active challenge. Streak = số ngày liên tiếp gần nhất mà user có ít nhất 1 checkin.

**Logic:**
```
1. Lấy tất cả checkins của user, group by DATE(checked_in_at)
2. Sort desc
3. Đếm chuỗi liên tiếp kể từ hôm nay (hoặc hôm qua nếu chưa check-in hôm nay)
```

**TDD:**
```
- Test: check-in 5 ngày liên tiếp → streak = 5
- Test: check-in hôm qua nhưng chưa hôm nay → streak = n (vẫn còn hiệu lực đến hết hôm nay)
- Test: bỏ qua 1 ngày → streak = số ngày sau lần bỏ đó
- Test: chưa check-in lần nào → streak = 0
- Test: user có checkin trong nhiều challenges khác nhau → streak tính chung, không per-challenge
```

**Done when:**
- Hàm `calculateStreak(userId: string): Promise<number>` export từ `src/lib/services/streakService.ts`
- Được cache trong Redis (optional) hoặc tính fresh mỗi request
- Unit test pass với mọi edge case

---

## Dependency Map

```
Sprint 2 (users table) → Task 1, 2, 3, 4, 5, 6, 7
Task 1 (search) → Task 2 (send request — cần biết receiver_id)
Task 2 (send request) → Task 3 (respond)
Task 3 (accept) → Task 4 (friends list)
Task 7 (profile) → Task 8 (streak service)
Sprint 4 (challenges) → Task 7 (squadmate logic)
```
