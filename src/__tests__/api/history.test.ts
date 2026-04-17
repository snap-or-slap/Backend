/**
 * Sprint 9 — History, Recreate & Milestone Tests
 *
 * Endpoints:
 *   GET  /api/challenges/:id/history      — Challenge history detail
 *   POST /api/challenges/:id/recreate     — Recreate challenge from old one
 *   GET  /api/users/me/challenges/history  — List finished challenges
 *   POST /api/challenges/:id/milestone-check — Check & trigger streak milestones
 */

/* eslint-disable @typescript-eslint/no-require-imports */
let mockQuery: jest.Mock;

beforeAll(() => {
	process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
	process.env.JWT_ACCESS_SECRET = 'test-access-secret';
	process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
	process.env.CRON_SECRET = 'test-cron-secret';
	process.env.APP_BASE_URL = 'http://localhost:3000';
	process.env.NODE_ENV = 'test';
});

beforeEach(() => {
	jest.resetModules();
	mockQuery = jest.fn();
	jest.mock('@/lib/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
});

// ============================================================
// GET /api/challenges/:id/history — Challenge history detail
// ============================================================
describe('GET /api/challenges/:id/history', () => {
	const CHALLENGE_ID = 'fcdd1c90-f8d1-4055-b32f-739d3e5f75fb';
	const ALICE = '9065e038-3ebf-411f-af59-d64e12259533';
	const BOB = 'e30d4258-a336-4dcb-9534-7c753e765db7';

	function buildRequest(query = '') {
		return new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/history${query}`);
	}

	async function callGET(query = '') {
		const { GET } = require('@/app/api/challenges/[id]/history/route');
		return GET(buildRequest(query), { params: Promise.resolve({ id: CHALLENGE_ID }) });
	}

	it('should return 400 if user_id is missing', async () => {
		const res = await callGET();
		expect(res.status).toBe(400);
	});

	it('should return 404 if challenge not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // challenge lookup
		const res = await callGET('?user_id=' + ALICE);
		expect(res.status).toBe(404);
	});

	it('should return 409 if challenge is still active', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: CHALLENGE_ID, status: 'active', title: 'Test', end_reason: null }],
		});
		const res = await callGET('?user_id=' + ALICE);
		expect(res.status).toBe(409);
		const data = await res.json();
		expect(data.error).toMatch(/not yet finished/i);
	});

	it('should return 409 if challenge is in formation', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: CHALLENGE_ID, status: 'formation', title: 'Test', end_reason: null }],
		});
		const res = await callGET('?user_id=' + ALICE);
		expect(res.status).toBe(409);
	});

	it('should return history detail for completed challenge with final_stats', async () => {
		const finalStats = {
			totalCheckins: 14,
			avgCompletion: 0.85,
		};
		// challenge lookup
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: '7-Day No Sugar', status: 'completed',
				end_reason: 'completed', start_at: '2026-04-01T00:00:00Z',
				ended_at: '2026-04-08T00:00:00Z', duration_days: 7,
				total_hearts: 3, hearts_left: 1, current_step: 7,
				final_stats: finalStats, parent_challenge_id: null,
				creator_id: BOB,
			}],
		});
		// member check: user is member
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: ALICE, status: 'accepted' }] });
		// members with stats
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ user_id: ALICE, username: 'alice', avatar_url: null, checkin_count: 7, display_name: 'Alice' },
				{ user_id: BOB, username: 'bob', avatar_url: null, checkin_count: 6, display_name: 'Bob' },
			],
		});
		// gallery preview (6 most recent)
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ evidence_url: '/img/1.jpg', user_id: ALICE, cycle_number: 7 },
				{ evidence_url: '/img/2.jpg', user_id: BOB, cycle_number: 6 },
			],
		});
		// has child challenge
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callGET('?user_id=' + ALICE);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.challenge.title).toBe('7-Day No Sugar');
		expect(data.result_banner).toBe('CONGRATULATIONS');
		expect(data.final_stats).toEqual(finalStats);
		expect(data.previous_squadmates).toHaveLength(2);
		expect(data.gallery_preview).toHaveLength(2);
		expect(data.recreate_eligible).toBe(true);
	});

	it('should return VALIANT_EFFORT banner for failed challenge', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Failed', status: 'failed',
				end_reason: 'out_of_hearts', start_at: '2026-04-01T00:00:00Z',
				ended_at: '2026-04-05T00:00:00Z', duration_days: 7,
				total_hearts: 3, hearts_left: 0, current_step: 5,
				final_stats: null, parent_challenge_id: null,
				creator_id: BOB,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: ALICE, status: 'accepted' }] });
		mockQuery.mockResolvedValueOnce({ rows: [] }); // members
		mockQuery.mockResolvedValueOnce({ rows: [] }); // gallery
		mockQuery.mockResolvedValueOnce({ rows: [] }); // child

		const res = await callGET('?user_id=' + ALICE);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.result_banner).toBe('VALIANT_EFFORT');
	});

	it('should return CANCELLED banner for cancelled challenge', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Cancelled', status: 'cancelled',
				end_reason: 'host_cancelled', start_at: '2026-04-01T00:00:00Z',
				ended_at: '2026-04-03T00:00:00Z', duration_days: 7,
				total_hearts: 3, hearts_left: 2, current_step: 3,
				final_stats: null, parent_challenge_id: null,
				creator_id: BOB,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: ALICE, status: 'accepted' }] });
		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callGET('?user_id=' + ALICE);
		const data = await res.json();
		expect(data.result_banner).toBe('CANCELLED');
	});

	it('should set recreate_eligible false if challenge ended > 90 days ago', async () => {
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - 91);

		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Old', status: 'completed',
				end_reason: 'completed', start_at: '2026-01-01T00:00:00Z',
				ended_at: oldDate.toISOString(), duration_days: 7,
				total_hearts: 3, hearts_left: 1, current_step: 7,
				final_stats: null, parent_challenge_id: null,
				creator_id: BOB,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: ALICE, status: 'accepted' }] });
		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callGET('?user_id=' + ALICE);
		const data = await res.json();
		expect(data.recreate_eligible).toBe(false);
	});
});

// ============================================================
// POST /api/challenges/:id/recreate — Recreate challenge
// ============================================================
describe('POST /api/challenges/:id/recreate', () => {
	const OLD_ID = 'fcdd1c90-f8d1-4055-b32f-739d3e5f75fb';
	const ALICE = '9065e038-3ebf-411f-af59-d64e12259533';
	const BOB = 'e30d4258-a336-4dcb-9534-7c753e765db7';
	const NEW_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

	function buildRequest(body: unknown) {
		return new Request(`http://localhost:3000/api/challenges/${OLD_ID}/recreate?user_id=${ALICE}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	}

	async function callPOST(body: unknown, query = `?user_id=${ALICE}`) {
		const { POST } = require('@/app/api/challenges/[id]/recreate/route');
		return POST(
			new Request(`http://localhost:3000/api/challenges/${OLD_ID}/recreate${query}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			}),
			{ params: Promise.resolve({ id: OLD_ID }) },
		);
	}

	it('should return 400 if user_id missing', async () => {
		const { POST } = require('@/app/api/challenges/[id]/recreate/route');
		const res = await POST(
			new Request(`http://localhost:3000/api/challenges/${OLD_ID}/recreate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}',
			}),
			{ params: Promise.resolve({ id: OLD_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it('should return 404 if old challenge not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // challenge lookup
		const res = await callPOST({});
		expect(res.status).toBe(404);
	});

	it('should return 409 if old challenge is still active', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: OLD_ID, status: 'active', title: 'Test', duration_days: 7,
				frequency: 'daily', frequency_days: null, reset_time: '00:00:00',
				total_hearts: 3, max_members: 10, is_private: false,
				description: null, cover_url: null,
			}],
		});
		const res = await callPOST({});
		expect(res.status).toBe(409);
	});

	it('should return 403 if user is not a member of old challenge', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: OLD_ID, status: 'completed', title: 'Test', duration_days: 7,
				frequency: 'daily', frequency_days: null, reset_time: '00:00:00',
				total_hearts: 3, max_members: 10, is_private: false,
				description: null, cover_url: null,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rows: [] }); // member check
		const res = await callPOST({});
		expect(res.status).toBe(403);
	});

	it('should create new challenge inheriting old settings', async () => {
		// old challenge lookup
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: OLD_ID, status: 'completed', title: 'Original Title', duration_days: 14,
				frequency: 'daily', frequency_days: null, reset_time: '06:00:00',
				total_hearts: 3, max_members: 10, is_private: false,
				description: 'Original desc', cover_url: '/cover.jpg',
			}],
		});
		// member check
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: ALICE, status: 'accepted' }] });
		// insert new challenge
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: NEW_ID, title: 'Original Title', status: 'formation',
				parent_challenge_id: OLD_ID, duration_days: 14,
			}],
		});
		// add host member
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callPOST({});
		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.challenge.id).toBe(NEW_ID);
		expect(data.challenge.parent_challenge_id).toBe(OLD_ID);
	});

	it('should allow overriding title and duration', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: OLD_ID, status: 'completed', title: 'Old Title', duration_days: 7,
				frequency: 'daily', frequency_days: null, reset_time: '00:00:00',
				total_hearts: 3, max_members: 10, is_private: false,
				description: null, cover_url: null,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: ALICE, status: 'accepted' }] });
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: NEW_ID, title: 'New Title', duration_days: 21, parent_challenge_id: OLD_ID, status: 'formation' }],
		});
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callPOST({ title: 'New Title', duration_days: 21 });
		expect(res.status).toBe(201);
		// Verify the INSERT query used the overridden values
		const insertCall = mockQuery.mock.calls[2];
		expect(insertCall[1]).toContain('New Title');
		expect(insertCall[1]).toContain(21);
	});

	it('should reinvite specified users and create notifications', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: OLD_ID, status: 'completed', title: 'Test', duration_days: 7,
				frequency: 'daily', frequency_days: null, reset_time: '00:00:00',
				total_hearts: 3, max_members: 10, is_private: false,
				description: null, cover_url: null,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: ALICE, status: 'accepted' }] });
		// friends check
		mockQuery.mockResolvedValueOnce({
			rows: [{ friend_id: BOB }],
		});
		// insert challenge
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: NEW_ID, title: 'Test', parent_challenge_id: OLD_ID, status: 'formation' }],
		});
		// add host
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// add invited members
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// create notifications
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callPOST({ reinvite_user_ids: [BOB] });
		expect(res.status).toBe(201);
		// Verify notification query was called
		expect(mockQuery).toHaveBeenCalledTimes(7);
	});

	it('should return 400 if reinvite user is not a friend', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: OLD_ID, status: 'completed', title: 'Test', duration_days: 7,
				frequency: 'daily', frequency_days: null, reset_time: '00:00:00',
				total_hearts: 3, max_members: 10, is_private: false,
				description: null, cover_url: null,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: ALICE, status: 'accepted' }] });
		// friends check returns empty
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callPOST({ reinvite_user_ids: [BOB] });
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toMatch(/only invite friends/i);
	});
});

// ============================================================
// GET /api/users/me/challenges/history — List finished challenges
// ============================================================
describe('GET /api/users/me/challenges/history', () => {
	const ALICE = '9065e038-3ebf-411f-af59-d64e12259533';

	function buildRequest(query = '') {
		return new Request(`http://localhost:3000/api/users/me/challenges/history${query}`);
	}

	async function callGET(query = '') {
		const { GET } = require('@/app/api/users/me/challenges/history/route');
		return GET(buildRequest(query));
	}

	it('should return 400 if user_id missing', async () => {
		const res = await callGET();
		expect(res.status).toBe(400);
	});

	it('should return finished challenges with lifetime stats', async () => {
		// user_stats
		mockQuery.mockResolvedValueOnce({
			rows: [{
				challenges_joined: 8, challenges_completed: 5,
				best_streak: 24, total_checkins: 50,
			}],
		});
		// count finished challenges
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }] });
		// finished challenges list
		mockQuery.mockResolvedValueOnce({
			rows: [
				{
					id: 'ch1', title: 'Challenge 1', status: 'completed', end_reason: 'completed',
					start_at: '2026-04-01T00:00:00Z', ended_at: '2026-04-08T00:00:00Z',
					current_step: 7, duration_days: 7, hearts_left: 2,
					member_count: 3, creator_username: 'alice',
				},
				{
					id: 'ch2', title: 'Challenge 2', status: 'failed', end_reason: 'out_of_hearts',
					start_at: '2026-03-01T00:00:00Z', ended_at: '2026-03-04T00:00:00Z',
					current_step: 4, duration_days: 7, hearts_left: 0,
					member_count: 2, creator_username: 'bob',
				},
			],
		});
		// has_child_challenge checks
		mockQuery.mockResolvedValueOnce({ rows: [{ parent_challenge_id: 'ch1' }] });

		const res = await callGET('?user_id=' + ALICE);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.lifetime_stats.total_challenges).toBe(8);
		expect(data.lifetime_stats.total_completed).toBe(5);
		expect(data.lifetime_stats.best_streak).toBe(24);
		expect(data.challenges).toHaveLength(2);
		expect(data.total).toBe(2);
	});

	it('should filter by result=success', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ challenges_joined: 3, challenges_completed: 2, best_streak: 10, total_checkins: 20 }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 1 }] });
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: 'ch1', title: 'Completed', status: 'completed', end_reason: 'completed',
				start_at: '2026-04-01T00:00:00Z', ended_at: '2026-04-08T00:00:00Z',
				current_step: 7, duration_days: 7, hearts_left: 2,
				member_count: 3, creator_username: 'alice',
			}],
		});
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callGET(`?user_id=${ALICE}&result=success`);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.challenges).toHaveLength(1);
		expect(data.challenges[0].status).toBe('completed');
	});

	it('should return empty list if no finished challenges', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ challenges_joined: 1, challenges_completed: 0, best_streak: 0, total_checkins: 5 }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] });
		mockQuery.mockResolvedValueOnce({ rows: [] });
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callGET('?user_id=' + ALICE);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.challenges).toHaveLength(0);
		expect(data.total).toBe(0);
	});

	it('should paginate results', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ challenges_joined: 10, challenges_completed: 8, best_streak: 30, total_checkins: 100 }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] });
		mockQuery.mockResolvedValueOnce({
			rows: [
				{
					id: 'ch3', title: 'Page 2', status: 'completed', end_reason: 'completed',
					start_at: '2026-02-01T00:00:00Z', ended_at: '2026-02-08T00:00:00Z',
					current_step: 7, duration_days: 7, hearts_left: 1,
					member_count: 2, creator_username: 'charlie',
				},
			],
		});
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callGET(`?user_id=${ALICE}&page=2&limit=2`);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.page).toBe(2);
		expect(data.limit).toBe(2);
		expect(data.total).toBe(5);
	});
});

// ============================================================
// POST /api/challenges/:id/milestone-check — Streak milestone
// ============================================================
describe('POST /api/challenges/:id/milestone-check', () => {
	const CHALLENGE_ID = 'f79aacef-8b1e-469d-b99c-afcba004f02a';
	const ALICE = '9065e038-3ebf-411f-af59-d64e12259533';

	async function callPOST(query = `?user_id=${ALICE}`) {
		const { POST } = require('@/app/api/challenges/[id]/milestone-check/route');
		return POST(
			new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}/milestone-check${query}`, { method: 'POST' }),
			{ params: Promise.resolve({ id: CHALLENGE_ID }) },
		);
	}

	it('should return 400 if user_id missing', async () => {
		const res = await callPOST('');
		expect(res.status).toBe(400);
	});

	it('should trigger milestone at streak 7', async () => {
		// get user stats
		mockQuery.mockResolvedValueOnce({ rows: [{ current_streak: 7, best_streak: 7 }] });
		// check existing milestone notification (none)
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// create notification
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// create activity
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const res = await callPOST();
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.milestone_triggered).toBe(true);
		expect(data.milestone_days).toBe(7);
	});

	it('should not trigger milestone at non-milestone streak (8)', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ current_streak: 8, best_streak: 8 }] });

		const res = await callPOST();
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.milestone_triggered).toBe(false);
	});

	it('should not trigger milestone that was already triggered', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ current_streak: 14, best_streak: 14 }] });
		// existing milestone notification found
		mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });

		const res = await callPOST();
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.milestone_triggered).toBe(false);
		expect(data.reason).toMatch(/already triggered/i);
	});

	it('should return streak info even if no stats', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] }); // no user_stats

		const res = await callPOST();
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.current_streak).toBe(0);
		expect(data.milestone_triggered).toBe(false);
	});
});
