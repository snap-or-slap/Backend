# SOS App — Project Guidelines

> **QUAN TRỌNG cho AI session mới:** Đọc hết file này trước khi làm bất cứ điều gì. Các sprint plan trong `sprints/` chỉ là tài liệu tham khảo thiết kế — **không phải source of truth**. Workflow thực tế, cách tương tác DB, cách deploy đều ở đây.

---

## Workflow thực tế (Đã kiểm chứng)

### ⚠️ Đừng tin sprint plan một cách mù quáng

Sprint plans trong `sprints/*.md` mô tả ý định thiết kế, không phải trạng thái hiện tại của code. Trước khi làm bất kỳ task nào:

1. **Đọc code thực tế** — `src/` là source of truth
2. **Chạy tests** — `npm test` để biết cái gì đang hoạt động
3. **Kiểm tra Railway vars** — `railway variable list` để biết env thực tế
4. Sprint plan có thể outdated, có thể sai — luôn ưu tiên code đang chạy

---

## Backend

### Tech Stack

#### Runtime & Framework

- **Next.js** (App Router) — API routes tại `src/app/api/`. Không dùng Pages Router.
- **TypeScript** — strict mode bật. Không dùng `any`, không tắt type check.
- **Node.js** — phiên bản LTS mới nhất theo Railway.

#### Database

- **PostgreSQL** — host trên **Railway** (PostgreSQL Plugin). **Không dùng Supabase.**
- Kết nối qua `DATABASE_URL` bằng thư viện `pg`.
- Railway tự inject `DATABASE_URL` (internal) khi Backend và Postgres cùng project.
- Migration chạy thủ công: `npm run db:migrate`.

#### File Storage

- **Railway Volume** hoặc **S3-compatible storage** (Cloudflare R2 / AWS S3) — lưu ảnh avatar và check-in evidence.
- Lưu path vào DB, không lưu full URL cứng.
- Tính năng file storage sẽ được cấu hình chi tiết trong sprint sau.

#### Auth & Security

- JWT tự cấp: access token 15 phút, refresh token 30 ngày với rotation.
- Password hash bằng **bcrypt** (cost factor 12).
- Chỉ hỗ trợ đăng nhập Email/Password — không dùng Google OAuth hay bất kỳ OAuth nào.

#### Real-time

- **Socket.io** attach vào custom Next.js server (`server.ts`).
- Rooms theo `challenge:{id}` để broadcast events trong squad.

#### Background Jobs

- **Railway Cron** gọi HTTP endpoint `/api/crons/[jobName]` theo lịch.
- Endpoint bảo vệ bằng `CRON_SECRET` header.
- Tất cả jobs phải **idempotent**.

#### Validation

- **Zod** cho tất cả request body và query params.
- Validate env variables khi startup bằng Zod (fail fast nếu thiếu).

#### Tính năng chưa làm (để sau)

- Push Notification (Firebase FCM) — defer sang giai đoạn sau.
- Email (forgot-password, delete-account confirmation) — defer sang giai đoạn sau.

---

## Kết nối Database Railway (Thực tế)

### Cấu trúc kết nối

Railway PostgreSQL plugin cung cấp 2 loại URL:

| URL | Dùng khi nào |
|-----|-------------|
| `postgres.railway.internal:5432/railway` | Backend service trên Railway (internal, không cần SSL) |
| `nozomi.proxy.rlwy.net:PORT/railway` | Kết nối từ máy local / migration local |

### File `src/lib/db.ts` — Pattern chuẩn

```typescript
import { Pool, QueryResult, QueryResultRow } from 'pg';

const isInternalConnection = process.env.DATABASE_URL?.includes('.railway.internal');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: isInternalConnection ? false : { rejectUnauthorized: false },
});
```

- Internal URL (`*.railway.internal`) → **KHÔNG dùng SSL**
- External/public URL → `ssl: { rejectUnauthorized: false }`
- Sai SSL config = connection bị treo hoặc fail

### Lấy Railway PostgreSQL credentials

```powershell
# Xem vars của Postgres service
railway variable list -s Postgres

# Kết quả quan trọng:
# DATABASE_URL          = postgresql://...@postgres.railway.internal:5432/railway  (internal)
# DATABASE_PUBLIC_URL   = postgresql://...@nozomi.proxy.rlwy.net:PORT/railway       (public)
```

### Chạy migration từ máy local

```powershell
# Dùng public URL (vì local không access được internal)
$env:DATABASE_URL="postgresql://postgres:PASSWORD@nozomi.proxy.rlwy.net:PORT/railway"
npx ts-node -P tsconfig.migrate.json src/lib/db/migrate.ts
```

> **Không dùng** `npx ts-node src/lib/db/migrate.ts` (thiếu `-P tsconfig.migrate.json` → lỗi `__dirname is not defined`)

### Set DATABASE_URL cho Backend service

```powershell
# Set internal URL cho Backend (không có SSL overhead)
railway variable set "DATABASE_URL=postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway" -s Backend
```

---

## Environment Variables

### Required (validate bằng Zod khi startup)

```
DATABASE_URL          # Railway tự inject — internal URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
CRON_SECRET
APP_BASE_URL
NODE_ENV
```

### Không còn dùng (đã xóa)

- ~~`SUPABASE_URL`~~ — không dùng Supabase
- ~~`SUPABASE_SERVICE_ROLE_KEY`~~ — không dùng Supabase
- ~~`DIRECT_URL`~~ — không cần, chỉ cần `DATABASE_URL`
- ~~`PORT`~~ (manual) — **KHÔNG set PORT trong Railway**, để Railway tự assign

### Xem/sửa Railway env vars

```powershell
railway variable list                          # Xem tất cả vars của service hiện tại
railway variable list -s Postgres             # Xem vars của Postgres service
railway variable set "KEY=value" -s Backend   # Set var cho Backend
railway variable delete KEY                   # Xóa var
```

---

## Deployment & CI/CD

### Platform

- Deploy trên **Railway** — mỗi push lên `main` trigger deploy tự động.
- Build config: `railway.toml`
- **Không set PORT thủ công** — Railway tự assign, server lắng nghe `0.0.0.0`

### `railway.toml` — Cấu hình chuẩn

```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "HOSTNAME=0.0.0.0 node .next/standalone/server.js"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
```

- `HOSTNAME=0.0.0.0` bắt buộc — Next.js standalone mặc định bind `localhost` (không accessible từ ngoài)
- Không dùng `npm start` làm startCommand — dùng trực tiếp `node .next/standalone/server.js`

### CI/CD Flow thực tế

```text
npm test                    ← Chạy trước khi push, phải pass hết
git add -A
git commit -m "feat: ..."
git pull --rebase origin main   ← Luôn pull trước khi push để tránh conflict
git push origin main
    ↓
Railway detect push → trigger build (~80-100 giây)
    ↓
npm ci → npm run build (TypeScript + Next.js)
    ↓
Healthcheck: GET /api/health phải trả 200
    ↓
Deploy live
```

### Kiểm tra sau deploy

```powershell
# Xem build logs
railway logs --build | Select-Object -Last 20

# Xem runtime logs
railway logs | Out-String

# Test health endpoint
Invoke-RestMethod "https://backend-production-2ba1.up.railway.app/api/health"
# → { status: "ok", uptime: 60.x }
```

### Xử lý lỗi 502

502 thường do một trong các nguyên nhân sau:

| Nguyên nhân | Cách fix |
|---|---|
| `PORT` được set cứng trong Railway vars | `railway variable delete PORT` |
| Thiếu `HOSTNAME=0.0.0.0` trong startCommand | Thêm vào `railway.toml` |
| `DATABASE_URL` sai → app crash khi start | Kiểm tra `railway variable list`, đặt đúng URL |
| SSL config sai với Railway internal DB | Xem pattern `isInternalConnection` ở trên |

### Branching

- `main` — production. Chỉ merge khi tests pass.
- Feature branch: `feat/sprint-X-task-name`.
- Không force push lên `main`.

### Health Check

- `GET /api/health` trả `{ status: "ok", db: "ok", uptime: number }`.
- Railway dùng endpoint này để xác nhận deploy thành công.
- Nếu DB down → trả `503 { status: "error", db: "error" }`.

---

## Android

### Android Tech Stack

#### Language & UI

- **Kotlin** — ngôn ngữ duy nhất, không dùng Java. Không dùng Expo/React Native.
- **Jetpack Compose** — toàn bộ UI viết bằng Compose, không dùng XML layout.
- **Material 3** — design system.

#### Architecture

- **MVVM + Clean Architecture**: `UI Layer → ViewModel → UseCase → Repository → DataSource`.
- Mỗi feature là một package riêng: `feature/auth`, `feature/challenge`, `feature/profile`...
- Không đặt logic trong Composable — chỉ nhận state và emit events.

#### Networking

- **Retrofit 2** + **OkHttp** — gọi REST API backend.
- **Gson** (hoặc **Moshi**) để parse JSON.
- Interceptor tự động đính kèm `Authorization: Bearer {access_token}` vào mọi request.
- Tự xử lý token refresh: nếu nhận 401 → gọi `/api/auth/refresh` → retry request gốc.

#### Dependency Injection

- **Hilt** — inject ViewModel, Repository, Retrofit client.

#### Async

- **Coroutines + Flow** — không dùng RxJava.
- `StateFlow` cho UI state, `SharedFlow` cho one-time events (navigate, toast).

#### Real-time (Android)

- **Socket.io Android client** (`io.socket:socket.io-client`) — kết nối WebSocket với backend.

#### Push Notifications (Android)

- **Tính năng để sau** — sẽ dùng Firebase Cloud Messaging (FCM) khi đến giai đoạn đó.

#### Image Loading

- **Coil** — load và cache ảnh từ server URL (avatar, check-in gallery).

#### Local Storage

- **DataStore** (Preferences) — lưu access token, refresh token, user ID.
- Không dùng SharedPreferences.

#### Navigation

- **Navigation Compose** — single-activity, nhiều Composable destinations.

### Android Build & Release

#### Build Tool

- **Gradle (Kotlin DSL)** — file `build.gradle.kts`.
- `minSdk = 26` (Android 8.0), `targetSdk = 35`.

#### Signing & Release

- Debug build dùng cho local dev.
- Release build ký bằng keystore — không commit keystore lên Git.

---

## TDD là bắt buộc

Mỗi task Developer phải theo đúng chu kỳ:

1. Viết test → chạy → **FAIL** (red)
2. Viết implementation → chạy → **PASS** (green)
3. Không bao giờ viết code trước test

- Luôn chạy test để confirm FAIL trước khi viết code
- Luôn chạy lại để confirm PASS sau khi viết code
- Luôn viết thêm smoke test vào file `docs/smoke-test-guide.md`
