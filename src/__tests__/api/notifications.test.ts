import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

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

const USER_ID = '9065e038-3ebf-411f-af59-d64e12259533';
const OTHER_USER = 'e30d4258-a336-4dcb-9534-7c753e765db7';
const NOTIF_ID = 'aaaa0000-1111-2222-3333-444455556666';
const NOTIF_ID2 = 'bbbb0000-1111-2222-3333-444455556666';
const CHALLENGE_ID = 'f79aacef-8b1e-469d-b99c-afcba004f02a';
const BASE = 'http://localhost:3000';

// =============================================
// GET /api/notifications
// =============================================
describe('GET /api/notifications', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { GET } = require('@/app/api/notifications/route');
		const req = new Request(`${BASE}/api/notifications`);
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return notifications for the user sorted by created_at DESC', async () => {
		// count query
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] });
		// unread count
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		// notifications
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ id: NOTIF_ID, type: 'friend_request', metadata: { fromUserId: OTHER_USER }, is_read: false, created_at: '2026-04-17T10:00:00Z' },
				{ id: NOTIF_ID2, type: 'friend_accepted', metadata: { userId: OTHER_USER }, is_read: true, created_at: '2026-04-17T09:00:00Z' },
			],
		});

		const { GET } = require('@/app/api/notifications/route');
		const req = new Request(`${BASE}/api/notifications?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.notifications).toHaveLength(2);
		expect(body.notifications[0].category).toBe('social');
		expect(body.notifications[1].category).toBe('social');
		expect(body.unread_count).toBe(1);
		expect(body.total).toBe(2);
		expect(body.page).toBe(1);
	});

	it('should filter by is_read=false', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ id: NOTIF_ID, type: 'friend_request', metadata: { fromUserId: OTHER_USER }, is_read: false, created_at: '2026-04-17T10:00:00Z' },
			],
		});

		const { GET } = require('@/app/api/notifications/route');
		const req = new Request(`${BASE}/api/notifications?user_id=${USER_ID}&is_read=false`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.notifications).toHaveLength(1);
		expect(body.notifications[0].is_read).toBe(false);

		// Verify the filter was applied in the SQL query
		const countCall = mockQuery.mock.calls[0];
		expect(countCall[0]).toContain('is_read');
	});

	it('should filter by category=social', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ id: NOTIF_ID, type: 'friend_request', metadata: { fromUserId: OTHER_USER }, is_read: false, created_at: '2026-04-17T10:00:00Z' },
			],
		});

		const { GET } = require('@/app/api/notifications/route');
		const req = new Request(`${BASE}/api/notifications?user_id=${USER_ID}&category=social`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.notifications).toHaveLength(1);
		// Verify category filter was applied via type IN (...)
		const countCall = mockQuery.mock.calls[0];
		expect(countCall[0]).toContain('type');
	});

	it('should filter by category=challenge', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ id: NOTIF_ID, type: 'challenge_invite', metadata: { challengeId: CHALLENGE_ID }, is_read: true, created_at: '2026-04-17T10:00:00Z' },
			],
		});

		const { GET } = require('@/app/api/notifications/route');
		const req = new Request(`${BASE}/api/notifications?user_id=${USER_ID}&category=challenge`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.notifications[0].category).toBe('challenge');
	});

	it('should compute unread_count with separate COUNT query', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 10 }] }); // total
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] });  // unread
		mockQuery.mockResolvedValueOnce({ rows: [] });               // notifications

		const { GET } = require('@/app/api/notifications/route');
		const req = new Request(`${BASE}/api/notifications?user_id=${USER_ID}`);
		const res = await GET(req);
		const body = await res.json();

		expect(body.unread_count).toBe(5);
		// Verify unread_count came from separate query
		expect(mockQuery).toHaveBeenCalledTimes(3);
		const unreadCall = mockQuery.mock.calls[1];
		expect(unreadCall[0]).toContain('is_read = false');
	});
});

// =============================================
// PUT /api/notifications/read
// =============================================
describe('PUT /api/notifications/read', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { PUT } = require('@/app/api/notifications/read/route');
		const req = new Request(`${BASE}/api/notifications/read`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ notification_ids: [NOTIF_ID] }),
		});
		const res = await PUT(req);
		expect(res.status).toBe(400);
	});

	it('should mark specific notifications as read', async () => {
		mockQuery.mockResolvedValueOnce({ rowCount: 2 });

		const { PUT } = require('@/app/api/notifications/read/route');
		const req = new Request(`${BASE}/api/notifications/read?user_id=${USER_ID}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ notification_ids: [NOTIF_ID, NOTIF_ID2] }),
		});
		const res = await PUT(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.updated_count).toBe(2);

		// Verify only user's notifications are updated
		const queryCall = mockQuery.mock.calls[0];
		expect(queryCall[0]).toContain('user_id');
		expect(queryCall[0]).toContain('id = ANY');
	});

	it('should mark all notifications as read with mark_all=true', async () => {
		mockQuery.mockResolvedValueOnce({ rowCount: 5 });

		const { PUT } = require('@/app/api/notifications/read/route');
		const req = new Request(`${BASE}/api/notifications/read?user_id=${USER_ID}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mark_all: true }),
		});
		const res = await PUT(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.updated_count).toBe(5);

		const queryCall = mockQuery.mock.calls[0];
		expect(queryCall[0]).not.toContain('id = ANY');
	});

	it('should return 400 if neither notification_ids nor mark_all provided', async () => {
		const { PUT } = require('@/app/api/notifications/read/route');
		const req = new Request(`${BASE}/api/notifications/read?user_id=${USER_ID}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		});
		const res = await PUT(req);
		expect(res.status).toBe(400);
	});

	it('should be idempotent for already-read notifications', async () => {
		mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // already read

		const { PUT } = require('@/app/api/notifications/read/route');
		const req = new Request(`${BASE}/api/notifications/read?user_id=${USER_ID}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ notification_ids: [NOTIF_ID] }),
		});
		const res = await PUT(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.updated_count).toBe(0);
	});
});

// =============================================
// DELETE /api/notifications/:id
// =============================================
describe('DELETE /api/notifications/:id', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { DELETE } = require('@/app/api/notifications/[id]/route');
		const req = new Request(`${BASE}/api/notifications/${NOTIF_ID}`, { method: 'DELETE' });
		const res = await DELETE(req, { params: Promise.resolve({ id: NOTIF_ID }) });
		expect(res.status).toBe(400);
	});

	it('should delete own notification and return 200', async () => {
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });

		const { DELETE } = require('@/app/api/notifications/[id]/route');
		const req = new Request(`${BASE}/api/notifications/${NOTIF_ID}?user_id=${USER_ID}`, { method: 'DELETE' });
		const res = await DELETE(req, { params: Promise.resolve({ id: NOTIF_ID }) });
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.message).toContain('deleted');
	});

	it('should return 404 if notification not found or belongs to another user', async () => {
		mockQuery.mockResolvedValueOnce({ rowCount: 0 });

		const { DELETE } = require('@/app/api/notifications/[id]/route');
		const req = new Request(`${BASE}/api/notifications/${NOTIF_ID}?user_id=${USER_ID}`, { method: 'DELETE' });
		const res = await DELETE(req, { params: Promise.resolve({ id: NOTIF_ID }) });
		expect(res.status).toBe(404);
	});
});

// =============================================
// GET /api/widget/summary
// =============================================
describe('GET /api/widget/summary', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { GET } = require('@/app/api/widget/summary/route');
		const req = new Request(`${BASE}/api/widget/summary`);
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return widget summary with streak, challenges, and unread count', async () => {
		// opportunistic formation transition
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// current streak query
		mockQuery.mockResolvedValueOnce({
			rows: [{ current_streak: 12 }],
		});
		// active challenges
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID,
				title: '5AM Warrior',
				hearts_left: 3,
				total_hearts: 4,
				reset_time: '00:00:00',
				member_count: 4,
				my_checkin_today: true,
				members_checked_in: 2,
			}],
		});
		// unread notifications count
		mockQuery.mockResolvedValueOnce({
			rows: [{ count: 3 }],
		});

		const { GET } = require('@/app/api/widget/summary/route');
		const req = new Request(`${BASE}/api/widget/summary?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.current_streak).toBe(12);
		expect(body.active_challenges).toHaveLength(1);
		expect(body.active_challenges[0].title).toBe('5AM Warrior');
		expect(body.active_challenges[0].hearts_left).toBe(3);
		expect(body.active_challenges[0].my_checkin_today).toBe(true);
		expect(body.unread_notifications).toBe(3);
	});

	it('should return empty active_challenges when user has none', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // opportunistic formation transition
		mockQuery.mockResolvedValueOnce({ rows: [{ current_streak: 0 }] });
		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });

		const { GET } = require('@/app/api/widget/summary/route');
		const req = new Request(`${BASE}/api/widget/summary?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.current_streak).toBe(0);
		expect(body.active_challenges).toEqual([]);
		expect(body.unread_notifications).toBe(0);
	});

	it('should return streak 0 if no stats row exists', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // opportunistic formation transition
		mockQuery.mockResolvedValueOnce({ rows: [] }); // no stats
		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });

		const { GET } = require('@/app/api/widget/summary/route');
		const req = new Request(`${BASE}/api/widget/summary?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.current_streak).toBe(0);
	});
});

// =============================================
// GET /api/sync
// =============================================
describe('GET /api/sync', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 if user_id is missing', async () => {
		const { GET } = require('@/app/api/sync/route');
		const req = new Request(`${BASE}/api/sync`);
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return pending overlays and mark them as shown', async () => {
		const overlayNotifs = [
			{ id: NOTIF_ID, type: 'heart_lost', metadata: { challenge_id: CHALLENGE_ID, challenge_title: '5AM Warrior', missed_user: 'john', hearts_remaining: 2 }, created_at: '2026-04-15T10:00:00Z' },
			{ id: NOTIF_ID2, type: 'badge_earned', metadata: { badge_name: 'Week Warrior', badge_icon_url: '/b.png' }, created_at: '2026-04-16T10:00:00Z' },
		];
		// SELECT pending
		mockQuery.mockResolvedValueOnce({ rows: overlayNotifs });
		// UPDATE shown_at
		mockQuery.mockResolvedValueOnce({ rowCount: 2 });

		const { GET } = require('@/app/api/sync/route');
		const req = new Request(`${BASE}/api/sync?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.pending_overlays).toHaveLength(2);
		expect(body.pending_overlays[0].type).toBe('heart_lost');
		expect(body.pending_overlays[1].type).toBe('badge_earned');

		// Verify shown_at was updated
		expect(mockQuery).toHaveBeenCalledTimes(2);
		const updateCall = mockQuery.mock.calls[1];
		expect(updateCall[0]).toContain('shown_at');
	});

	it('should return empty overlays if nothing pending', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { GET } = require('@/app/api/sync/route');
		const req = new Request(`${BASE}/api/sync?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.pending_overlays).toEqual([]);

		// Should NOT call update when there are no pending items
		expect(mockQuery).toHaveBeenCalledTimes(1);
	});

	it('should not return already-shown overlays', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // all shown_at != null

		const { GET } = require('@/app/api/sync/route');
		const req = new Request(`${BASE}/api/sync?user_id=${USER_ID}`);
		const res = await GET(req);
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.pending_overlays).toEqual([]);
	});

	it('should sort overlays oldest first', async () => {
		const overlayNotifs = [
			{ id: NOTIF_ID, type: 'heart_lost', metadata: { challenge_id: CHALLENGE_ID }, created_at: '2026-04-15T10:00:00Z' },
			{ id: NOTIF_ID2, type: 'badge_earned', metadata: { badge_name: 'Week Warrior' }, created_at: '2026-04-16T10:00:00Z' },
		];
		mockQuery.mockResolvedValueOnce({ rows: overlayNotifs });
		mockQuery.mockResolvedValueOnce({ rowCount: 2 });

		const { GET } = require('@/app/api/sync/route');
		const req = new Request(`${BASE}/api/sync?user_id=${USER_ID}`);
		const res = await GET(req);
		const body = await res.json();

		// Verify SQL has ORDER BY created_at ASC
		const selectCall = mockQuery.mock.calls[0];
		expect(selectCall[0]).toContain('ORDER BY created_at ASC');
	});
});
