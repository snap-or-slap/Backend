# Smoke Test Guide

> **Base URL**: `https://backend-production-2ba1.up.railway.app`
> **Local**: `http://localhost:3000`
> **Swagger UI**: [/api/docs/ui](https://backend-production-2ba1.up.railway.app/api/docs/ui)
> **OpenAPI JSON**: [/api/docs](https://backend-production-2ba1.up.railway.app/api/docs)

---

## Test Accounts (seeded)

| User | Email | UUID | Notes |
|------|-------|------|-------|
| alice | <alice@example.com> | `9065e038-3ebf-411f-af59-d64e12259533` | Public, host of active challenge |
| bob | <bob@example.com> | `e30d4258-a336-4dcb-9534-7c753e765db7` | Public, host of formation challenge |
| charlie | <charlie@example.com> | `b2e8239e-edb6-4a92-9482-9df5afc1e0ec` | Public, host of completed challenge |
| diana | <diana@example.com> | `bf0ab3b2-9802-4c2d-9d7e-b41484521cf7` | **Private** profile |
| edward | <edward@example.com> | `dab2e64b-08eb-4c6d-a12e-5f6cb0d224c2` | Public |

**Password chung**: `Password123!`

**Friend network**:

- alice ↔ bob (accepted), alice ↔ charlie (accepted), bob ↔ charlie (accepted)
- diana → alice (pending), edward → bob (pending), edward → charlie (declined)

**Seeded Challenges**:

| Title | ID | Host | Status | Members |
|-------|-----|------|--------|---------|
| Wake Up at 6AM | `f79aacef-8b1e-469d-b99c-afcba004f02a` | alice | cancelled (was active, host_cancelled via Sprint 6) | alice(host), bob(accepted), charlie(invited) |
| Read 20 Pages Daily | `16eda1da-1b3e-4753-88f3-e41cd4e8f42a` | bob | formation | bob(host), diana(invited) |
| 7-Day No Sugar | `fcdd1c90-f8d1-4055-b32f-739d3e5f75fb` | charlie | completed | charlie(host), alice(accepted), bob(accepted) |

---

## Sprint 1 — Foundation & Database

### 1. Health Check

```bash
curl https://backend-production-2ba1.up.railway.app/api/health
# ✅ 200 { "status": "ok", "db": "ok", "uptime": <number> }
```

### 2. Build & Type Check

```bash
npm run build
# ✅ Compiled successfully, 25 routes, no TypeScript errors
```

### 3. Database Migration

```bash
npx ts-node -P tsconfig.migrate.json src/lib/db/migrate.ts
# ✅ 11 tables: users, challenges, challenge_members, checkins, friend_requests,
#    badges, user_badges, activities, notifications, refresh_tokens, _migrations
```

### 4. Seed Data

```bash
curl https://backend-production-2ba1.up.railway.app/api/test-data
# ✅ 5 users, 3 challenges, challenge members, 19 checkins, badges, notifications, activities
```

---

## Sprint 2 — Auth System

### 5. Register — Validation Error

```bash
curl -s -X POST https://backend-production-2ba1.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bad","password":"x","username":"ab"}'
# ✅ 400 { "error": "Validation failed", "details": [...field errors...] }
```

### 6. Register — Success

```bash
curl -s -X POST https://backend-production-2ba1.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@test.com","password":"Password123!","username":"newuser123"}'
# ✅ 201 { "user": { "id", "email", "username", ... }, "access_token": "...", "refresh_token": "..." }
```

### 7. Register — Duplicate Email

```bash
curl -s -X POST https://backend-production-2ba1.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!","username":"alice_dup"}'
# ✅ 409 { "error": "Email already registered" }
```

### 8. Register — Duplicate Username

```bash
curl -s -X POST https://backend-production-2ba1.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"unique@test.com","password":"Password123!","username":"alice"}'
# ✅ 409 { "error": "Username already taken" }
```

### 9. Login — Success

```bash
curl -s -X POST https://backend-production-2ba1.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'
# ✅ 200 { "user": { "id", "email", "username", "display_name", "avatar_url" }, "access_token": "...", "refresh_token": "..." }
```

### 10. Login — Wrong Password

```bash
curl -s -X POST https://backend-production-2ba1.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"WrongPass123!"}'
# ✅ 401 { "error": "Invalid credentials" }
```

### 11. Login — Non-existent Email

```bash
curl -s -X POST https://backend-production-2ba1.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ghost@example.com","password":"Password123!"}'
# ✅ 401 { "error": "Invalid credentials" }
```

### 12. Check Username Availability

```bash
# Taken
curl -s "https://backend-production-2ba1.up.railway.app/api/auth/check-username?username=alice"
# ✅ 200 { "available": false }

# Available
curl -s "https://backend-production-2ba1.up.railway.app/api/auth/check-username?username=newname999"
# ✅ 200 { "available": true }
```

### 13. Refresh Token

```bash
# First login to get refresh_token, then:
curl -s -X POST https://backend-production-2ba1.up.railway.app/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token_from_login>"}'
# ✅ 200 { "access_token": "...", "refresh_token": "<new_rotated_token>" }
```

### 14. Sign Out

```bash
curl -s -X POST https://backend-production-2ba1.up.railway.app/api/auth/signout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token>"}'
# ✅ 200 { "message": "Signed out" }
```

### 15. Protected Route Without Auth

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/users/me"
# ✅ 401 { "error": "Unauthorized" }
```

---

## Sprint 3 — Friends & Social

### 16. Search Users

```bash
# Search by username (min 2 chars)
curl -s "https://backend-production-2ba1.up.railway.app/api/users/search?q=al"
# ✅ 200 { "users": [{ "id", "username": "alice", "display_name": "Alice Nguyen", ... }] }

# Too short
curl -s "https://backend-production-2ba1.up.railway.app/api/users/search?q=a"
# ✅ 400 { "error": "Query must be at least 2 characters" }
```

### 17. Get My Profile

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/users/me?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "user": { "id", "email", "username": "alice", "display_name": "Alice Nguyen", ... } }
```

### 18. Update My Profile

```bash
curl -s -X PATCH "https://backend-production-2ba1.up.railway.app/api/users/me?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Alice Updated","bio":"New bio!"}'
# ✅ 200 { "user": { "display_name": "Alice Updated", "bio": "New bio!", ... } }
```

### 19. View User Profile (Friend)

```bash
# alice views bob's profile (they are friends → full data)
curl -s "https://backend-production-2ba1.up.railway.app/api/users/e30d4258-a336-4dcb-9534-7c753e765db7/profile?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "user": {...}, "relationship": "friend", "stats": {...}, "badges": [...], "latest_activities": [...] }
```

### 20. View User Profile (Private Stranger)

```bash
# edward views diana (not friends, diana is private → limited data)
curl -s "https://backend-production-2ba1.up.railway.app/api/users/bf0ab3b2-9802-4c2d-9d7e-b41484521cf7/profile?user_id=dab2e64b-08eb-4c6d-a12e-5f6cb0d224c2"
# ✅ 200 { "user": { "username", "display_name" }, "relationship": "none", "stats": null, "badges": null }
```

### 21. List Friends

```bash
# alice has 2 friends (bob, charlie)
curl -s "https://backend-production-2ba1.up.railway.app/api/friends?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "friends": [{ "user_id", "username", "display_name", ... }, ...], "total": 2, ... }
```

### 22. Send Friend Request

```bash
# alice sends friend request to edward
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/friends/request?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"receiver_id":"dab2e64b-08eb-4c6d-a12e-5f6cb0d224c2"}'
# ✅ 201 { "request": { "id", "sender_id", "receiver_id", "status": "pending", ... } }
```

### 23. List Pending Friend Requests

```bash
# alice checks incoming requests (diana sent her one)
curl -s "https://backend-production-2ba1.up.railway.app/api/friends/requests/pending?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "received": [{ "id", "sender_id", "status": "pending", ... }], "sent": [...] }
```

### 24. Accept Friend Request

```bash
# alice accepts diana's request (get request_id from pending list first)
curl -s -X PUT "https://backend-production-2ba1.up.railway.app/api/friends/request/<REQUEST_ID>/respond?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"action":"accept"}'
# ✅ 200 { "request": { "status": "accepted", ... } }
```

### 25. Decline Friend Request

```bash
curl -s -X PUT "https://backend-production-2ba1.up.railway.app/api/friends/request/<REQUEST_ID>/respond?user_id=<USER_ID>" \
  -H "Content-Type: application/json" \
  -d '{"action":"decline"}'
# ✅ 200 { "request": { "status": "declined", ... } }
```

### 26. Unfriend

```bash
# alice unfriends bob
curl -s -X DELETE "https://backend-production-2ba1.up.railway.app/api/friends/e30d4258-a336-4dcb-9534-7c753e765db7?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "message": "Unfriended successfully" }
```

---

## Sprint 3+ — Challenges CRUD (Full Collection)

### 27. List My Challenges

```bash
# alice's challenges (2 results: active + completed)
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "challenges": [{ "id", "title", "status", "my_role", "member_count", ... }], "total": 2, "page": 1, "limit": 20 }
```

### 28. List Challenges — Filter by Status

```bash
# only active challenges
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges?user_id=9065e038-3ebf-411f-af59-d64e12259533&status=active"
# ✅ 200 { "challenges": [{ "title": "Wake Up at 6AM", "status": "active", ... }], "total": 1 }
```

### 29. Create Challenge (POST)

```bash
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "30-Day Meditation",
    "description": "10 minutes of mindfulness every morning",
    "durationDays": 30,
    "frequency": "daily",
    "resetTime": "07:00",
    "totalHearts": 3,
    "maxMembers": 5,
    "isPrivate": false
  }'
# ✅ 201 { "challenge": { "id": "<new-uuid>", "title": "30-Day Meditation", "status": "formation", "creator_id": "alice-uuid", ... } }
```

### 30. Create Challenge — Validation Error

```bash
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"title":"","durationDays":0}'
# ✅ 400 { "error": "Validation failed", "details": [...] }
```

### 31. Get Challenge Details (READ)

```bash
# Active challenge with members list
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 {
#   "challenge": { "id", "title": "Wake Up at 6AM", "status": "active", "duration_days": 30, ... },
#   "members": [
#     { "user_id", "username": "alice", "role": "host", "status": "accepted", "current_step": 3 },
#     { "user_id", "username": "bob_the_builder", "role": "member", "status": "accepted", "current_step": 2 },
#     { "user_id", "username": "charlie99", "role": "member", "status": "invited", "current_step": 0 }
#   ],
#   "my_membership": { "role": "host", "status": "accepted", "is_ready": true, "current_step": 3 }
# }
```

### 32. Get Challenge — Not Found

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/00000000-0000-0000-0000-000000000000"
# ✅ 404 { "error": "Challenge not found" }
```

### 33. Update Challenge (PATCH) — Host Only, Formation Only

```bash
# bob updates his formation challenge
curl -s -X PATCH "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a?user_id=e30d4258-a336-4dcb-9534-7c753e765db7" \
  -H "Content-Type: application/json" \
  -d '{"title":"Read 30 Pages Daily","maxMembers":15}'
# ✅ 200 { "challenge": { "title": "Read 30 Pages Daily", "max_members": 15, "status": "formation", ... } }
```

### 34. Update Challenge — Not Host (Forbidden)

```bash
# alice tries to update bob's challenge
curl -s -X PATCH "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hacked"}'
# ✅ 404 { "error": "Challenge not found or you are not the host" }
```

### 35. Update Challenge — Active (Rejected)

```bash
# alice tries to update her active challenge (not formation → rejected)
curl -s -X PATCH "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"title":"Changed"}'
# ✅ 400 { "error": "Can only edit challenges in formation status" }
```

### 36. Delete Formation Challenge (DELETE)

```bash
# First create a throwaway challenge, then delete it:
# Step 1: Create
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"title":"Delete Me","durationDays":7,"frequency":"daily"}'
# → Note the returned challenge ID

# Step 2: Delete
curl -s -X DELETE "https://backend-production-2ba1.up.railway.app/api/challenges/<CHALLENGE_ID>?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "message": "Challenge deleted", "id": "<uuid>" }
```

### 37. Cancel Active Challenge (DELETE → status=cancelled)

```bash
# alice cancels her active challenge
curl -s -X DELETE "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "message": "Challenge cancelled", "id": "f79aacef-..." }
```

### 38. Delete Completed Challenge (Rejected)

```bash
# charlie tries to delete his completed challenge
curl -s -X DELETE "https://backend-production-2ba1.up.railway.app/api/challenges/fcdd1c90-f8d1-4055-b32f-739d3e5f75fb?user_id=b2e8239e-edb6-4a92-9482-9df5afc1e0ec"
# ✅ 400 { "error": "Cannot delete completed or failed challenges" }
```

---

## Sprint 4 — Challenge Formation Lifecycle

### 41. Browse Public Challenges (GET — browser-friendly)

```bash
# No params — lists all public formation challenges not full
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/public"
# ✅ 200 { "challenges": [{ "title": "Read 20 Pages Daily", "status": "formation", "member_count": 2, ... }], "total": 1, "page": 1 }
```

### 42. Search Public Challenges

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/public?q=read"
# ✅ 200 { "challenges": [{ "title": "Read 20 Pages Daily", ... }], "total": 1 }

# No results
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/public?q=zzzzz"
# ✅ 200 { "challenges": [], "total": 0 }
```

### 43. Public Challenges — Exclude My Memberships

```bash
# bob is already in "Read 20 Pages Daily" → excluded
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/public?user_id=e30d4258-a336-4dcb-9534-7c753e765db7"
# ✅ 200 { "challenges": [], "total": 0 }

# edward is not in any formation challenge → sees it
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/public?user_id=dab2e64b-08eb-4c6d-a12e-5f6cb0d224c2"
# ✅ 200 { "challenges": [{ "title": "Read 20 Pages Daily", ... }], "total": 1 }
```

### 44. View Readiness Status (GET — browser-friendly)

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/ready"
# ✅ 200 { "challenge_id": "...", "members": [{ "username": "bob_the_builder", "is_ready": true, "role": "host" }], "readiness": { "total": 1, "ready": 1, "all_ready": false } }
```

### 45. View Pending Invitations (GET — browser-friendly)

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/join"
# ✅ 200 { "challenge_id": "...", "pending_invitations": [{ "username": "alice", "status": "invited", ... }], "count": 1 }
```

### 46. Create Challenge with Invite Friends

```bash
# alice creates a challenge and invites bob (they are friends)
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sprint Test Challenge",
    "durationDays": 7,
    "frequency": "daily",
    "invitedUserIds": ["e30d4258-a336-4dcb-9534-7c753e765db7"]
  }'
# ✅ 201 { "challenge": { "id": "<new-uuid>", "title": "Sprint Test Challenge", ... } }
# → bob gets invited automatically
```

### 47. Create Challenge with Invite — Non-Friend (Rejected)

```bash
# alice tries to invite diana (pending request, not accepted friend)
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fail Test",
    "durationDays": 7,
    "frequency": "daily",
    "invitedUserIds": ["bf0ab3b2-9802-4c2d-9d7e-b41484521cf7"]
  }'
# ✅ 400 { "error": "Can only invite friends", "nonFriendIds": ["bf0ab3b2-..."] }
```

### 48. Invite Friends to Existing Challenge (POST)

```bash
# bob invites charlie to his formation challenge
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/invite?user_id=e30d4258-a336-4dcb-9534-7c753e765db7" \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["b2e8239e-edb6-4a92-9482-9df5afc1e0ec"]}'
# ✅ 201 { "invited": [{ "user_id": "b2e8239e-...", "status": "invited", ... }], "skipped": [] }
```

### 49. Invite — Not Host (Forbidden)

```bash
# alice tries to invite to bob's challenge
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/invite?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["b2e8239e-edb6-4a92-9482-9df5afc1e0ec"]}'
# ✅ 403 { "error": "Only the host can invite" }
```

### 50. Accept Invitation — Join (POST)

```bash
# alice accepts invitation to bob's challenge (she was invited in seed data)
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/join?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "member": { "user_id": "9065e038-...", "status": "accepted", ... } }
```

### 51. Decline Invitation (POST)

```bash
# User declines an invitation (must be invited status)
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/<CHALLENGE_ID>/decline?user_id=<INVITED_USER_ID>"
# ✅ 200 { "member": { "status": "declined", ... } }
```

### 52. Toggle Ready Status (PUT)

```bash
# alice sets ready on bob's formation challenge (must be accepted member first)
curl -s -X PUT "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/ready?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"isReady": true}'
# ✅ 200 { "is_ready": true, "readiness": { "total": 2, "ready": 2, "all_ready": true } }
```

### 53. Leave Challenge (POST)

```bash
# alice leaves bob's formation challenge (not the host, so allowed)
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/leave?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "message": "Left challenge successfully", "challenge_id": "16eda1da-..." }
```

### 54. Leave Challenge — Host (Rejected)

```bash
# bob tries to leave his own challenge (he's the host)
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/leave?user_id=e30d4258-a336-4dcb-9534-7c753e765db7"
# ✅ 400 { "error": "Host cannot leave. Cancel the challenge instead." }
```

### 55. Leave Challenge — Active (Rejected)

```bash
# bob tries to leave alice's active challenge
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/leave?user_id=e30d4258-a336-4dcb-9534-7c753e765db7"
# ✅ 400 { "error": "Cannot leave an active challenge" }
```

---

## Sprint 5 — Active Challenge & Check-in System

### 56a. Today's Check-in Status (GET — browser-friendly)

```bash
# View all members' check-in status for current cycle
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/checkins/today"
# ✅ 200 { "challenge_id": "f79aacef-...", "cycle_number": 4, "duration_days": 30, "hearts_left": 3, "reset_at": "...", "time_until_reset": 60602, "members": [{ "username": "alice", "status": "checked_in" }, { "username": "bob_the_builder", "status": "pending" }] }
```

### 56b. Check-in Gallery (GET — browser-friendly)

```bash
# Browse all check-ins with pagination
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/checkins?page=1&limit=5"
# ✅ 200 { "checkins": [{ "username": "bob_the_builder", "cycle_number": 2, "caption": "Day 2..." }, ...], "total": 5, "page": 1, "limit": 5 }

# Filter by member
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/checkins?member_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 — Only alice's check-ins
```

### 56c. Challenge Statistics (GET — browser-friendly)

```bash
# View completion rates, top performer, per-member breakdown
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/stats"
# ✅ 200 { "challenge_id": "f79aacef-...", "status": "active", "elapsed_cycles": 4, "completion_rate": 62.5, "top_performer": { "username": "alice", "completion_rate": 75 }, "member_stats": [...] }

# Formation challenge → 409
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/stats"
# ✅ 409 { "error": "Challenge is not active or completed" }
```

### 56d. Submit Check-in (POST)

```bash
# Alice checks in for current cycle
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/checkins?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"caption":"Day 4 smoke test!"}'
# ✅ 201 { "checkin": { "cycle_number": 4, "caption": "Day 4 smoke test!" }, "total_checkins": 4, "squad_status": { "members_checked_in": 1, "members_total": 2 } }

# Duplicate check-in → 409
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/checkins?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"caption":"try again"}'
# ✅ 409 { "error": "Already checked in for cycle 4" }
```

### 56e. Nudge Member (POST)

```bash
# Alice nudges bob (who hasn't checked in yet)
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/nudge/e30d4258-a336-4dcb-9534-7c753e765db7?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "message": "Nudge sent successfully", "target_user_id": "e30d4258-..." }
```

---

## Sprint 7 — Profile & Gamification

### 57a. Full Profile (GET)

```bash
# Get alice's full profile (user + stats + badges + activities)
curl -s "https://backend-production-2ba1.up.railway.app/api/users/me/profile?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { user: {...}, stats: {...}, badges: [...], badges_locked: [...], recent_activities: [...] }
```

### 57b. User Stats (GET)

```bash
# Get alice's stats (lightweight)
curl -s "https://backend-production-2ba1.up.railway.app/api/users/me/stats?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { stats: { user_id, challenges_joined, challenges_completed, total_checkins, current_streak, best_streak, updated_at } }
```

### 57c. Recalculate Stats (POST)

```bash
# Recalculate alice's stats from DB data
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/users/me/stats/recalculate?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { stats: { challenges_joined: 2, challenges_completed: 1, total_checkins: 11, current_streak: 10, best_streak: 10 }, message: "Stats recalculated successfully" }
```

### 57d. Activity Feed (GET)

```bash
# Get alice's activity feed (paginated)
curl -s "https://backend-production-2ba1.up.railway.app/api/users/me/activities?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { activities: [...], pagination: { page: 1, limit: 20, total: 4, total_pages: 1 } }

# With type filter
curl -s "https://backend-production-2ba1.up.railway.app/api/users/me/activities?user_id=9065e038-3ebf-411f-af59-d64e12259533&type=badge_earned"
# ✅ 200 { activities: [{ type: "badge_earned", ... }], pagination: {...} }

# With pagination
curl -s "https://backend-production-2ba1.up.railway.app/api/users/me/activities?user_id=9065e038-3ebf-411f-af59-d64e12259533&page=1&limit=2"
# ✅ 200 { activities: [...2 items...], pagination: { page: 1, limit: 2, total: 4, total_pages: 2 } }
```

### 57e. Check & Award Badges (POST)

```bash
# Auto-check and award badges for alice based on her stats
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/users/me/badges/check?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { awarded: ["early-adopter", "first-checkin", "streak-7", "challenge-1", "squad-mvp"], message: "Awarded 5 new badge(s): ..." }
# Run again → ✅ 200 { awarded: [], message: "No new badges earned" }
```

### 57f. Toggle Privacy (PUT)

```bash
# Set alice's profile to private
curl -s -X PUT "https://backend-production-2ba1.up.railway.app/api/users/me/settings?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"isPrivate": true}'
# ✅ 200 { user: { id: "...", is_private: true }, message: "Settings updated" }

# Set back to public
curl -s -X PUT "https://backend-production-2ba1.up.railway.app/api/users/me/settings?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"isPrivate": false}'
# ✅ 200 { user: { id: "...", is_private: false }, message: "Settings updated" }
```

### 57g. Change Password (POST)

```bash
# Change alice's password
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/auth/change-password?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "Password123!", "newPassword": "NewPassword123!"}'
# ✅ 200 { message: "Password changed successfully" }

# Change back (so test account still works)
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/auth/change-password?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "NewPassword123!", "newPassword": "Password123!"}'
# ✅ 200 { message: "Password changed successfully" }

# Wrong current password → 401
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/auth/change-password?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "WrongPass1!", "newPassword": "Something123!"}'
# ✅ 401 { error: "Current password is incorrect" }
```

### 57h. Delete Account (DELETE)

```bash
# Soft delete edward's account (anonymizes data, deactivates user)
curl -s -X DELETE "https://backend-production-2ba1.up.railway.app/api/users/me?user_id=dab2e64b-08eb-4c6d-a12e-5f6cb0d224c2"
# ✅ 200 { message: "Account deleted successfully" }

# Try to get deleted user's profile → 404
curl -s "https://backend-production-2ba1.up.railway.app/api/users/me/profile?user_id=dab2e64b-08eb-4c6d-a12e-5f6cb0d224c2"
# ✅ 404 { error: "User not found or deactivated" }
```

### 57i. OpenAPI Docs (GET)

```bash
# Swagger JSON (v0.9.0 with Sprint 8 endpoints)
curl -s "https://backend-production-2ba1.up.railway.app/api/docs" | python -m json.tool | head -5
# ✅ 200 { "openapi": "3.0.3", "info": { "title": "SOS App...", "version": "0.9.0" } }

# Swagger UI
# Open in browser: https://backend-production-2ba1.up.railway.app/api/docs/ui
```

---

## Sprint 8 — Notifications, Widget & Sync

### 67. List Notifications (GET)

```bash
# All alice's notifications (paginated)
curl -s "https://backend-production-2ba1.up.railway.app/api/notifications?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { notifications: [...], unread_count: <n>, total: <n>, page: 1, limit: 20, total_pages: 1 }

# Filter by is_read=false
curl -s "https://backend-production-2ba1.up.railway.app/api/notifications?user_id=9065e038-3ebf-411f-af59-d64e12259533&is_read=false"
# ✅ 200 { notifications: [... only unread ...], unread_count: <n>, total: <n> }

# Filter by category=social (friend_request, friend_accepted)
curl -s "https://backend-production-2ba1.up.railway.app/api/notifications?user_id=9065e038-3ebf-411f-af59-d64e12259533&category=social"
# ✅ 200 { notifications: [{ type: "friend_request", category: "social" }, ...] }

# Filter by category=challenge (challenge_invite, challenge_start, heart_lost, nudge)
curl -s "https://backend-production-2ba1.up.railway.app/api/notifications?user_id=b2e8239e-edb6-4a92-9482-9df5afc1e0ec&category=challenge"
# ✅ 200 { notifications: [{ type: "challenge_invite", category: "challenge" }] }

# Pagination
curl -s "https://backend-production-2ba1.up.railway.app/api/notifications?user_id=9065e038-3ebf-411f-af59-d64e12259533&page=1&limit=3"
# ✅ 200 { notifications: [...3 items...], total_pages: <n> }
```

### 68. Mark Notifications Read (PUT)

```bash
# Mark all as read
curl -s -X PUT "https://backend-production-2ba1.up.railway.app/api/notifications/read?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"mark_all": true}'
# ✅ 200 { updated_count: <n> }

# Mark specific IDs as read
curl -s -X PUT "https://backend-production-2ba1.up.railway.app/api/notifications/read?user_id=9065e038-3ebf-411f-af59-d64e12259533" \
  -H "Content-Type: application/json" \
  -d '{"notification_ids": ["<uuid>"]}'
# ✅ 200 { updated_count: 1 }
```

### 69. Delete Notification (DELETE)

```bash
# Delete a specific notification (must belong to user)
curl -s -X DELETE "https://backend-production-2ba1.up.railway.app/api/notifications/<notification-id>?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { message: "Notification deleted" }

# Delete non-existent → 404
curl -s -X DELETE "https://backend-production-2ba1.up.railway.app/api/notifications/00000000-0000-0000-0000-000000000000?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 404 { error: "Notification not found" }
```

### 70. Widget Summary (GET)

```bash
# Get alice's widget dashboard data
curl -s "https://backend-production-2ba1.up.railway.app/api/widget/summary?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { current_streak: 10, active_challenges: [...], unread_notifications: 0 }
# active_challenges includes: id, title, hearts_left, total_hearts, member_count, my_checkin_today, members_checked_in
```

### 71. Sync Pending Overlays (GET)

```bash
# First call — returns unseen notifications
curl -s "https://backend-production-2ba1.up.railway.app/api/sync?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { pending_overlays: [{ id, type, metadata, created_at }, ...] }

# Second call — empty (already marked as shown)
curl -s "https://backend-production-2ba1.up.railway.app/api/sync?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { pending_overlays: [] }
```

# Nudge again → rate limited

curl -s -X POST "<https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/nudge/e30d4258-a336-4dcb-9534-7c753e765db7?user_id=9065e038-3ebf-411f-af59-d64e12259533>"

# ✅ 429 { "error": "Already nudged this member today" }

```

### 56f. Nudge History (GET — browser-friendly)

```bash
# View nudges bob received in this challenge
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/nudge/e30d4258-a336-4dcb-9534-7c753e765db7"
# ✅ 200 { "nudges": [{ "metadata": { "from_user_id": "9065e038-..." }, "is_read": false }], "member_id": "e30d4258-...", "challenge_id": "f79aacef-..." }
```

---

## Sprint 6 — Cron Jobs & Automated Game Logic

### 56. GET Cron Job Info (formation-transition)

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/crons/formation-transition"
# ✅ 200 { "job": "formation-transition", "description": "Transitions formation challenges to active...", "method": "POST with Authorization: Bearer <CRON_SECRET>...", "available_jobs": ["formation-transition","heart-deduction"] }
```

### 57. GET Cron Job Info (heart-deduction)

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/crons/heart-deduction"
# ✅ 200 { "job": "heart-deduction", "description": "Processes daily heart deductions...", "available_jobs": [...] }
```

### 58. POST Cron Without Secret → 401

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "https://backend-production-2ba1.up.railway.app/api/crons/formation-transition"
# ✅ 401 — Missing/wrong Authorization: Bearer <CRON_SECRET>
```

### 59. POST Cron Unknown Job → 404

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer test" "https://backend-production-2ba1.up.railway.app/api/crons/unknown-job"
# ✅ 404 — Unknown job name
```

### 60. GET Cancel Info (active challenge)

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/cancel"
# ✅ 200 { "challenge_id": "f79aacef-...", "title": "Wake Up at 6AM", "status": "active", "can_cancel": true, "end_reason": null, "final_stats": null }
```

### 61. POST Cancel by Non-Host → 403

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/cancel?user_id=e30d4258-a336-4dcb-9534-7c753e765db7"
# ✅ 403 — Only the host (creator) can cancel
```

### 62. POST Cancel Non-Active Challenge → 409

```bash
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/fcdd1c90-f8d1-4055-b32f-739d3e5f75fb/cancel?user_id=b2e8239e-edb6-4a92-9482-9df5afc1e0ec"
# ✅ 409 { "error": "Cannot cancel challenge with status 'completed'. Only active challenges can be cancelled." }
```

### 63. POST Cancel Active Challenge (Host) → 200

```bash
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/cancel?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 200 { "challenge_id": "f79aacef-...", "status": "cancelled", "end_reason": "host_cancelled" }
```

### 64. GET Cancel Info (after cancellation)

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/cancel"
# ✅ 200 { "status": "cancelled", "end_reason": "host_cancelled", "can_cancel": false }
```

> **Note**: POST cron execution endpoints (`formation-transition`, `heart-deduction`) require the `CRON_SECRET` env var as Bearer token. These are designed for Railway cron job scheduling, not browser testing. Use GET to inspect job info instead.

---

## API Documentation

### 65. OpenAPI JSON

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/docs" | head -c 200
# ✅ 200 — Returns full OpenAPI 3.0.3 spec (v0.7.0) with Cron & Cancel endpoints
```

### 66. Swagger UI

```bash
curl -s -o /dev/null -w "%{http_code}" "https://backend-production-2ba1.up.railway.app/api/docs/ui"
# ✅ 200 — Interactive Swagger UI page
# Open in browser: https://backend-production-2ba1.up.railway.app/api/docs/ui
```

---

## Test Results

```
Test Suites: 13 passed, 13 total
Tests:       210 passed, 210 total

  src/__tests__/lib/config.test.ts               ✅ Environment validation
  src/__tests__/lib/db.test.ts                   ✅ Database connection
  src/__tests__/lib/schemas.test.ts              ✅ Zod schemas
  src/__tests__/lib/middleware.test.ts            ✅ Auth middleware + error handler
  src/__tests__/api/health.test.ts               ✅ Health endpoint
  src/__tests__/api/auth.test.ts                 ✅ Register + Login + Refresh + Signout
  src/__tests__/api/friends.test.ts              ✅ Friends CRUD + Privacy
  src/__tests__/api/challenges.test.ts           ✅ Challenges CRUD (18 tests)
  src/__tests__/api/challenges-formation.test.ts ✅ Formation lifecycle (27 tests)
  src/__tests__/api/challenges-checkin.test.ts   ✅ Check-in system (19 tests)
  src/__tests__/api/crons.test.ts                ✅ Cron jobs & cancel (21 tests)
  src/__tests__/api/profile.test.ts              ✅ Profile & gamification (24 tests)
  src/__tests__/api/notifications.test.ts        ✅ Notifications, widget & sync (23 tests)
```

---

## Quick Full Smoke Run (Copy-Paste)

```bash
BASE="https://backend-production-2ba1.up.railway.app"
ALICE="9065e038-3ebf-411f-af59-d64e12259533"
BOB="e30d4258-a336-4dcb-9534-7c753e765db7"

echo "=== Health ==="
curl -s "$BASE/api/health"

echo "\n=== Login alice ==="
curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'

echo "\n=== Search users ==="
curl -s "$BASE/api/users/search?q=bob"

echo "\n=== My profile ==="
curl -s "$BASE/api/users/me?user_id=$ALICE"

echo "\n=== Friends list ==="
curl -s "$BASE/api/friends?user_id=$ALICE"

echo "\n=== List challenges ==="
curl -s "$BASE/api/challenges?user_id=$ALICE"

echo "\n=== Challenge detail ==="
curl -s "$BASE/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a?user_id=$ALICE"

echo "\n=== Create challenge ==="
curl -s -X POST "$BASE/api/challenges?user_id=$ALICE" \
  -H "Content-Type: application/json" \
  -d '{"title":"Quick Test","durationDays":7,"frequency":"daily"}'

echo "\n=== Docs ==="
curl -s -o /dev/null -w "OpenAPI: %{http_code}" "$BASE/api/docs"
echo ""
curl -s -o /dev/null -w "Swagger UI: %{http_code}" "$BASE/api/docs/ui"

echo "\n=== Public challenges ==="
curl -s "$BASE/api/challenges/public"

echo "\n=== Public search ==="
curl -s "$BASE/api/challenges/public?q=read"

echo "\n=== Readiness status ==="
curl -s "$BASE/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/ready"

echo "\n=== Pending invitations ==="
curl -s "$BASE/api/challenges/16eda1da-1b3e-4753-88f3-e41cd4e8f42a/join"

CH="f79aacef-8b1e-469d-b99c-afcba004f02a"
echo "\n=== Today status ==="
curl -s "$BASE/api/challenges/$CH/checkins/today"

echo "\n=== Gallery ==="
curl -s "$BASE/api/challenges/$CH/checkins?page=1&limit=5"

echo "\n=== Stats ==="
curl -s "$BASE/api/challenges/$CH/stats"

echo "\n=== Nudge history ==="
curl -s "$BASE/api/challenges/$CH/nudge/$BOB"

echo "\n=== Cron info (formation) ==="
curl -s "$BASE/api/crons/formation-transition"

echo "\n=== Cron info (heart-deduction) ==="
curl -s "$BASE/api/crons/heart-deduction"

echo "\n=== Cancel info ==="
curl -s "$BASE/api/challenges/$CH/cancel"

echo "\n=== Docs ==="
curl -s -o /dev/null -w "OpenAPI: %{http_code}" "$BASE/api/docs"
echo ""
curl -s -o /dev/null -w "Swagger UI: %{http_code}" "$BASE/api/docs/ui"

echo "\n=== Notifications ==="
curl -s "$BASE/api/notifications?user_id=$ALICE"

echo "\n=== Notifications (social) ==="
curl -s "$BASE/api/notifications?user_id=$ALICE&category=social"

echo "\n=== Widget summary ==="
curl -s "$BASE/api/widget/summary?user_id=$ALICE"

echo "\n=== Sync pending ==="
curl -s "$BASE/api/sync?user_id=$ALICE"
```
