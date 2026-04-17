# Sprint 9 — History, Recreate & System Polish

## Sprint Goal
Hoàn thiện vòng đời challenge với màn hình History chi tiết, logic Recreate (tái tạo từ challenge cũ), Streak continuity, và tổng thể polish toàn bộ hệ thống: performance, security audit, error monitoring.

**Screens covered:** G-01 (History Detail), G-02 (Recreate), K-02 (Achievement Pop-ups), K-03 (Confirmation Dialogs)  
**Duration:** 1 tuần  
**Depends on:** Sprint 4, Sprint 5, Sprint 6, Sprint 7

---

## Task 1 — GET /api/challenges/:id/history (Chi tiết lịch sử challenge)

**Mô tả:** Màn hình G-01. Lấy toàn bộ thông tin kết thúc của một challenge đã completed/failed/cancelled. Dùng `final_stats` JSONB đã snapshot từ Sprint 6 để không tính lại từ đầu.

**Response:**
```json
{
  "challenge": {
    "id": "uuid",
    "title": "5AM Warrior",
    "status": "completed",
    "end_reason": "completed",
    "started_at": "2026-04-01T05:00:00Z",
    "ended_at": "2026-04-15T22:00:00Z",
    "duration_days": 14,
    "total_hearts": 4,
    "hearts_remaining": 2,
    "actual_steps_completed": 14
  },
  "result_banner": "CONGRATULATIONS" | "VALIANT_EFFORT" | "CANCELLED",
  "final_stats": {
    "total_checkins": 52,
    "overall_completion_rate": 92.8,
    "danger_zones": [3, 9],
    "top_performer": {
      "user_id": "uuid",
      "username": "maya_z",
      "avatar_url": "...",
      "checkin_count": 14,
      "completion_rate": 100.0
    },
    "member_stats": [
      {
        "user_id": "uuid",
        "username": "cool_user",
        "avatar_url": "...",
        "checkin_count": 12,
        "missed_count": 2,
        "completion_rate": 85.7
      }
    ]
  },
  "gallery_preview": [
    { "evidence_url": "...", "user_id": "...", "cycle_number": 1 }
  ],
  "previous_squadmates": [
    { "user_id": "uuid", "username": "...", "avatar_url": "..." }
  ],
  "parent_challenge_id": null,
  "recreate_eligible": true
}
```

**result_banner logic:**
- `completed` → "CONGRATULATIONS"
- `failed` (out of hearts) → "VALIANT_EFFORT"
- `cancelled` → "CANCELLED"

**TDD:**
```
- Test: challenge đang active hoặc formation → 409 { error: "Challenge not yet finished" }
- Test: user không phải member → 403 (nếu là private challenge)
- Test: final_stats lấy từ challenges.final_stats JSONB (không recalculate)
- Test: gallery_preview trả 6 ảnh mới nhất (thumbnail)
- Test: previous_squadmates lấy từ challenge_members đã accepted
- Test: recreate_eligible = true nếu user là member và challenge completed trong vòng 90 ngày
- Test: result_banner đúng theo end_reason
```

**Done when:**
- `final_stats` null (challenge cũ trước khi có snapshot) → fallback query từ raw data
- Gallery preview chỉ trả 6 ảnh để load nhanh, dùng Task 3 (Sprint 5) cho full gallery

---

## Task 2 — POST /api/challenges/:id/recreate (Tái tạo challenge)

**Mô tả:** Màn hình G-02. Clone một challenge cũ thành challenge mới, giữ nguyên các thông số (có thể override), và kế thừa danh sách squadmates cũ để mời lại.

**Request body:**
```json
{
  "title": "5AM Warrior 2.0",
  "duration_days": 21,
  "start_at": "2026-04-25T05:00:00Z",
  "reset_time": "22:00:00",
  "total_hearts": 3,
  "max_members": 5,
  "is_private": false,
  "reinvite_user_ids": ["uuid-1", "uuid-2"],
  "new_goal": "This time we won't miss a single day!"
}
```

*(Nếu field không được gửi lên → inherit từ challenge cũ)*

**Response:** `201 { challenge: { ...new challenge... } }`

**TDD:**
```
- Test: challenge cũ phải là completed/failed/cancelled → nếu active/formation → 409
- Test: user phải là member của challenge cũ → 403 nếu không phải
- Test: challenge mới có parent_challenge_id = challenge cũ
- Test: reinvite_user_ids chứa user không phải bạn của creator → 400 (chỉ invite bạn)
- Test: reinvite_user_ids chứa user không phải member cũ → cảnh báo hoặc skip (quyết định: skip silently)
- Test: tạo thành công → notification 'challenge_invite' gửi cho reinvite_user_ids
- Test: title không gửi lên → dùng title cũ
- Test: start_at trong quá khứ → 400
```

**Done when:**
- Logic clone: copy tất cả fields từ challenge cũ, override bằng request body
- `parent_challenge_id` set để tracking Streak Continuity (Task 3)
- Creator tự động là host, accepted, is_ready = false

---

## Task 3 — Streak Continuity (Master Streak)

**Mô tả:** Khi user recreate challenge trong vòng 24h sau khi challenge cũ kết thúc, hệ thống nối dài "master streak" (chuỗi kỷ lục cá nhân liên tiếp qua nhiều challenges).

**Logic:**
```typescript
async function checkStreakContinuity(userId: string, newChallengeId: string) {
  const newChallenge = await getChallenge(newChallengeId);
  if (!newChallenge.parent_challenge_id) return;
  
  const parentChallenge = await getChallenge(newChallenge.parent_challenge_id);
  const parentEndedAt = parentChallenge.ended_at;
  const timeSinceEnd = Date.now() - new Date(parentEndedAt).getTime();
  
  if (timeSinceEnd <= 24 * 60 * 60 * 1000) {
    // Eligible for streak continuity
    // When new challenge starts, inherit parent's streak for this user
    const parentStreak = await getUserStreakInChallenge(userId, parentChallenge.id);
    await setInitialStreak(userId, newChallengeId, parentStreak);
  }
}
```

**TDD:**
```
- Test: recreate trong 24h → streak kế thừa từ challenge cũ
- Test: recreate sau 25h → streak bắt đầu từ 0
- Test: user không phải member của challenge cũ → không kế thừa
- Test: challenge cũ chưa kết thúc → không thể kế thừa
```

**Done when:**
- `best_streak` trong user_stats được cập nhật nếu master streak vượt qua best_streak cũ
- Logic này chạy khi challenge mới chuyển sang Active (Sprint 6 Task 2)

---

## Task 4 — GET /api/users/me/challenges/history (Danh sách challenges đã qua)

**Mô tả:** Trang History tab trong D-01. Lấy danh sách tất cả challenges đã kết thúc của current user với lifetime stats.

**Response:**
```json
{
  "lifetime_stats": {
    "success_rate": 78.5,
    "best_streak": 24,
    "total_challenges": 8,
    "total_completed": 5
  },
  "challenges": [
    {
      "id": "uuid",
      "title": "5AM Warrior",
      "status": "completed",
      "end_reason": "completed",
      "started_at": "...",
      "ended_at": "...",
      "actual_steps_completed": 14,
      "total_steps": 14,
      "hearts_remaining": 2,
      "top_performer_username": "maya_z",
      "member_count": 4,
      "has_child_challenge": true
    }
  ],
  "total": 8,
  "page": 1
}
```

**TDD:**
```
- Test: chỉ trả challenges đã kết thúc (completed, failed, cancelled)
- Test: filter theo end_reason: `?result=success|game_over|cancelled`
- Test: lifetime_stats từ user_stats (pre-aggregated, không tính live)
- Test: has_child_challenge = true nếu có challenge với parent_challenge_id = this id
- Test: sort: gần nhất trước
```

**Done when:**
- Lifetime stats không recalculate từ raw data, dùng user_stats
- Index: `challenge_members(user_id) + challenges(status, ended_at DESC)` cho query nhanh

---

## Task 5 — Achievement System: Milestone Pop-ups (K-02)

**Mô tả:** Backend cung cấp event triggers cho frontend hiển thị achievement pop-ups. Khi đạt milestone streak hoặc badge, event được đưa vào notification + sync queue.

**Streak milestones:** 7, 14, 30, 60, 100, 365 ngày

**Logic khi milestone đạt:**
```
1. Tạo notification type 'streak_milestone' với metadata { days: 30 }
2. Tạo activity 'streak_milestone'
3. Đưa vào shown_at = NULL trong notifications (sẽ xuất hiện qua /api/sync)
4. Gửi push notification: "🔥 You've reached a 30-day streak! Incredible!"
```

**TDD:**
```
- Test: streak 7 → milestone notification tạo
- Test: streak 8 → không tạo milestone (chỉ trigger tại đúng con số milestone)
- Test: milestone đã trigger trước đó không trigger lại (check notifications history)
- Test: milestone notification xuất hiện trong /api/sync khi user mở app
```

**Done when:**
- `checkStreakMilestone(userId, currentStreak)` được gọi sau mỗi checkin (Sprint 5 Task 7 gọi thêm function này)
- Milestone check: `[7, 14, 30, 60, 100, 365].includes(streak)`
- Unique: không gửi 2 lần cho cùng milestone (check notifications table)

---

## Task 6 — Confirmation Dialog Backend Support (K-03)

**Mô tả:** Một số actions nguy hiểm (delete challenge, leave squad) cần confirmation từ user. Backend đảm bảo double-check thay vì tin tưởng client đơn giản.

**Endpoints cần confirmation token:**

`POST /api/challenges/:id/delete-confirm` → trả `{ confirmation_token: "..." }` (expire 5 phút)
`DELETE /api/challenges/:id?confirmation_token=...` → thực hiện xóa

*(Tương tự cho delete account đã có ở Sprint 7 Task 8)*

**TDD:**
```
- Test: DELETE mà không có confirmation_token → 400 { error: "Confirmation required" }
- Test: confirmation_token hết hạn → 400
- Test: confirmation_token dùng 2 lần → 400 (một lần dùng xong, revoke)
- Test: confirmation_token đúng → action thực hiện
```

**Done when:**
- Confirmation tokens lưu in-memory (Map) hoặc trong DB với TTL
- Không cần table riêng, dùng `refresh_tokens` table với type='confirmation' (hoặc Map nhỏ)

---

## Task 7 — Performance: Query Optimization Pass

**Mô tả:** Review toàn bộ các endpoint, xác định và fix N+1 queries, missing indexes, và slow queries.

**Checklist:**
```
□ EXPLAIN ANALYZE trên top 10 queries phức tạp nhất
□ Đảm bảo không có query trong vòng lặp (N+1)
□ Add missing indexes (kiểm tra qua pg_stat_user_indexes)
□ Challenge list query: single JOIN thay vì multiple queries
□ Notification list: index đủ để pagination < 50ms
□ Profile page: stats từ pre-aggregated table, không live count
□ Friend search: ILIKE với index GIN/pg_trgm nếu cần
```

**TDD:**
```
- Test: GET /api/challenges với 1000 challenges → response < 200ms
- Test: GET /api/notifications với 500 notifications → response < 100ms
- Test: GET /api/users/search?q=a → response < 150ms
- Test: POST /api/challenges/:id/checkins → response < 1000ms (bao gồm upload)
```

**Done when:**
- Không có query nào trả về > 100 rows mà không có pagination
- pg_trgm extension enabled cho text search nếu cần
- Tất cả foreign keys có index tương ứng

---

## Task 8 — Security Audit

**Mô tả:** Review toàn bộ endpoints cho các lỗ hổng bảo mật phổ biến.

**Checklist:**
```
□ IDOR (Insecure Direct Object Reference): mỗi endpoint có check user ownership
□ SQL Injection: tất cả query dùng parameterized ($1, $2), không string concat
□ Rate limiting: auth endpoints (signin, signup, forgot-password)
□ JWT: access token 15 min, refresh token 30 ngày, rotation on refresh
□ Password: bcrypt cost 12, không log password dù 1 char
□ File upload: validate MIME type server-side (không trust Content-Type header)
□ Sensitive data: email, password_hash không xuất hiện trong response
□ CORS: chỉ cho phép domain của app
□ Headers: X-Content-Type-Options, X-Frame-Options
```

**TDD:**
```
- Test: user A cố xem/edit challenge của user B (non-member) → 403
- Test: upload file có MIME image/jpeg nhưng content thực sự là .exe → 400 (magic bytes check)
- Test: signin 10 lần sai liên tiếp → 429 Too Many Requests
- Test: API trả response không bao giờ có field password_hash
- Test: SQL: truyền `'; DROP TABLE users; --` vào search query → không xảy ra gì
```

**Done when:**
- Rate limiting trên: `/api/auth/signin`, `/api/auth/signup`, `/api/auth/forgot-password`
- File upload validate magic bytes (sử dụng `file-type` package)
- Tất cả Zod schemas strip extra fields (`.strict()` hoặc `.strip()`)

---

## Task 9 — Error Monitoring & Observability

**Mô tả:** Tích hợp error tracking và structured logging để debug production issues.

**Setup:**
- `Sentry` hoặc `@sentry/nextjs` cho error tracking
- Structured logging với `pino` (JSON format, Railway-compatible)
- Health endpoint mở rộng: `/api/health` trả DB status, memory usage

**Log format:**
```json
{
  "level": "info",
  "timestamp": "2026-04-22T10:00:00Z",
  "request_id": "uuid",
  "method": "POST",
  "path": "/api/challenges/uuid/checkins",
  "user_id": "uuid",
  "duration_ms": 245,
  "status": 201
}
```

**TDD:**
```
- Test: uncaught exception → ghi vào Sentry + log error level
- Test: 4xx errors → log warn level, không ghi Sentry
- Test: 5xx errors → log error level, ghi Sentry với user context
- Test: GET /api/health → trả { db: 'ok', uptime: 12345, memory: '45MB' }
- Test: GET /api/health khi DB down → trả { db: 'error' } với status 503
```

**Done when:**
- Mỗi request có `request_id` unique (từ `crypto.randomUUID()`)
- User ID được attach vào Sentry context cho authenticated requests
- Railway logs stream JSON có thể được filter/search

---

## Dependency Map

```
Sprint 6 Task 6 (final_stats snapshot) → Task 1 (history detail đọc snapshot)
Sprint 4 (challenges) → Task 2 (recreate clone logic)
Task 2 (recreate) → Task 3 (streak continuity)
Sprint 7 Task 2 (user stats) → Task 4 (lifetime stats)
Sprint 5 Task 7 (badge check) → Task 5 (streak milestone check cùng flow)
Sprint 1 Task 5 (error handler) → Task 8 (security), Task 9 (observability)
Task 7 (performance) → cần Sprint 1-8 hoàn thành để biết bottleneck thực tế
```

---

## Tổng kết toàn bộ Sprint Plan

| Sprint | Chủ đề | Screens | Duration |
|--------|--------|---------|----------|
| 1 | Foundation & Database | - | 1 tuần |
| 2 | Auth & Onboarding | B-06, B-07, B-08 | 1 tuần |
| 3 | Friends & Social | C-05, C-06 | 1 tuần |
| 4 | Challenge Core (Create, Formation, Invite) | D-02, D-03, E-01, E-02 | 1.5 tuần |
| 5 | Active Challenge & Check-in | F-01, F-02, F-03 | 1 tuần |
| 6 | Cron Jobs & Game Logic | D-01 backend | 1 tuần |
| 7 | Profile & Gamification | H-01, H-02, H-03 | 1 tuần |
| 8 | Notifications & Real-time | J-01, J-02, K-01 | 1 tuần |
| 9 | History, Recreate & Polish | G-01, G-02, K-02, K-03 | 1 tuần |
| **Tổng** | | **11 màn hình chính** | **~9.5 tuần** |
