# Sprint 7 — Profile & Gamification

## Sprint Goal

Hoàn thiện Profile cá nhân: stats tổng hợp, badge cabinet, activity feed, edit profile, settings. Xây dựng Badge engine tự động và User Stats aggregation.

**Screens covered:** H-01 (Main Profile), H-02 (Edit Profile), H-03 (Settings)

**Duration:** 1 tuần

**Depends on:** Sprint 2, Sprint 5, Sprint 6

---

## Task 1 — GET /api/users/me/profile

**Mô tả:** Lấy toàn bộ thông tin profile của current user (màn hình H-01).

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "username": "cool_user",
    "display_name": "Cool User",
    "avatar_url": "https://supabase.co/storage/...",
    "bio": "Living the grind",
    "email": "user@example.com",
    "is_private": false,
    "created_at": "2026-01-01T00:00:00Z"
  },
  "stats": {
    "current_streak": 12,
    "best_streak": 24,
    "challenges_joined": 8,
    "challenges_completed": 5,
    "success_rate": 78.5
  },
  "badges": [
    {
      "id": "uuid",
      "name": "Speed Demon",
      "description": "Check in within 1 hour of reset time for 5 days",
      "icon_url": "...",
      "earned_at": "2026-03-15T10:00:00Z"
    }
  ],
  "badges_locked": [
    {
      "id": "uuid",
      "name": "Century Club",
      "description": "Reach a 100-day streak",
      "icon_url": "...",
      "progress": 12,
      "target": 100
    }
  ],
  "latest_activities": [
    {
      "type": "challenge_completed",
      "metadata": { "challenge_title": "5AM Warrior" },
      "created_at": "..."
    }
  ]
}
```

**TDD:**

```text
- Test: stats lấy từ user_stats table (không tính live mỗi request)
- Test: badges chỉ hiển thị badge đã earned
- Test: badges_locked hiển thị badge chưa đạt + progress
- Test: latest_activities giới hạn 20 items
- Test: không có auth → 401
- Test: response time < 500ms
```

**Done when:**

- `user_stats` được cập nhật bởi Sprint 6 Task 5, không tính live
- `badges_locked` tính progress: `streak_days` → current_streak / target

---

## Task 2 — User Stats Aggregation Service

**Mô tả:** Service tính và lưu tổng hợp stats. Được gọi sau mỗi challenge kết thúc (Sprint 6 Task 5).

**Metrics:**

```text
current_streak:      số ngày liên tiếp check-in gần nhất
best_streak:         max streak ever (không giảm)
challenges_joined:   COUNT(challenge_members WHERE status='accepted')
challenges_completed: COUNT(challenges WHERE status='completed' AND user in members)
success_rate:        SUM(checkins) / SUM(possible_checkins) * 100
```

**TDD:**

```text
- Test: 1 challenge 14 ngày, check-in 12/14 → success_rate = 85.71%
- Test: 3 challenges, 2 completed 1 failed → challenges_completed = 2
- Test: best_streak không giảm khi streak hiện tại giảm
- Test: concurrent recalculate → không race condition (SELECT FOR UPDATE)
```

**Done when:**

- `src/lib/services/userStatsService.ts` export `recalculateUserStats(userId)`
- Lưu vào bảng `user_stats` hoặc JSONB trong `users`

---

## Task 3 — Badge System: Catalog & Auto-award Engine

**Mô tả:** Seed badge catalog và xây dựng engine tự động cấp badge.

**Badge catalog (seed data):**

```sql
INSERT INTO badges VALUES
  ('early-adopter',  'Early Adopter',      'Joined in the first 1000 users',                   '...', 'early_adopter',        1000),
  ('first-checkin',  'First Step',          'Complete your first check-in',                     '...', 'checkins_completed',      1),
  ('streak-7',       'Week Warrior',        'Achieve a 7-day streak',                           '...', 'streak_days',             7),
  ('streak-30',      'Monthly Master',      'Achieve a 30-day streak',                          '...', 'streak_days',            30),
  ('streak-100',     'Century Club',        'Achieve a 100-day streak',                         '...', 'streak_days',           100),
  ('challenge-1',    'First Win',           'Complete your first challenge',                    '...', 'challenges_completed',    1),
  ('challenge-5',    'Challenge Veteran',   'Complete 5 challenges',                            '...', 'challenges_completed',    5),
  ('challenge-10',   'Challenge Legend',    'Complete 10 challenges',                           '...', 'challenges_completed',   10),
  ('squad-mvp',      'Squad MVP',           '100% check-in rate in a completed challenge',      '...', 'squad_mvp',               1);
```

**Award Engine:**

```typescript
async function checkAndAwardBadges(userId: string) {
  const stats = await getUserStats(userId);
  const unowned = await getUnownedBadges(userId);
  for (const badge of unowned) {
    if (checkCondition(badge, stats)) {
      await awardBadge(userId, badge.id);       // INSERT với UNIQUE constraint
      await createNotification(userId, 'badge_earned', { badge });
      await createActivity(userId, 'badge_earned', { badge });
    }
  }
}
```

**TDD:**

```text
- Test: streak 7 lần đầu → badge 'streak-7' awarded
- Test: đã có badge 'streak-7' → không award thêm (UNIQUE constraint)
- Test: complete challenge thứ 5 → badge 'challenge-5' awarded
- Test: concurrent award → chỉ 1 badge được tạo
- Test: badge award tạo notification + activity
```

**Done when:**

- `user_badges(user_id, badge_id)` có UNIQUE constraint
- Engine chạy async (không block response)
- Seed data badges chạy trong migration

---

## Task 4 — GET /api/users/me/activities

**Mô tả:** Danh sách hoạt động gần đây của current user (màn hình H-01).

**Response:**

```json
{
  "activities": [
    {
      "id": "uuid",
      "type": "challenge_completed",
      "metadata": { "challenge_id": "...", "challenge_title": "5AM Warrior" },
      "created_at": "..."
    }
  ],
  "total": 47,
  "page": 1
}
```

**TDD:**

```text
- Test: pagination default 20/page
- Test: sort mới nhất trước
- Test: filter ?type=challenge_completed hoạt động
- Test: không có auth → 401
```

**Done when:**

- Index trên `activities(user_id, created_at DESC)`

---

## Task 5 — PUT /api/users/me/profile

**Mô tả:** Cập nhật display_name, bio, avatar (màn hình H-02). Avatar upload lên **Supabase Storage**.

**Request:** `multipart/form-data`

```text
display_name: string (optional)
bio:          string (optional, max 150 ký tự)
avatar:       File  (optional)
```

**TDD:**

```text
- Test: cập nhật chỉ display_name → avatar không đổi
- Test: upload avatar mới → ảnh cũ xóa khỏi Supabase Storage, URL mới lưu vào DB
- Test: bio > 150 ký tự → 400
- Test: display_name = "" → giữ nguyên giá trị cũ
- Test: cập nhật thành công → trả user object mới
```

**Done when:**

- Supabase Storage cleanup ảnh cũ trước khi upload mới
- Username là read-only, không được phép thay đổi

---

## Task 6 — PUT /api/users/me/settings

**Mô tả:** Cập nhật privacy settings (màn hình H-03). Push notification preferences để sau khi có FCM.

**Request body:**

```json
{ "is_private": false }
```

**TDD:**

```text
- Test: toggle is_private = true → profile không xuất hiện trong search
- Test: toggle is_private = false → profile xuất hiện lại
- Test: field không hợp lệ bị strip
```

**Done when:**

- `is_private` change ảnh hưởng ngay lập tức đến search queries
- Response trả về settings đã cập nhật

---

## Task 7 — POST /api/auth/change-password

**Mô tả:** Đổi mật khẩu khi đã đăng nhập (màn hình H-02).

**Request body:**

```json
{
  "current_password": "OldPass123!",
  "new_password": "NewPass456!"
}
```

**TDD:**

```text
- Test: current_password sai → 401
- Test: new_password giống old_password → 400
- Test: new_password < 8 ký tự → 400
- Test: đổi thành công → tất cả refresh_tokens bị revoke
```

**Done when:**

- Old password verified bằng `bcrypt.compare`
- New password hashed cost 12 trước khi lưu

---

## Task 8 — DELETE /api/users/me

**Mô tả:** Xóa tài khoản vĩnh viễn (màn hình H-03). Xác nhận bằng **mật khẩu hiện tại** (không cần email).

**Request body:**

```json
{ "password": "CurrentPass123!" }
```

**TDD:**

```text
- Test: password sai → 401
- Test: xóa thành công → user.is_active = false (soft delete)
- Test: xóa thành công → tất cả refresh_tokens bị revoke
- Test: xóa thành công → avatar xóa khỏi Supabase Storage
- Test: sau xóa, login bằng account đó → 403
```

**Done when:**

- Soft delete: `is_active = false`, `deleted_at = NOW()`, email/display_name anonymize thành "Deleted User"
- Avatar path xóa khỏi Supabase Storage bucket `avatars`

---

## Task 9 — GET /api/users/me/stats

**Mô tả:** Endpoint nhẹ chỉ trả số liệu stats, dùng cho widget và overview cards.

**Response:**

```json
{
  "current_streak": 12,
  "best_streak": 24,
  "challenges_completed": 5,
  "success_rate": 78.5,
  "active_challenges_count": 2,
  "friends_count": 15
}
```

**TDD:**

```text
- Test: số liệu từ user_stats (pre-aggregated, không JOIN phức tạp)
- Test: active_challenges_count từ challenge_members WHERE status = 'accepted' AND challenge.status = 'active'
- Test: response time < 100ms
```

**Done when:**

- Không có JOIN lồng nhau
- Dùng cho Sprint 8 Widget API

---

## Dependency Map

```text
Sprint 2 (users) → Task 1, 5, 6, 7, 8
Sprint 5 (checkins, badges) → Task 2, 3
Sprint 6 Task 5 (completion) → Task 2 (trigger recalculate)
Task 2 (user stats) → Task 1 (profile dùng stats)
Task 3 (badge engine) → Sprint 5 Task 7 (reuse engine)
Task 9 (lightweight stats) → Sprint 8 (widget API)
```
