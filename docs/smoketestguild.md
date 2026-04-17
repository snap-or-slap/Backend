# Smoke Test Guide

## Environments

| Env | Base URL |
|-----|----------|
| Local | `http://localhost:3000` |
| Railway (Production) | `https://backend-production-2ba1.up.railway.app` |

---

## Sprint 1 — Foundation & Database Setup

### 1. Health Endpoint

**Local**

```bash
# Should return 200 with { status: "ok", db: "ok", uptime: <number> }
curl http://localhost:3000/api/health
```

**Railway**

```bash
curl https://backend-production-2ba1.up.railway.app/api/health
# Expected: { "status": "ok", "db": "ok", "uptime": <number> }
```

### 2. Path Alias Resolution

```bash
# Build should succeed without TypeScript errors
npm run build
```

### 3. Environment Validation

```bash
# Remove DATABASE_URL from .env.local → app should crash with clear error on startup
# Restore DATABASE_URL → app should start normally
```

### 4. Database Connection

```bash
# Run migration against Supabase
npm run db:migrate

# Verify tables exist: connect to Supabase SQL editor and run:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
# Expected: users, challenges, challenge_members, checkins, friend_requests,
#           badges, user_badges, activities, notifications, refresh_tokens, _migrations
```

### 5. Auth Middleware

**Local**

```bash
# Request without token → 401
curl http://localhost:3000/api/users/me
# Expected: { "error": "Unauthorized" }
```

**Railway**

```bash
curl https://backend-production-2ba1.up.railway.app/api/users/me
# Expected: { "error": "Unauthorized" }
```

### 6. Input Validation

**Local**

```bash
# Register with invalid data → 400 with field-level errors
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bad","password":"x","username":"ab"}'
# Expected: 400 with validation errors

# Register with valid data → should proceed (501 until Sprint 2 implements it)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Password123!","username":"validuser","displayName":"Test"}'
```

**Railway**

```bash
curl -X POST https://backend-production-2ba1.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bad","password":"x","username":"ab"}'
# Expected: 400 with validation errors
```

### 7. Seed Data Verification

**Railway**

```bash
curl https://backend-production-2ba1.up.railway.app/api/test-data
# Expected: 3 users (alice, bob, charlie), 1 challenge (Wake Up at 6AM),
#           3 members, 2 checkins — all read from Supabase
```

### 8. Railway Deploy

```bash
# Push to main → Railway auto-deploys
git push origin main

# Verify health check after deploy:
curl https://backend-production-2ba1.up.railway.app/api/health
# Expected: 200 { "status": "ok", "db": "ok" }
```
