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
| Wake Up at 6AM | `f79aacef-8b1e-469d-b99c-afcba004f02a` | alice | active | alice(host), bob(accepted), charlie(invited) |
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

# Nudge again → rate limited
curl -s -X POST "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/nudge/e30d4258-a336-4dcb-9534-7c753e765db7?user_id=9065e038-3ebf-411f-af59-d64e12259533"
# ✅ 429 { "error": "Already nudged this member today" }
```

### 56f. Nudge History (GET — browser-friendly)

```bash
# View nudges bob received in this challenge
curl -s "https://backend-production-2ba1.up.railway.app/api/challenges/f79aacef-8b1e-469d-b99c-afcba004f02a/nudge/e30d4258-a336-4dcb-9534-7c753e765db7"
# ✅ 200 { "nudges": [{ "metadata": { "from_user_id": "9065e038-..." }, "is_read": false }], "member_id": "e30d4258-...", "challenge_id": "f79aacef-..." }
```

---

## API Documentation

### 56. OpenAPI JSON

```bash
curl -s "https://backend-production-2ba1.up.railway.app/api/docs" | head -c 200
# ✅ 200 — Returns full OpenAPI 3.0.3 spec (v0.6.0) with Check-in endpoints
```

### 57. Swagger UI

```bash
curl -s -o /dev/null -w "%{http_code}" "https://backend-production-2ba1.up.railway.app/api/docs/ui"
# ✅ 200 — Interactive Swagger UI page
# Open in browser: https://backend-production-2ba1.up.railway.app/api/docs/ui
```

---

## Test Results

```
Test Suites: 10 passed, 10 total
Tests:       143 passed, 2 skipped, 145 total

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
```
