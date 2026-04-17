# Sprint 2 — Authentication & Onboarding

## Sprint Goal
Hoàn thiện luồng Auth thuần email/password: đăng ký, đăng nhập, JWT rotation, hoàn thiện profile với avatar upload lên Supabase Storage. Không có Google OAuth, không có email service.

**Screens covered:** B-06 (Sign In, Sign Up), B-07 (Complete Profile)
**Duration:** 1 tuần
**Depends on:** Sprint 1 hoàn thành

---

## Task 1 — POST /api/auth/signup

**Mô tả:** Tạo tài khoản mới bằng email + password + username. Hash password bằng `bcrypt` (cost factor 12).

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "Min8chars!",
  "username": "cool_user",
  "terms_agreed": true
}
```

**Response:** `201 { user: { id, email, username }, access_token, refresh_token }`

**TDD:**
```
- Test: email đã tồn tại → 409 { error: "Email already registered" }
- Test: username đã tồn tại → 409 { error: "Username already taken" }
- Test: username < 4 ký tự → 400 validation error
- Test: username có ký tự đặc biệt (trừ _) → 400 validation error
- Test: terms_agreed = false → 400 error
- Test: đăng ký thành công → password_hash trong DB khác plain password
- Test: đăng ký thành công → trả về access_token và refresh_token
- Test: đăng ký thành công → user.is_active = true trong DB
```

**Done when:**

- Password KHÔNG bao giờ xuất hiện trong response hay log
- Tạo activity log: `{ type: 'account_created' }`

---

## Task 2 — GET /api/auth/check-username?username=xxx

**Mô tả:** Endpoint nhẹ để frontend gọi debounce khi người dùng đang gõ username. Không yêu cầu auth.

**Response:** `200 { available: true | false }`

**TDD:**
```
- Test: username chưa tồn tại → { available: true }
- Test: username đã tồn tại → { available: false }
- Test: username không hợp lệ (format sai) → 400
- Test: không có query param → 400
- Test: endpoint trả về trong < 100ms
```

**Done when:**
- Query chỉ hit index `users.username`, không full scan

---

## Task 3 — POST /api/auth/signin

**Mô tả:** Đăng nhập bằng email + password. Verify password hash bằng `bcrypt.compare`. Trả về JWT pair.

**Request body:**
```json
{ "email": "user@example.com", "password": "Min8chars!" }
```

**Response:** `200 { user: { id, email, username, display_name, avatar_url }, access_token, refresh_token }`

**TDD:**
```
- Test: email không tồn tại → 401 { error: "Invalid credentials" }
- Test: password sai → 401 { error: "Invalid credentials" }
- Test: tài khoản is_active = false → 403 { error: "Account disabled" }
- Test: đăng nhập thành công → access_token hết hạn sau 15 phút
- Test: đăng nhập thành công → refresh_token được lưu hash trong DB
```

**Done when:**
- Thời gian response đồng đều cho cả email-sai và password-sai (tránh timing attack)
- `refresh_token` lưu dưới dạng hash SHA-256, không plaintext

---

## Task 4 — POST /api/auth/refresh

**Mô tả:** Cấp lại `access_token` mới từ `refresh_token` còn hiệu lực.

**Request body:** `{ "refresh_token": "..." }`

**TDD:**
```
- Test: refresh_token hợp lệ → trả access_token mới
- Test: refresh_token đã bị revoke → 401
- Test: refresh_token hết hạn → 401
- Test: refresh_token không tồn tại trong DB → 401
- Test: sau khi refresh, refresh_token cũ bị revoke (rotation)
```

**Done when:**

- Token hash match dùng `crypto.timingSafeEqual`
- Refresh token rotation: token cũ bị revoke, token mới được cấp

---

## Task 5 — POST /api/auth/signout

**Mô tả:** Revoke refresh token hiện tại.

**Request:** Bearer token required
**Body:** `{ "refresh_token": "..." }`

**TDD:**
```
- Test: revoke thành công → refresh_token record có revoked_at timestamp
- Test: dùng refresh_token đã revoke → 401
- Test: không có Bearer token → 401
```

**Done when:**

- Sau logout, refresh_token bị revoke, access_token tự hết hạn sau 15 phút

---

## Task 6 — POST /api/auth/profile/complete

**Mô tả:** Bước "Complete Profile" (màn hình B-07). Update `display_name` và upload avatar lên **Supabase Storage**. Bắt buộc auth.

**Request:** `multipart/form-data`
```
display_name: string (required)
avatar: File (optional — skip photo allowed)
```

**TDD:**
```
- Test: display_name hợp lệ, không có file → cập nhật display_name thành công
- Test: display_name + file JPEG hợp lệ → upload lên Supabase Storage, lưu avatar_url
- Test: file > 5MB → 400 { error: "File too large" }
- Test: file không phải image (e.g. .exe) → 400
- Test: không có auth token → 401
- Test: gọi lại khi đã có avatar → replace avatar cũ trong Supabase Storage
```

**Done when:**

- `display_name` lưu vào `users.display_name`
- Avatar upload lên Supabase Storage bucket `avatars/{user_id}`, lưu path vào `users.avatar_url`
- File cũ trong Supabase Storage bị xóa khi upload mới

---

## Task 7 — Supabase Storage Client

**Mô tả:** Tạo helper để upload/delete file lên Supabase Storage qua REST API trực tiếp (không dùng supabase-js). Dùng cho avatar và check-in evidence.

**Interface:**

```typescript
async function uploadFile(bucket: string, path: string, file: Buffer, mimeType: string): Promise<string>
async function deleteFile(bucket: string, path: string): Promise<void>
function getPublicUrl(bucket: string, path: string): string
```

**TDD:**
```
- Test: uploadFile thành công → trả về public URL
- Test: deleteFile thành công → file không còn tồn tại
- Test: upload file với sai MIME type → throw error
- Test: getPublicUrl trả đúng URL format của Supabase Storage
```

**Done when:**

- Dùng `fetch` gọi Supabase Storage REST API với `SUPABASE_SERVICE_ROLE_KEY`
- Export từ `src/lib/storage.ts`
- Env vars cần thêm: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Dependency Map

```
Task 1 (signup) → Task 2 (check-username)
Task 1, Task 3 (signup/signin) → Task 4 (refresh)
Task 3 (signin) → Task 5 (signout)
Task 7 (storage) → Task 6 (complete profile dùng storage)
Task 1 (có JWT) → Task 6 (complete profile)
```
