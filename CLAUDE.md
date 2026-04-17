# SOS App — Project Guidelines

---

## Backend

### Tech Stack

#### Runtime & Framework

- **Next.js** (App Router) — API routes tại `src/app/api/`. Không dùng Pages Router.
- **TypeScript** — strict mode bật. Không dùng `any`, không tắt type check.
- **Node.js** — phiên bản LTS mới nhất theo Railway.

#### Database

- **PostgreSQL** — host trên **Supabase** (chỉ dùng như DB thuần túy).
- Kết nối qua **connection string** (`DATABASE_URL`) bằng thư viện `postgres` (hoặc `pg`).
- **Không dùng** supabase-js client, Supabase Auth, Supabase Realtime — tất cả logic phải tự code.
- Migration chạy thủ công bằng script SQL (`npm run db:migrate`).

#### File Storage

- **Supabase Storage** — lưu ảnh avatar và check-in evidence.
- Dùng Supabase Storage REST API trực tiếp (không dùng supabase-js client).
- Lưu path vào DB, không lưu full URL cứng.

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

### Deployment & CI/CD

#### Platform

- Deploy trên **Railway** — mỗi push lên `main` trigger deploy tự động.
- Build: `npm run build` → Next.js standalone output.
- Start: `npm start` trên port `$PORT` (Railway inject tự động).

#### Environment Variables

- Quản lý trong **Railway Dashboard** (không commit `.env` lên Git).
- File `.env.example` trong repo chứa đủ key nhưng không có value.
- Local dev dùng `.env.local` (đã có trong `.gitignore`).

#### CI/CD Flow

```text
git push origin main
    ↓
Railway detect push → trigger build
    ↓
npm ci → npm run build (TypeScript compile + Next.js build)
    ↓
Health check: GET /api/health phải trả 200
    ↓
Deploy live (zero-downtime rolling deploy)
```

#### Branching

- `main` — production. Chỉ merge khi tests pass.
- Feature branch: `feat/sprint-X-task-name`.
- Không force push lên `main`.

#### Health Check

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

- **Coil** — load và cache ảnh từ Supabase Storage URL (avatar, check-in gallery).

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
