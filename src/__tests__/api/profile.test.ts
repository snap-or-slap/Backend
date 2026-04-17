import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

beforeAll(() => {
	process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
	process.env.JWT_ACCESS_SECRET = 'test-access-secret';
	process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
	process.env.CRON_SECRET = 'test-cron-secret';
	process.env.APP_BASE_URL = 'http://localhost:3000';
	process.env.NODE_ENV = 'test';
});

// Mock bcrypt
jest.mock('bcrypt', () => ({
	hash: jest.fn().mockResolvedValue('$2b$12$newhashedpassword'),
	compare: jest.fn().mockImplementation((plain: string) => {
		return Promise.resolve(plain === 'OldPassword123');
	}),
}));

// Mock DB
const mockQuery = jest.fn();
jest.mock('@/lib/db', () => ({
	pool: { query: jest.fn(), end: jest.fn() },
	query: (...args: unknown[]) => mockQuery(...args),
}));

// Mock streakService
jest.mock('@/lib/services/streakService', () => ({
	calculateStreak: jest.fn().mockResolvedValue(5),
}));

const USER_ID = '9065e038-3ebf-411f-af59-d64e12259533';
const BASE = 'http://localhost:3000';

// =============================================
// GET /api/users/me/profile
// =============================================
describe('GET /api/users/me/profile', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { GET } = require('@/app/api/users/me/profile/route');
		const req = new Request(`${BASE}/api/users/me/profile`);
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return 404 if user not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // user query
		const { GET } = require('@/app/api/users/me/profile/route');
		const req = new Request(`${BASE}/api/users/me/profile?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(404);
	});

	it('should return full profile with stats, badges, activities', async () => {
		// user query
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: USER_ID, email: 'alice@example.com', username: 'alice',
				display_name: 'Alice', avatar_url: null, bio: 'Hi', is_private: false,
				is_active: true, created_at: '2025-01-01',
			}],
		});
		// stats query
		mockQuery.mockResolvedValueOnce({
			rows: [{
				user_id: USER_ID, challenges_joined: 3, challenges_completed: 1,
				total_checkins: 10, current_streak: 5, best_streak: 7,
			}],
		});
		// earned badges
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: 'b1', name: 'First', slug: 'challenge-1', description: 'First', icon_url: '/b.png', condition_type: 'challenges_completed', condition_value: 1, earned_at: '2025-01-02' }],
		});
		// locked badges
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: 'b2', name: 'Streak 7', slug: 'streak-7', description: 'Streak', icon_url: '/s.png', condition_type: 'streak_days', condition_value: 7 }],
		});
		// activities
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: 'a1', type: 'challenge_joined', metadata: { title: 'Test' }, created_at: '2025-01-01' }],
		});

		const { GET } = require('@/app/api/users/me/profile/route');
		const req = new Request(`${BASE}/api/users/me/profile?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user).toBeDefined();
		expect(body.stats).toBeDefined();
		expect(body.badges).toHaveLength(1);
		expect(body.badges_locked).toHaveLength(1);
		expect(body.recent_activities).toHaveLength(1);
	});
});

// =============================================
// GET /api/users/me/activities
// =============================================
describe('GET /api/users/me/activities', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { GET } = require('@/app/api/users/me/activities/route');
		const req = new Request(`${BASE}/api/users/me/activities`);
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return paginated activities', async () => {
		// total count
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 25 }] });
		// activities
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ id: 'a1', type: 'challenge_joined', metadata: { title: 'X' }, created_at: '2025-01-01' },
				{ id: 'a2', type: 'badge_earned', metadata: { badge_name: 'First' }, created_at: '2025-01-02' },
			],
		});

		const { GET } = require('@/app/api/users/me/activities/route');
		const req = new Request(`${BASE}/api/users/me/activities?user_id=${USER_ID}&page=1&limit=2`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.activities).toHaveLength(2);
		expect(body.pagination.total).toBe(25);
		expect(body.pagination.page).toBe(1);
		expect(body.pagination.limit).toBe(2);
		expect(body.pagination.total_pages).toBe(13);
	});

	it('should filter by type', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] });
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: 'a1', type: 'badge_earned', metadata: {}, created_at: '2025-01-01' }],
		});

		const { GET } = require('@/app/api/users/me/activities/route');
		const req = new Request(`${BASE}/api/users/me/activities?user_id=${USER_ID}&type=badge_earned`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.activities).toHaveLength(1);
	});
});

// =============================================
// GET /api/users/me/stats
// =============================================
describe('GET /api/users/me/stats', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { GET } = require('@/app/api/users/me/stats/route');
		const req = new Request(`${BASE}/api/users/me/stats`);
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return user stats', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				user_id: USER_ID, challenges_joined: 3, challenges_completed: 1,
				total_checkins: 10, current_streak: 5, best_streak: 7, updated_at: '2025-01-01',
			}],
		});

		const { GET } = require('@/app/api/users/me/stats/route');
		const req = new Request(`${BASE}/api/users/me/stats?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.stats.challenges_joined).toBe(3);
		expect(body.stats.current_streak).toBe(5);
	});

	it('should return defaults if no stats row', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { GET } = require('@/app/api/users/me/stats/route');
		const req = new Request(`${BASE}/api/users/me/stats?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.stats.challenges_joined).toBe(0);
	});
});

// =============================================
// PUT /api/users/me/settings
// =============================================
describe('PUT /api/users/me/settings', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { PUT } = require('@/app/api/users/me/settings/route');
		const req = new Request(`${BASE}/api/users/me/settings`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ isPrivate: true }),
		});
		const res = await PUT(req);
		expect(res.status).toBe(400);
	});

	it('should update is_private setting', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: USER_ID, is_private: true }],
		});

		const { PUT } = require('@/app/api/users/me/settings/route');
		const req = new Request(`${BASE}/api/users/me/settings?user_id=${USER_ID}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ isPrivate: true }),
		});
		const res = await PUT(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.user.is_private).toBe(true);
	});
});

// =============================================
// POST /api/auth/change-password
// =============================================
describe('POST /api/auth/change-password', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { POST } = require('@/app/api/auth/change-password/route');
		const req = new Request(`${BASE}/api/auth/change-password`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ currentPassword: 'OldPassword123', newPassword: 'NewPassword123' }),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 401 if current password is wrong', async () => {
		// user lookup
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: USER_ID, password_hash: '$2b$12$existinghash' }],
		});

		const { POST } = require('@/app/api/auth/change-password/route');
		const req = new Request(`${BASE}/api/auth/change-password?user_id=${USER_ID}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ currentPassword: 'WrongPassword123', newPassword: 'NewPassword123' }),
		});
		const res = await POST(req);
		expect(res.status).toBe(401);
	});

	it('should change password successfully', async () => {
		// user lookup
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: USER_ID, password_hash: '$2b$12$existinghash' }],
		});
		// update password
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		// revoke tokens
		mockQuery.mockResolvedValueOnce({ rowCount: 2 });

		const { POST } = require('@/app/api/auth/change-password/route');
		const req = new Request(`${BASE}/api/auth/change-password?user_id=${USER_ID}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ currentPassword: 'OldPassword123', newPassword: 'NewPassword123' }),
		});
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.message).toContain('changed');
	});
});

// =============================================
// DELETE /api/users/me
// =============================================
describe('DELETE /api/users/me (soft delete)', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { DELETE } = require('@/app/api/users/me/route');
		const req = new Request(`${BASE}/api/users/me`, { method: 'DELETE' });
		const res = await DELETE(req);
		expect(res.status).toBe(400);
	});

	it('should soft-delete user account', async () => {
		// soft delete (anonymize)
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: USER_ID }],
		});
		// revoke tokens
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });

		const { DELETE } = require('@/app/api/users/me/route');
		const req = new Request(`${BASE}/api/users/me?user_id=${USER_ID}`, { method: 'DELETE' });
		const res = await DELETE(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.message).toContain('deleted');
	});

	it('should return 404 if user not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { DELETE } = require('@/app/api/users/me/route');
		const req = new Request(`${BASE}/api/users/me?user_id=${USER_ID}`, { method: 'DELETE' });
		const res = await DELETE(req);
		expect(res.status).toBe(404);
	});
});

// =============================================
// POST /api/users/me/stats/recalculate
// =============================================
describe('POST /api/users/me/stats/recalculate', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { POST } = require('@/app/api/users/me/stats/recalculate/route');
		const req = new Request(`${BASE}/api/users/me/stats/recalculate`, { method: 'POST' });
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should recalculate and return stats', async () => {
		// challenges_joined
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] });
		// challenges_completed
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		// total_checkins
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 10 }] });
		// existing best_streak
		mockQuery.mockResolvedValueOnce({ rows: [{ best_streak: 3 }] });
		// upsert
		mockQuery.mockResolvedValueOnce({
			rows: [{
				user_id: USER_ID, challenges_joined: 3, challenges_completed: 1,
				total_checkins: 10, current_streak: 5, best_streak: 5,
				updated_at: '2025-01-01',
			}],
		});

		const { POST } = require('@/app/api/users/me/stats/recalculate/route');
		const req = new Request(`${BASE}/api/users/me/stats/recalculate?user_id=${USER_ID}`, { method: 'POST' });
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.stats.challenges_joined).toBe(3);
	});
});

// =============================================
// POST /api/users/me/badges/check
// =============================================
describe('POST /api/users/me/badges/check', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { POST } = require('@/app/api/users/me/badges/check/route');
		const req = new Request(`${BASE}/api/users/me/badges/check`, { method: 'POST' });
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should check and award badges', async () => {
		// user stats
		mockQuery.mockResolvedValueOnce({
			rows: [{ challenges_completed: 1, current_streak: 5, best_streak: 7, total_checkins: 10 }],
		});
		// unearned badges
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ id: 'b1', slug: 'challenge-1', name: 'Challenge Starter', condition_type: 'challenges_completed', condition_value: 1 },
				{ id: 'b2', slug: 'streak-7', name: 'Week Warrior', condition_type: 'streak_days', condition_value: 7 },
				{ id: 'b3', slug: 'challenge-10', name: 'Challenge Master', condition_type: 'challenges_completed', condition_value: 10 },
			],
		});
		// award badge b1 (3 queries: insert, activity, notification)
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		// award badge b2 (3 queries)
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });

		const { POST } = require('@/app/api/users/me/badges/check/route');
		const req = new Request(`${BASE}/api/users/me/badges/check?user_id=${USER_ID}`, { method: 'POST' });
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.awarded).toContain('challenge-1');
		expect(body.awarded).toContain('streak-7');
		expect(body.awarded).not.toContain('challenge-10');
	});
});
