import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const UUID1 = '00000000-0000-4000-a000-000000000001';
const UUID2 = '00000000-0000-4000-a000-000000000002';
const UUID3 = '00000000-0000-4000-a000-000000000003';
const UUID_NONEXISTENT = '00000000-0000-4000-a000-000000000099';
const REQ_ID = '00000000-0000-4000-a000-0000000000a1';
const REQ_ID_NEW = '00000000-0000-4000-a000-0000000000a2';

beforeAll(() => {
	process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
	process.env.JWT_ACCESS_SECRET = 'test-access-secret';
	process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
	process.env.CRON_SECRET = 'test-cron-secret';
	process.env.APP_BASE_URL = 'http://localhost:3000';
	process.env.NODE_ENV = 'test';
});

// Mock DB
const mockQuery = jest.fn();
jest.mock('@/lib/db', () => ({
	pool: { query: jest.fn(), end: jest.fn() },
	query: (...args: unknown[]) => mockQuery(...args),
}));

// Mock streak service
jest.mock('@/lib/services/streakService', () => ({
	calculateStreak: jest.fn().mockResolvedValue(5),
}));

// ===========================================
// GET /api/users/search
// ===========================================
describe('GET /api/users/search', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when q is missing', async () => {
		const { GET } = require('@/app/api/users/search/route');
		const req = new Request('http://localhost:3000/api/users/search');
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return 400 when q is too short (< 2 chars)', async () => {
		const { GET } = require('@/app/api/users/search/route');
		const req = new Request('http://localhost:3000/api/users/search?q=a');
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return matching users', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [
				{
					id: UUID2,
					username: 'maya_z',
					display_name: 'Maya Z.',
					avatar_url: null,
					is_private: false,
				},
			],
		});
		const { GET } = require('@/app/api/users/search/route');
		const req = new Request(`http://localhost:3000/api/users/search?q=maya&user_id=${UUID1}`);
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.users).toHaveLength(1);
		expect(body.users[0].username).toBe('maya_z');
	});

	it('should exclude current user from results', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { GET } = require('@/app/api/users/search/route');
		const req = new Request(`http://localhost:3000/api/users/search?q=maya&user_id=${UUID1}`);
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.users).toHaveLength(0);
	});
});

// ===========================================
// POST /api/friends/request
// ===========================================
describe('POST /api/friends/request', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when receiver_id is missing', async () => {
		const { POST } = require('@/app/api/friends/request/route');
		const req = new Request(`http://localhost:3000/api/friends/request?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({}),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 400 when sending request to self', async () => {
		const { POST } = require('@/app/api/friends/request/route');
		const req = new Request(`http://localhost:3000/api/friends/request?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ receiver_id: UUID1 }),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 404 when receiver does not exist', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // receiver not found
		const { POST } = require('@/app/api/friends/request/route');
		const req = new Request(`http://localhost:3000/api/friends/request?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ receiver_id: UUID_NONEXISTENT }),
		});
		const res = await POST(req);
		expect(res.status).toBe(404);
	});

	it('should return 409 when already friends', async () => {
		// receiver exists
		mockQuery.mockResolvedValueOnce({ rows: [{ id: UUID2 }] });
		// existing friendship check — already accepted
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: REQ_ID, sender_id: UUID1, receiver_id: UUID2, status: 'accepted' }],
		});
		const { POST } = require('@/app/api/friends/request/route');
		const req = new Request(`http://localhost:3000/api/friends/request?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ receiver_id: UUID2 }),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(409);
		expect(body.error).toMatch(/already friends/i);
	});

	it('should return 409 when request already sent', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: UUID2 }] });
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: REQ_ID, sender_id: UUID1, receiver_id: UUID2, status: 'pending' }],
		});
		const { POST } = require('@/app/api/friends/request/route');
		const req = new Request(`http://localhost:3000/api/friends/request?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ receiver_id: UUID2 }),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(409);
		expect(body.error).toMatch(/already sent/i);
	});

	it('should create friend request successfully', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: UUID2 }] }); // receiver exists
		mockQuery.mockResolvedValueOnce({ rows: [] }); // no existing relationship
		mockQuery.mockResolvedValueOnce({ rows: [{ id: REQ_ID_NEW, sender_id: UUID1, receiver_id: UUID2, status: 'pending', created_at: '2026-01-01' }] }); // INSERT friend_request
		mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT notification
		const { POST } = require('@/app/api/friends/request/route');
		const req = new Request(`http://localhost:3000/api/friends/request?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ receiver_id: UUID2 }),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(201);
		expect(body.request.status).toBe('pending');
	});
});

// ===========================================
// PUT /api/friends/request/:requestId/respond
// ===========================================
describe('PUT /api/friends/request/:requestId/respond', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 for invalid action', async () => {
		const { PUT } = require('@/app/api/friends/request/[requestId]/respond/route');
		const req = new Request(`http://localhost:3000/api/friends/request/${REQ_ID}/respond?user_id=${UUID2}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'invalid' }),
		});
		const res = await PUT(req, { params: Promise.resolve({ requestId: REQ_ID }) });
		expect(res.status).toBe(400);
	});

	it('should return 404 when request not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { PUT } = require('@/app/api/friends/request/[requestId]/respond/route');
		const req = new Request(`http://localhost:3000/api/friends/request/${REQ_ID}/respond?user_id=${UUID2}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'accept' }),
		});
		const res = await PUT(req, { params: Promise.resolve({ requestId: REQ_ID }) });
		expect(res.status).toBe(404);
	});

	it('should return 403 when user is not the receiver', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: REQ_ID, sender_id: UUID1, receiver_id: UUID3, status: 'pending' }],
		});
		const { PUT } = require('@/app/api/friends/request/[requestId]/respond/route');
		const req = new Request(`http://localhost:3000/api/friends/request/${REQ_ID}/respond?user_id=${UUID2}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'accept' }),
		});
		const res = await PUT(req, { params: Promise.resolve({ requestId: REQ_ID }) });
		expect(res.status).toBe(403);
	});

	it('should return 409 when request already processed', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: REQ_ID, sender_id: UUID1, receiver_id: UUID2, status: 'accepted' }],
		});
		const { PUT } = require('@/app/api/friends/request/[requestId]/respond/route');
		const req = new Request(`http://localhost:3000/api/friends/request/${REQ_ID}/respond?user_id=${UUID2}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'accept' }),
		});
		const res = await PUT(req, { params: Promise.resolve({ requestId: REQ_ID }) });
		expect(res.status).toBe(409);
	});

	it('should accept friend request successfully', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: REQ_ID, sender_id: UUID1, receiver_id: UUID2, status: 'pending' }],
		});
		// UPDATE status
		mockQuery.mockResolvedValueOnce({ rows: [{ id: REQ_ID, status: 'accepted' }] });
		// INSERT activity for sender
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// INSERT activity for receiver
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// INSERT notification for sender
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { PUT } = require('@/app/api/friends/request/[requestId]/respond/route');
		const req = new Request(`http://localhost:3000/api/friends/request/${REQ_ID}/respond?user_id=${UUID2}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'accept' }),
		});
		const res = await PUT(req, { params: Promise.resolve({ requestId: REQ_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.request.status).toBe('accepted');
	});

	it('should decline friend request successfully', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: REQ_ID, sender_id: UUID1, receiver_id: UUID2, status: 'pending' }],
		});
		// UPDATE status
		mockQuery.mockResolvedValueOnce({ rows: [{ id: REQ_ID, status: 'declined' }] });

		const { PUT } = require('@/app/api/friends/request/[requestId]/respond/route');
		const req = new Request(`http://localhost:3000/api/friends/request/${REQ_ID}/respond?user_id=${UUID2}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'decline' }),
		});
		const res = await PUT(req, { params: Promise.resolve({ requestId: REQ_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.request.status).toBe('declined');
	});
});

// ===========================================
// GET /api/friends
// ===========================================
describe('GET /api/friends', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { GET } = require('@/app/api/friends/route');
		const req = new Request('http://localhost:3000/api/friends');
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return friends list', async () => {
		// friends query
		mockQuery.mockResolvedValueOnce({
			rows: [
				{
					id: UUID2,
					username: 'maya_z',
					display_name: 'Maya Z.',
					avatar_url: null,
					active_challenges_count: '2',
					current_streak: 5,
				},
			],
		});
		// count query
		mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });

		const { GET } = require('@/app/api/friends/route');
		const req = new Request(`http://localhost:3000/api/friends?user_id=${UUID1}`);
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.friends).toHaveLength(1);
		expect(body.friends[0].username).toBe('maya_z');
		expect(body.total).toBe(1);
	});

	it('should paginate correctly', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
		const { GET } = require('@/app/api/friends/route');
		const req = new Request(`http://localhost:3000/api/friends?user_id=${UUID1}&page=2&limit=10`);
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.page).toBe(2);
	});
});

// ===========================================
// GET /api/friends/requests/pending
// ===========================================
describe('GET /api/friends/requests/pending', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { GET } = require('@/app/api/friends/requests/pending/route');
		const req = new Request('http://localhost:3000/api/friends/requests/pending');
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return pending incoming requests', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [
				{
					id: REQ_ID,
					sender_id: UUID2,
					sender_username: 'maya_z',
					sender_display_name: 'Maya Z.',
					sender_avatar_url: null,
					created_at: '2026-01-01T00:00:00Z',
				},
			],
		});
		const { GET } = require('@/app/api/friends/requests/pending/route');
		const req = new Request(`http://localhost:3000/api/friends/requests/pending?user_id=${UUID1}`);
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.requests).toHaveLength(1);
		expect(body.requests[0].sender.username).toBe('maya_z');
	});
});

// ===========================================
// DELETE /api/friends/:friendUserId
// ===========================================
describe('DELETE /api/friends/:friendUserId', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { DELETE } = require('@/app/api/friends/[friendUserId]/route');
		const req = new Request(`http://localhost:3000/api/friends/${UUID2}`, { method: 'DELETE' });
		const res = await DELETE(req, { params: Promise.resolve({ friendUserId: UUID2 }) });
		expect(res.status).toBe(400);
	});

	it('should return 404 when not friends', async () => {
		mockQuery.mockResolvedValueOnce({ rowCount: 0 });
		const { DELETE } = require('@/app/api/friends/[friendUserId]/route');
		const req = new Request(`http://localhost:3000/api/friends/${UUID2}?user_id=${UUID1}`, { method: 'DELETE' });
		const res = await DELETE(req, { params: Promise.resolve({ friendUserId: UUID2 }) });
		expect(res.status).toBe(404);
	});

	it('should delete friendship successfully', async () => {
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		const { DELETE } = require('@/app/api/friends/[friendUserId]/route');
		const req = new Request(`http://localhost:3000/api/friends/${UUID2}?user_id=${UUID1}`, { method: 'DELETE' });
		const res = await DELETE(req, { params: Promise.resolve({ friendUserId: UUID2 }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.message).toMatch(/unfriended/i);
	});
});

// ===========================================
// GET /api/users/:userId/profile
// ===========================================
describe('GET /api/users/:userId/profile', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 404 when user not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { GET } = require('@/app/api/users/[userId]/profile/route');
		const req = new Request(`http://localhost:3000/api/users/${UUID2}/profile?user_id=${UUID1}`);
		const res = await GET(req, { params: Promise.resolve({ userId: UUID2 }) });
		expect(res.status).toBe(404);
	});

	it('should return full profile for friends', async () => {
		// target user
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: UUID2, username: 'maya_z', display_name: 'Maya Z.',
				avatar_url: null, bio: 'Hello', is_private: false, is_active: true,
			}],
		});
		// relationship check — friends
		mockQuery.mockResolvedValueOnce({
			rows: [{ sender_id: UUID1, receiver_id: UUID2, status: 'accepted' }],
		});
		// stats: challenges_joined
		mockQuery.mockResolvedValueOnce({ rows: [{ count: '8' }] });
		// stats: completion rate
		mockQuery.mockResolvedValueOnce({ rows: [{ total: '10', completed: '8' }] });
		// badges
		mockQuery.mockResolvedValueOnce({ rows: [{ id: 'badge-1', name: 'Early Bird', icon_url: null }] });
		// activities
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: 'act-1', type: 'checkin_done', metadata: {}, created_at: '2026-01-01' }],
		});

		const { GET } = require('@/app/api/users/[userId]/profile/route');
		const req = new Request(`http://localhost:3000/api/users/${UUID2}/profile?user_id=${UUID1}`);
		const res = await GET(req, { params: Promise.resolve({ userId: UUID2 }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.relationship).toBe('friend');
		expect(body.stats).toBeDefined();
		expect(body.badges).toHaveLength(1);
		expect(body.latest_activities).toHaveLength(1);
	});

	it('should return limited profile for strangers', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: UUID2, username: 'maya_z', display_name: 'Maya Z.',
				avatar_url: null, bio: null, is_private: false, is_active: true,
			}],
		});
		// no relationship
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// no shared challenge
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { GET } = require('@/app/api/users/[userId]/profile/route');
		const req = new Request(`http://localhost:3000/api/users/${UUID2}/profile?user_id=${UUID1}`);
		const res = await GET(req, { params: Promise.resolve({ userId: UUID2 }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.relationship).toBe('none');
		expect(body.stats).toBeNull();
		expect(body.badges).toBeNull();
		expect(body.latest_activities).toBeNull();
	});

	it('should return own profile with full data', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: UUID1, username: 'me', display_name: 'Me',
				avatar_url: null, bio: 'bio', is_private: false, is_active: true,
			}],
		});
		// stats: challenges_joined
		mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });
		// stats: completion rate
		mockQuery.mockResolvedValueOnce({ rows: [{ total: '5', completed: '4' }] });
		// badges
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// activities
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { GET } = require('@/app/api/users/[userId]/profile/route');
		const req = new Request(`http://localhost:3000/api/users/${UUID1}/profile?user_id=${UUID1}`);
		const res = await GET(req, { params: Promise.resolve({ userId: UUID1 }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.relationship).toBe('self');
		expect(body.stats).toBeDefined();
	});
});

// ===========================================
// Streak Service
// ===========================================
describe('Streak Service', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 0 when no checkins', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		jest.unmock('@/lib/services/streakService');
		const { calculateStreak } = require('@/lib/services/streakService');
		const streak = await calculateStreak('user-1');
		expect(streak).toBe(0);
	});

	it('should return correct streak for consecutive days', async () => {
		const today = new Date();
		const days = [];
		for (let i = 0; i < 5; i++) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			days.push({ checkin_date: d.toISOString().split('T')[0] });
		}
		mockQuery.mockResolvedValueOnce({ rows: days });
		jest.unmock('@/lib/services/streakService');
		const { calculateStreak } = require('@/lib/services/streakService');
		const streak = await calculateStreak('user-1');
		expect(streak).toBe(5);
	});

	it('should break streak when gap exists', async () => {
		const today = new Date();
		const days = [
			{ checkin_date: today.toISOString().split('T')[0] },
			{
				checkin_date: (() => {
					const d = new Date(today);
					d.setDate(d.getDate() - 1);
					return d.toISOString().split('T')[0];
				})(),
			},
			// gap of 1 day (skip -2)
			{
				checkin_date: (() => {
					const d = new Date(today);
					d.setDate(d.getDate() - 3);
					return d.toISOString().split('T')[0];
				})(),
			},
		];
		mockQuery.mockResolvedValueOnce({ rows: days });
		jest.unmock('@/lib/services/streakService');
		const { calculateStreak } = require('@/lib/services/streakService');
		const streak = await calculateStreak('user-1');
		expect(streak).toBe(2);
	});

	it('should return 0 when last checkin is more than 1 day ago', async () => {
		const twoDaysAgo = new Date();
		twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
		mockQuery.mockResolvedValueOnce({
			rows: [{ checkin_date: twoDaysAgo.toISOString().split('T')[0] }],
		});
		jest.unmock('@/lib/services/streakService');
		const { calculateStreak } = require('@/lib/services/streakService');
		const streak = await calculateStreak('user-1');
		expect(streak).toBe(0);
	});
});
