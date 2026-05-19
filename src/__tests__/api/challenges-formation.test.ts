import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const UUID1 = '00000000-0000-4000-a000-000000000001';
const UUID2 = '00000000-0000-4000-a000-000000000002';
const UUID3 = '00000000-0000-4000-a000-000000000003';
const CHALLENGE_ID = '00000000-0000-4000-a000-000000000c01';

beforeAll(() => {
	process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
	process.env.JWT_ACCESS_SECRET = 'test-access-secret';
	process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
	process.env.CRON_SECRET = 'test-cron-secret';
	process.env.APP_BASE_URL = 'http://localhost:3000';
	process.env.NODE_ENV = 'test';
});

const mockQuery = jest.fn();
jest.mock('@/lib/db', () => ({
	pool: { query: jest.fn(), end: jest.fn() },
	query: (...args: unknown[]) => mockQuery(...args),
}));

// ===========================================
// POST /api/challenges (with invited_user_ids)
// ===========================================
describe('POST /api/challenges (invite flow)', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should create challenge with invited_user_ids and generate member records', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: UUID1 }] }) // user exists
			.mockResolvedValueOnce({ rows: [{ friend_id: UUID2 }, { friend_id: UUID3 }] }) // friends check
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Test', status: 'formation' }] }) // insert challenge
			.mockResolvedValueOnce({ rows: [] }) // insert host member
			.mockResolvedValueOnce({ rows: [] }) // insert invited members
			.mockResolvedValueOnce({ rows: [] }); // insert notifications

		const { POST } = require('@/app/api/challenges/route');
		const req = new Request(`http://localhost:3000/api/challenges?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: 'Test Challenge',
				durationDays: 14,
				frequency: 'daily',
				invitedUserIds: [UUID2, UUID3],
			}),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(201);
		expect(body.challenge.id).toBe(CHALLENGE_ID);
	});

	it('should reject invited_user_ids with non-friends', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: UUID1 }] }) // user exists
			.mockResolvedValueOnce({ rows: [{ friend_id: UUID2 }] }); // only UUID2 is friend, UUID3 is not

		const { POST } = require('@/app/api/challenges/route');
		const req = new Request(`http://localhost:3000/api/challenges?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: 'Test Challenge',
				durationDays: 14,
				frequency: 'daily',
				invitedUserIds: [UUID2, UUID3],
			}),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(400);
		expect(body.error).toContain('Can only invite friends');
	});

	it('should create challenge with start_at in the future', async () => {
		const futureDate = new Date(Date.now() + 86400000).toISOString();
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: UUID1 }] }) // user exists
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Test', status: 'formation', start_at: futureDate }] })
			.mockResolvedValueOnce({ rows: [] }); // insert host member

		const { POST } = require('@/app/api/challenges/route');
		const req = new Request(`http://localhost:3000/api/challenges?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: 'Future Challenge',
				durationDays: 7,
				frequency: 'daily',
				startAt: futureDate,
			}),
		});
		const res = await POST(req);
		expect(res.status).toBe(201);
	});
});

// ===========================================
// POST /api/challenges/:id/invite
// ===========================================
describe('POST /api/challenges/:id/invite', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { POST } = require('@/app/api/challenges/[id]/invite/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/invite`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userIds: [UUID2] }),
		});
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});

	it('should return 403 when user is not an accepted member', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // not accepted member
		const { POST } = require('@/app/api/challenges/[id]/invite/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/invite?user_id=${UUID2}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userIds: [UUID3] }),
		});
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(403);
	});

	it('should return 409 when challenge not in formation', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, status: 'active', max_members: 10 }] });
		const { POST } = require('@/app/api/challenges/[id]/invite/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/invite?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userIds: [UUID2] }),
		});
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(409);
	});

	it('should return 409 when no slots available', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, status: 'formation', max_members: 2, title: 'Test' }] }) // challenge
			.mockResolvedValueOnce({ rows: [] }) // already member check
			.mockResolvedValueOnce({ rows: [{ count: 2 }] }); // current member count = max
		const { POST } = require('@/app/api/challenges/[id]/invite/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/invite?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userIds: [UUID2] }),
		});
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(409);
	});

	it('should return 400 when invitee is not friend', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, status: 'formation', max_members: 10, title: 'Test' }] })
			.mockResolvedValueOnce({ rows: [] }) // already member check
			.mockResolvedValueOnce({ rows: [{ count: 1 }] }) // 1 current member
			.mockResolvedValueOnce({ rows: [] }); // no friendship found
		const { POST } = require('@/app/api/challenges/[id]/invite/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/invite?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userIds: [UUID3] }),
		});
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});

	it('should invite friends successfully', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, status: 'formation', max_members: 10, title: 'Test' }] })
			.mockResolvedValueOnce({ rows: [] }) // already member check → none
			.mockResolvedValueOnce({ rows: [{ count: 1 }] }) // 1 current member
			.mockResolvedValueOnce({ rows: [{ friend_id: UUID2 }] }) // friendship check
			.mockResolvedValueOnce({ rows: [{ id: 'member-id', user_id: UUID2, status: 'invited' }] }) // insert member
			.mockResolvedValueOnce({ rows: [] }); // notification
		const { POST } = require('@/app/api/challenges/[id]/invite/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/invite?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userIds: [UUID2] }),
		});
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(201);
		expect(body.invited).toHaveLength(1);
	});
});

// ===========================================
// POST /api/challenges/:id/join
// ===========================================
describe('POST /api/challenges/:id/join', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { POST } = require('@/app/api/challenges/[id]/join/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/join`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});

	it('should return 403 when user has no invitation', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // no membership
		const { POST } = require('@/app/api/challenges/[id]/join/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/join?user_id=${UUID2}`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(403);
	});

	it('should return 409 when challenge is not in formation', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mem1', status: 'invited', challenge_status: 'active' }] });
		const { POST } = require('@/app/api/challenges/[id]/join/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/join?user_id=${UUID2}`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(409);
	});

	it('should accept invitation successfully', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: 'mem1', status: 'invited', challenge_status: 'formation', creator_id: UUID1, max_members: 10 }] })
			.mockResolvedValueOnce({ rows: [{ count: 2 }] }) // accepted count check
			.mockResolvedValueOnce({ rows: [{ id: 'mem1', user_id: UUID2, status: 'accepted', joined_at: new Date() }] }) // update member
			.mockResolvedValueOnce({ rows: [] }); // notification to host
		const { POST } = require('@/app/api/challenges/[id]/join/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/join?user_id=${UUID2}`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.member.status).toBe('accepted');
	});
});

// ===========================================
// POST /api/challenges/:id/decline
// ===========================================
describe('POST /api/challenges/:id/decline', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 403 when user has no invitation', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { POST } = require('@/app/api/challenges/[id]/decline/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/decline?user_id=${UUID2}`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(403);
	});

	it('should decline invitation successfully', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: 'mem1', status: 'invited' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'mem1', user_id: UUID2, status: 'declined' }] });
		const { POST } = require('@/app/api/challenges/[id]/decline/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/decline?user_id=${UUID2}`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.member.status).toBe('declined');
	});
});

// ===========================================
// PUT /api/challenges/:id/ready
// ===========================================
describe('PUT /api/challenges/:id/ready', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { PUT } = require('@/app/api/challenges/[id]/ready/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/ready`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isReady: true }),
		});
		const res = await PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});

	it('should return 403 when not accepted member', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { PUT } = require('@/app/api/challenges/[id]/ready/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/ready?user_id=${UUID2}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isReady: true }),
		});
		const res = await PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(403);
	});

	it('should return 409 when challenge not in formation', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mem1', challenge_status: 'active' }] });
		const { PUT } = require('@/app/api/challenges/[id]/ready/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/ready?user_id=${UUID2}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isReady: true }),
		});
		const res = await PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(409);
	});

	it('should toggle ready status', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: 'mem1', challenge_status: 'formation' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'mem1', is_ready: true }] })
			.mockResolvedValueOnce({ rows: [{ total: 3, ready: 2 }] }); // readiness count
		const { PUT } = require('@/app/api/challenges/[id]/ready/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/ready?user_id=${UUID2}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isReady: true }),
		});
		const res = await PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.is_ready).toBe(true);
		expect(body.readiness).toBeDefined();
	});

	it('should report all_ready when everyone is ready', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: 'mem1', challenge_status: 'formation' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'mem1', is_ready: true }] })
			.mockResolvedValueOnce({ rows: [{ total: 3, ready: 3 }] });
		const { PUT } = require('@/app/api/challenges/[id]/ready/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/ready?user_id=${UUID1}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isReady: true }),
		});
		const res = await PUT(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.readiness.all_ready).toBe(true);
	});
});

// ===========================================
// POST /api/challenges/:id/leave
// ===========================================
describe('POST /api/challenges/:id/leave', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { POST } = require('@/app/api/challenges/[id]/leave/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/leave`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});

	it('should return 400 when host tries to leave', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mem1', role: 'host', challenge_status: 'formation' }] });
		const { POST } = require('@/app/api/challenges/[id]/leave/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/leave?user_id=${UUID1}`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(400);
		expect(body.error).toContain('Host cannot leave');
	});

	it('should return 400 when challenge is active', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: 'mem1', role: 'member', challenge_status: 'active' }] });
		const { POST } = require('@/app/api/challenges/[id]/leave/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/leave?user_id=${UUID2}`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});

	it('should leave challenge successfully', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: 'mem1', role: 'member', challenge_status: 'formation' }] })
			.mockResolvedValueOnce({ rows: [] }); // delete member
		const { POST } = require('@/app/api/challenges/[id]/leave/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/leave?user_id=${UUID2}`, { method: 'POST' });
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.message).toContain('Left challenge');
	});
});

// ===========================================
// GET /api/challenges/public
// ===========================================
describe('GET /api/challenges/public', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return public formation challenges', async () => {
		mockQuery
			.mockResolvedValueOnce({
				rows: [
					{
						id: CHALLENGE_ID, title: 'Morning Run', status: 'formation',
						member_count: 2, max_members: 10, creator_username: 'alice',
					},
				],
			})
			.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		const { GET } = require('@/app/api/challenges/public/route');
		const req = new Request('http://localhost:3000/api/challenges/public');
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.challenges).toHaveLength(1);
		expect(body.challenges[0].status).toBe('formation');
	});

	it('should support search query', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ count: 0 }] });
		const { GET } = require('@/app/api/challenges/public/route');
		const req = new Request('http://localhost:3000/api/challenges/public?q=morning');
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.challenges).toEqual([]);
	});

	it('should exclude challenges user is already member of', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ count: 0 }] });
		const { GET } = require('@/app/api/challenges/public/route');
		const req = new Request(`http://localhost:3000/api/challenges/public?user_id=${UUID1}`);
		const res = await GET(req);
		expect(res.status).toBe(200);
	});
});
