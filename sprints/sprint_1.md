# Sprint 1 — Foundation & Database Setup

## Sprint Goal
Dựng nền tảng hoàn chỉnh: cấu trúc project Next.js, kết nối PostgreSQL (Railway Plugin), toàn bộ schema DB, middleware cốt lõi, và pipeline deploy Railway — để mọi sprint sau có thể build on top mà không cần sờ vào infra.

**Duration:** 1 tuần  
**Team:** Backend

---

## Task 1 — Cấu trúc project Next.js API-only

**Mô tả:** Tổ chức thư mục `src/app/api/` theo domain (auth, users, friends, challenges, notifications). Thiết lập TypeScript strict mode, path aliases, eslint/prettier.

**TDD:**
```
- Test: import resolver không báo lỗi alias path
- Test: `GET /api/health` trả 200 JSON { status: "ok", timestamp }
- Test: request với method không hỗ trợ trả 405
```

**Done when:**
- `src/app/api/health/route.ts` hoạt động và trả `200`
- Path alias `@/lib/*` resolve đúng
- `npm run build` không có lỗi TypeScript

---

## Task 2 — Kết nối PostgreSQL (Railway Plugin)

**Mô tả:** Dùng thư viện `postgres` (hoặc `pg` + `node-postgres`) để kết nối vào PostgreSQL do Railway Plugin cung cấp. Railway tự inject `DATABASE_URL` vào environment khi add PostgreSQL plugin.

**TDD:**
```
- Test: pool.connect() không throw exception khi env DATABASE_URL hợp lệ
- Test: `SELECT 1` trả về kết quả đúng
- Test: connection pool đóng gracefully khi server shutdown
```

**Done when:**
- File `src/lib/db.ts` export `query(sql, params)` wrapper
- `.env.local` có `DATABASE_URL` trỏ vào Railway PostgreSQL (hoặc local PostgreSQL cho dev)
- Connection pool được reuse giữa các request (không tạo mới mỗi lần)

---

## Task 3 — Toàn bộ Database Schema (Migrations)

**Mô tả:** Viết file migration SQL tạo tất cả bảng cần thiết cho toàn bộ app. Dùng `node-pg-migrate` hoặc file SQL thủ công chạy một lần.

**Các bảng cần tạo:**

```sql
-- Auth & Users (email/password only, no OAuth)
users (id UUID PK, email UNIQUE NOT NULL, password_hash TEXT NOT NULL, username UNIQUE NOT NULL, display_name TEXT, avatar_url TEXT, bio TEXT, is_active BOOL DEFAULT true, is_private BOOL DEFAULT false, terms_agreed_at TIMESTAMP, created_at, updated_at)

-- Friends
friend_requests (id UUID PK, sender_id FK users, receiver_id FK users, status ENUM('pending','accepted','declined'), created_at)

-- Challenges
challenges (id UUID PK, title TEXT NOT NULL, description TEXT, cover_url TEXT, creator_id FK users, duration_days INT, frequency ENUM('daily','custom'), frequency_days JSONB, start_at TIMESTAMP, reset_time TIME, total_hearts INT, max_members INT, is_private BOOL DEFAULT false, status ENUM('formation','active','completed','failed','cancelled'), current_step INT DEFAULT 0, hearts_left INT, last_processed_cycle INT DEFAULT 0, parent_challenge_id UUID NULLABLE FK challenges, end_reason ENUM('completed','out_of_hearts','host_cancelled') NULLABLE, final_stats JSONB NULLABLE, created_at, updated_at)

-- Challenge Members
challenge_members (id UUID PK, challenge_id FK challenges, user_id FK users, role ENUM('host','member'), status ENUM('invited','accepted','declined'), is_ready BOOL DEFAULT false, current_step INT DEFAULT 0, joined_at TIMESTAMP, created_at)

-- Check-ins
checkins (id UUID PK, challenge_id FK challenges, user_id FK users, cycle_number INT, evidence_url TEXT, caption TEXT, checked_in_at TIMESTAMP, created_at)

-- Badges
badges (id UUID PK, name TEXT, description TEXT, icon_url TEXT, condition_type ENUM('challenges_completed','streak_days','early_adopter'), condition_value INT)

user_badges (id UUID PK, user_id FK users, badge_id FK badges, earned_at TIMESTAMP)

-- Activities
activities (id UUID PK, user_id FK users, type ENUM('challenge_joined','challenge_completed','friend_added','badge_earned','checkin_done'), metadata JSONB, created_at)

-- Notifications (in-app only — push notification để sau)
notifications (id UUID PK, user_id FK users, type ENUM('friend_request','friend_accepted','challenge_invite','challenge_start','heart_lost','badge_earned','nudge'), metadata JSONB, is_read BOOL DEFAULT false, shown_at TIMESTAMP NULLABLE, created_at)

-- Refresh tokens (JWT rotation)
refresh_tokens (id UUID PK, user_id FK users, token_hash TEXT, expires_at TIMESTAMP, revoked_at TIMESTAMP NULLABLE, created_at)
```

**TDD:**
```
- Test: migration chạy không có lỗi SQL
- Test: rollback migration không để lại orphan tables
- Test: tất cả FK constraints đúng (insert orphan record bị reject)
- Test: UNIQUE constraints hoạt động (insert duplicate email bị reject)
```

**Done when:**
- Tất cả bảng tồn tại trong Railway PostgreSQL
- Indexes tạo trên: `users.email`, `users.username`, `challenge_members(challenge_id, user_id)`, `checkins(challenge_id, user_id, cycle_number)`, `notifications(user_id, is_read)`, `friend_requests(receiver_id, status)`
- Script `npm run db:migrate` chạy idempotent

---

## Task 4 — Environment & Config Management

**Mô tả:** Cấu hình tất cả env variables, validate chúng khi startup bằng `zod`, tránh app start với config thiếu.

**Env variables cần thiết:**

```
DATABASE_URL          # Railway tự inject khi add PostgreSQL plugin
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
CRON_SECRET
APP_BASE_URL
NODE_ENV
```

**TDD:**
```
- Test: app throw lỗi rõ ràng nếu DATABASE_URL không có
- Test: config object export đúng type
```

**Done when:**
- File `src/lib/config.ts` parse và validate env bằng zod
- App crash ngay khi start nếu thiếu required env
- `.env.example` có đầy đủ key (không có value)

---

## Task 5 — Middleware: Auth Guard & Error Handler

**Mô tả:** Tạo HOF `withAuth(handler)` wrap route handler, tự động verify JWT và inject `req.user`. Tạo global error handler chuẩn hóa response lỗi.

**TDD:**
```
- Test: request không có Bearer token → 401 { error: "Unauthorized" }
- Test: request có token hết hạn → 401 { error: "Token expired" }
- Test: request có token hợp lệ → handler được gọi với user đúng
- Test: handler throw Error("Validation") → 400 response
- Test: handler throw Error("Not found") → 404 response
- Test: handler throw lỗi không xác định → 500 response, không leak stack trace
```

**Done when:**
- `src/lib/middleware/withAuth.ts` hoạt động
- `src/lib/middleware/errorHandler.ts` wrap tất cả response lỗi về format `{ error: string, code?: string }`
- Production mode không trả về stack trace

---

## Task 6 — Input Validation (Zod schemas)

**Mô tả:** Định nghĩa Zod schema cho tất cả request body/query params của từng domain. Tạo helper `validate(schema, data)` trả về parsed data hoặc throw 400.

**TDD:**
```
- Test: username "abc" (3 chars) bị reject
- Test: username "valid_user123" (13 chars) được chấp nhận
- Test: email không hợp lệ bị reject
- Test: password dưới 8 ký tự bị reject
- Test: trường thừa (extra fields) bị strip, không trả về trong response
```

**Done when:**
- `src/lib/schemas/` có schema file cho mỗi domain
- `validate()` helper trả lỗi field-level rõ ràng: `{ field: "username", message: "Must be 4-20 characters" }`

---

## Task 7 — Railway Deployment Setup

**Mô tả:** Cấu hình Railway để tự động deploy từ Git push. Tạo `railway.json` hoặc `Procfile`, đảm bảo build Next.js standalone hoạt động.

**TDD:**
```
- Test: `npm run build` thành công (zero TypeScript errors)
- Test: `npm start` sau build khởi động server đúng port
- Test: Health endpoint `/api/health` trả 200 sau deploy
```

**Done when:**
- Railway project được link với repo
- Push lên `main` tự động trigger deploy
- Environment variables được set trong Railway dashboard
- Custom domain hoặc Railway URL hoạt động

---

## Dependency Map

```
Task 2 (DB Connection) → Task 3 (Schema)
Task 3 (Schema) → Task 6 (Zod schemas)  
Task 4 (Config) → Task 2, Task 5
Task 5 (Middleware) → Tất cả sprint sau
Task 7 (Railway) → Task 1, Task 4
```
