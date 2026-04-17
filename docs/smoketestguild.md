# Smoke Test Guide

## Sprint 1 — Foundation & Database Setup

### 1. Health Endpoint
```bash
# Should return 200 with { status: "ok", db: "ok", uptime: <number> }
curl http://localhost:3000/api/health

# If DB is down, should return 503 with { status: "error", db: "error" }
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
```bash
# Request without token → 401
curl http://localhost:3000/api/users/me
# Expected: { "error": "Unauthorized" }

# Request with expired token → 401 Token expired
# Request with valid token → handler proceeds
```

### 6. Input Validation
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

### 7. Railway Deploy
```bash
# Push to main → Railway should auto-deploy
# Verify: GET <railway-url>/api/health returns 200
```
