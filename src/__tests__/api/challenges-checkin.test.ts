import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const UUID1 = '00000000-0000-4000-a000-000000000001';
const UUID2 = '00000000-0000-4000-a000-000000000002';
const UUID3 = '00000000-0000-4000-a000-000000000003';
const CHALLENGE_ID = '00000000-0000-4000-a000-000000000c01';
const CHECKIN_ID = '00000000-0000-4000-a000-000000000d01';
const THREE_DAYS_AGO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

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

// ============================================
// getCurrentCycle service
// ============================================
describe('getCurrentCycle', () => {
	it('should return correct cycle for past start', () => {
		const { getCurrentCycle } = require('@/lib/services/checkinService');
		const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
		expect(getCurrentCycle(threeDaysAgo)).toBe(4);
	});

	it('should return 0 for future start', () => {
		const { getCurrentCycle } = require('@/lib/services/checkinService');
		const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
		expect(getCurrentCycle(tomorrow)).toBe(0);
	});
});

// ============================================
// POST /api/challenges/:id/checkins
// ============================================
describe('POST /api/challenges/:id/checkins', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should reject if user is not a member', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { POST } = require('@/app/api/challenges/[id]/checkins/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/checkins?user_id=${UUID1}`,
			{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(403);
	});

	it('should reject if challenge is not active', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ status: 'accepted', challenge_status: 'formation', start_at: THREE_DAYS_AGO, duration_days: 30, reset_time: '06:00', hearts_left: 3 }],
		});

		const { POST } = require('@/app/api/challenges/[id]/checkins/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/checkins?user_id=${UUID1}`,
			{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(409);
	});

	it('should reject if already checked in this cycle', async () => {
		mockQuery
			.mockResolvedValueOnce({
				rows: [{ status: 'accepted', challenge_status: 'active', start_at: THREE_DAYS_AGO, duration_days: 30, reset_time: '06:00', hearts_left: 3 }],
			})
			.mockResolvedValueOnce({ rows: [{ id: 'existing-checkin' }] });

		const { POST } = require('@/app/api/challenges/[id]/checkins/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/checkins?user_id=${UUID1}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					evidenceUrl: 'https://example.com/proofs/day-4.jpg',
					caption: 'Day 4!',
				}),
			}
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(409);
		expect(body.error).toContain('Already checked in');
	});

	it('should create checkin successfully', async () => {
		const now = new Date().toISOString();
		mockQuery
			.mockResolvedValueOnce({
				rows: [{ status: 'accepted', challenge_status: 'active', start_at: THREE_DAYS_AGO, duration_days: 30, reset_time: '06:00', hearts_left: 3 }],
			})
			.mockResolvedValueOnce({ rows: [] }) // no existing checkin
			.mockResolvedValueOnce({
				rows: [{
					id: CHECKIN_ID, challenge_id: CHALLENGE_ID, user_id: UUID1,
					cycle_number: 4, evidence_url: null, caption: 'Day 4!', checked_in_at: now,
				}],
			})
			.mockResolvedValueOnce({ rows: [{ members_checked_in: '1', members_total: '3' }] })
			.mockResolvedValueOnce({ rows: [{ total: '4' }] });

		const { POST } = require('@/app/api/challenges/[id]/checkins/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/checkins?user_id=${UUID1}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					evidenceUrl: 'https://example.com/proofs/day-4.jpg',
					caption: 'Day 4!',
				}),
			}
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(201);
		expect(body.checkin.id).toBe(CHECKIN_ID);
		expect(body.checkin.cycle_number).toBe(4);
		expect(body.squad_status.members_total).toBe(3);
		expect(body.total_checkins).toBe(4);
	});
});

// ============================================
// GET /api/challenges/:id/checkins/today
// ============================================
describe('GET /api/challenges/:id/checkins/today', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 404 if challenge not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { GET } = require('@/app/api/challenges/[id]/checkins/today/route');
		const req = new Request(`http://localhost/api/challenges/${CHALLENGE_ID}/checkins/today`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(404);
	});

	it('should reject if challenge is not active', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ status: 'formation', start_at: THREE_DAYS_AGO, duration_days: 30, reset_time: '06:00', hearts_left: 3 }],
		});

		const { GET } = require('@/app/api/challenges/[id]/checkins/today/route');
		const req = new Request(`http://localhost/api/challenges/${CHALLENGE_ID}/checkins/today`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(409);
	});

	it('should return member statuses for current cycle', async () => {
		mockQuery
			.mockResolvedValueOnce({
				rows: [{ status: 'active', start_at: THREE_DAYS_AGO, duration_days: 30, reset_time: '06:00', hearts_left: 3 }],
			})
			.mockResolvedValueOnce({
				rows: [
					{ user_id: UUID1, username: 'alice', display_name: 'Alice', avatar_url: null, checked_in_at: '2026-04-17T07:00:00Z', status: 'checked_in' },
					{ user_id: UUID2, username: 'bob', display_name: 'Bob', avatar_url: null, checked_in_at: null, status: 'pending' },
				],
			});

		const { GET } = require('@/app/api/challenges/[id]/checkins/today/route');
		const req = new Request(`http://localhost/api/challenges/${CHALLENGE_ID}/checkins/today`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.cycle_number).toBeGreaterThanOrEqual(1);
		expect(body.members).toHaveLength(2);
		expect(body.members[0].status).toBe('checked_in');
		expect(body.members[1].status).toBe('pending');
		expect(typeof body.time_until_reset).toBe('number');
	});
});

// ============================================
// GET /api/challenges/:id/checkins (gallery)
// ============================================
describe('GET /api/challenges/:id/checkins (gallery)', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should reject formation challenge', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ status: 'formation' }] });

		const { GET } = require('@/app/api/challenges/[id]/checkins/route');
		const req = new Request(`http://localhost/api/challenges/${CHALLENGE_ID}/checkins`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(409);
	});

	it('should return paginated checkins', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ status: 'active' }] })
			.mockResolvedValueOnce({
				rows: [
					{ id: CHECKIN_ID, user_id: UUID1, cycle_number: 3, evidence_url: null, caption: 'Day 3', checked_in_at: '2026-04-16T07:00:00Z', username: 'alice', display_name: 'Alice', avatar_url: null },
					{ id: '00000000-0000-4000-a000-000000000d02', user_id: UUID2, cycle_number: 3, evidence_url: null, caption: 'Day 3 bob', checked_in_at: '2026-04-16T08:00:00Z', username: 'bob', display_name: 'Bob', avatar_url: null },
				],
			})
			.mockResolvedValueOnce({ rows: [{ total: '5' }] });

		const { GET } = require('@/app/api/challenges/[id]/checkins/route');
		const req = new Request(`http://localhost/api/challenges/${CHALLENGE_ID}/checkins?page=1&limit=20`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.checkins).toHaveLength(2);
		expect(body.total).toBe(5);
		expect(body.page).toBe(1);
	});

	it('should filter by member_id', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ status: 'active' }] })
			.mockResolvedValueOnce({
				rows: [
					{ id: CHECKIN_ID, user_id: UUID1, cycle_number: 3, evidence_url: null, caption: 'Day 3', checked_in_at: '2026-04-16T07:00:00Z', username: 'alice', display_name: 'Alice', avatar_url: null },
				],
			})
			.mockResolvedValueOnce({ rows: [{ total: '3' }] });

		const { GET } = require('@/app/api/challenges/[id]/checkins/route');
		const req = new Request(`http://localhost/api/challenges/${CHALLENGE_ID}/checkins?member_id=${UUID1}`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.checkins).toHaveLength(1);
		expect(body.checkins[0].user_id).toBe(UUID1);
	});
});

// ============================================
// GET /api/challenges/:id/stats
// ============================================
describe('GET /api/challenges/:id/stats', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should reject formation challenge', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ status: 'formation' }] });

		const { GET } = require('@/app/api/challenges/[id]/stats/route');
		const req = new Request(`http://localhost/api/challenges/${CHALLENGE_ID}/stats`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(409);
	});

	it('should return challenge statistics', async () => {
		mockQuery
			.mockResolvedValueOnce({
				rows: [{ status: 'active', start_at: THREE_DAYS_AGO, duration_days: 30, hearts_left: 3 }],
			})
			.mockResolvedValueOnce({
				rows: [
					{ user_id: UUID1, username: 'alice', display_name: 'Alice', avatar_url: null, checkin_count: 3 },
					{ user_id: UUID2, username: 'bob', display_name: 'Bob', avatar_url: null, checkin_count: 2 },
				],
			});

		const { GET } = require('@/app/api/challenges/[id]/stats/route');
		const req = new Request(`http://localhost/api/challenges/${CHALLENGE_ID}/stats`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.total_checkins).toBe(5);
		expect(body.top_performer.user_id).toBe(UUID1);
		expect(body.member_stats).toHaveLength(2);
		expect(body.elapsed_cycles).toBeGreaterThanOrEqual(1);
		expect(typeof body.completion_rate).toBe('number');
	});
});

// ============================================
// POST /api/challenges/:id/nudge/:memberId
// ============================================
describe('POST /api/challenges/:id/nudge/:memberId', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should reject nudging yourself', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Active', status: 'active', start_at: THREE_DAYS_AGO, current_step: 3 }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-1', user_id: UUID1, status: 'accepted' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-1', user_id: UUID1, status: 'accepted' }] });

		const { POST } = require('@/app/api/challenges/[id]/nudge/[memberId]/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/nudge/${UUID1}?user_id=${UUID1}`,
			{ method: 'POST' }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID, memberId: UUID1 }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain('Cannot nudge yourself');
	});

	it('should reject if challenge is not active', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: CHALLENGE_ID, title: 'Formation', status: 'formation', start_at: THREE_DAYS_AGO, current_step: 0 }],
		});

		const { POST } = require('@/app/api/challenges/[id]/nudge/[memberId]/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/nudge/${UUID2}?user_id=${UUID1}`,
			{ method: 'POST' }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID, memberId: UUID2 }) });
		expect(res.status).toBe(409);
	});

	it('should reject if sender is not an accepted member', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Active', status: 'active', start_at: THREE_DAYS_AGO, current_step: 3 }] })
			.mockResolvedValueOnce({ rows: [] });

		const { POST } = require('@/app/api/challenges/[id]/nudge/[memberId]/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/nudge/${UUID2}?user_id=${UUID1}`,
			{ method: 'POST' }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID, memberId: UUID2 }) });
		expect(res.status).toBe(403);
	});

	it('should reject if target is not an accepted member', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Active', status: 'active', start_at: THREE_DAYS_AGO, current_step: 3 }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-1', user_id: UUID1, status: 'accepted' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-2', user_id: UUID2, status: 'invited' }] });

		const { POST } = require('@/app/api/challenges/[id]/nudge/[memberId]/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/nudge/${UUID2}?user_id=${UUID1}`,
			{ method: 'POST' }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID, memberId: UUID2 }) });
		expect(res.status).toBe(403);
	});

	it('should reject if target already checked in', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Active', status: 'active', start_at: THREE_DAYS_AGO, current_step: 3 }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-1', user_id: UUID1, status: 'accepted' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-2', user_id: UUID2, status: 'accepted' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'existing-checkin' }] });

		const { POST } = require('@/app/api/challenges/[id]/nudge/[memberId]/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/nudge/${UUID2}?user_id=${UUID1}`,
			{ method: 'POST' }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID, memberId: UUID2 }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain('already checked in');
	});

	it('should reject if already nudged today', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Active', status: 'active', start_at: THREE_DAYS_AGO, current_step: 3 }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-1', user_id: UUID1, status: 'accepted' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-2', user_id: UUID2, status: 'accepted' }] })
			.mockResolvedValueOnce({ rows: [] }) // target not checked in
			.mockResolvedValueOnce({ rows: [{ id: 'existing-nudge' }] }); // already nudged

		const { POST } = require('@/app/api/challenges/[id]/nudge/[memberId]/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/nudge/${UUID2}?user_id=${UUID1}`,
			{ method: 'POST' }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID, memberId: UUID2 }) });
		expect(res.status).toBe(429);
	});

	it('should send nudge successfully', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Active Challenge', status: 'active', start_at: THREE_DAYS_AGO, current_step: 3 }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-1', user_id: UUID1, status: 'accepted' }] })
			.mockResolvedValueOnce({ rows: [{ id: 'member-2', user_id: UUID2, status: 'accepted' }] })
			.mockResolvedValueOnce({ rows: [] }) // target not checked in
			.mockResolvedValueOnce({ rows: [] }) // no recent nudge
			.mockResolvedValueOnce({ rows: [] }); // insert notification

		const { POST } = require('@/app/api/challenges/[id]/nudge/[memberId]/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/nudge/${UUID2}?user_id=${UUID1}`,
			{ method: 'POST' }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID, memberId: UUID2 }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.message).toContain('Nudge sent');
		expect(body.target_user_id).toBe(UUID2);
		const insertCall = mockQuery.mock.calls.find(
			(call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO notifications')
		);
		expect(insertCall).toBeDefined();
		const insertParams = (insertCall as [string, unknown[]])[1];
		expect(JSON.parse(insertParams[1] as string)).toMatchObject({
			challengeId: CHALLENGE_ID,
			challengeTitle: 'Active Challenge',
			senderId: UUID1,
			targetMemberId: 'member-2',
			action: 'slap_reminder',
		});
	});
});
