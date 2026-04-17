import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const UUID1 = '00000000-0000-4000-a000-000000000001';
const UUID2 = '00000000-0000-4000-a000-000000000002';
const UUID3 = '00000000-0000-4000-a000-000000000003';
const UUID4 = '00000000-0000-4000-a000-000000000004';
const CHALLENGE_ID = '00000000-0000-4000-a000-000000000c01';
const CHALLENGE_ID2 = '00000000-0000-4000-a000-000000000c02';
const FIVE_MIN_AGO = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const FIVE_MIN_AHEAD = new Date(Date.now() + 5 * 60 * 1000).toISOString();
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
// CRON INFRASTRUCTURE — /api/crons/[jobName]
// ============================================
describe('POST /api/crons/[jobName]', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should reject without CRON_SECRET header → 401', async () => {
		const { POST } = require('@/app/api/crons/[jobName]/route');
		const req = new Request('http://localhost/api/crons/formation-transition', {
			method: 'POST',
		});
		const res = await POST(req, { params: Promise.resolve({ jobName: 'formation-transition' }) });
		expect(res.status).toBe(401);
	});

	it('should reject with wrong CRON_SECRET → 401', async () => {
		const { POST } = require('@/app/api/crons/[jobName]/route');
		const req = new Request('http://localhost/api/crons/formation-transition', {
			method: 'POST',
			headers: { Authorization: 'Bearer wrong-secret' },
		});
		const res = await POST(req, { params: Promise.resolve({ jobName: 'formation-transition' }) });
		expect(res.status).toBe(401);
	});

	it('should return 404 for unknown job name', async () => {
		const { POST } = require('@/app/api/crons/[jobName]/route');
		const req = new Request('http://localhost/api/crons/unknown-job', {
			method: 'POST',
			headers: { Authorization: 'Bearer test-cron-secret' },
		});
		const res = await POST(req, { params: Promise.resolve({ jobName: 'unknown-job' }) });
		expect(res.status).toBe(404);
	});

	it('should execute formation-transition job with correct secret → 200', async () => {
		// Mock: no formation challenges to process
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { POST } = require('@/app/api/crons/[jobName]/route');
		const req = new Request('http://localhost/api/crons/formation-transition', {
			method: 'POST',
			headers: { Authorization: 'Bearer test-cron-secret' },
		});
		const res = await POST(req, { params: Promise.resolve({ jobName: 'formation-transition' }) });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.job).toBe('formation-transition');
		expect(data.result).toBeDefined();
	});

	it('should execute heart-deduction job with correct secret → 200', async () => {
		// Mock: no active challenges to process
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { POST } = require('@/app/api/crons/[jobName]/route');
		const req = new Request('http://localhost/api/crons/heart-deduction', {
			method: 'POST',
			headers: { Authorization: 'Bearer test-cron-secret' },
		});
		const res = await POST(req, { params: Promise.resolve({ jobName: 'heart-deduction' }) });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.job).toBe('heart-deduction');
	});
});

// GET /api/crons/[jobName] — browser-testable status
describe('GET /api/crons/[jobName]', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return job info without running it', async () => {
		const { GET } = require('@/app/api/crons/[jobName]/route');
		const req = new Request('http://localhost/api/crons/formation-transition');
		const res = await GET(req, { params: Promise.resolve({ jobName: 'formation-transition' }) });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.job).toBe('formation-transition');
		expect(data.description).toBeDefined();
	});
});

// ============================================
// FORMATION → ACTIVE TRANSITION
// ============================================
describe('processFormationTransitions', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should activate challenge with start_at 5min ago and 3 accepted members', async () => {
		// Query 1: find formation challenges past start_at
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Test Challenge', start_at: FIVE_MIN_AGO,
				creator_id: UUID1, accepted_count: 3,
			}],
		});
		// Query 2: UPDATE status = active
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		// Query 3: get accepted members for notifications
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }, { user_id: UUID2 }, { user_id: UUID3 }] });
		// Queries 4-6: insert notifications (3 members)
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		// Queries 7-9: insert activities (3 members)
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });

		const { processFormationTransitions } = require('@/lib/services/cronService');
		const result = await processFormationTransitions();
		expect(result.activated).toContain(CHALLENGE_ID);
		expect(result.cancelled).toHaveLength(0);
		// Verify UPDATE was called with 'active'
		expect(mockQuery).toHaveBeenCalledWith(
			expect.stringContaining("status = 'active'"),
			[CHALLENGE_ID]
		);
	});

	it('should cancel challenge with start_at 5min ago and only 1 member', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Lonely Challenge', start_at: FIVE_MIN_AGO,
				creator_id: UUID1, accepted_count: 1,
			}],
		});
		// UPDATE cancel
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		// get all members
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }] });
		// notify
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });

		const { processFormationTransitions } = require('@/lib/services/cronService');
		const result = await processFormationTransitions();
		expect(result.activated).toHaveLength(0);
		expect(result.cancelled).toContain(CHALLENGE_ID);
	});

	it('should skip challenges with start_at in the future', async () => {
		// No challenges returned (query has start_at <= NOW() - 5min)
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { processFormationTransitions } = require('@/lib/services/cronService');
		const result = await processFormationTransitions();
		expect(result.activated).toHaveLength(0);
		expect(result.cancelled).toHaveLength(0);
	});

	it('should be idempotent — already active challenges not reprocessed', async () => {
		// Query returns empty because WHERE status = 'formation' excludes already-active
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { processFormationTransitions } = require('@/lib/services/cronService');
		const result = await processFormationTransitions();
		expect(result.activated).toHaveLength(0);
		expect(mockQuery).toHaveBeenCalledTimes(1); // Only the SELECT
	});
});

// ============================================
// HEART DEDUCTION
// ============================================
describe('processHeartDeductions', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should deduct 1 heart when some members missed check-in', async () => {
		// Query 1: find active challenges
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Test', start_at: THREE_DAYS_AGO,
				reset_time: '06:00:00', hearts_left: 3, total_hearts: 3,
				duration_days: 30, current_step: 2, last_processed_cycle: 2,
			}],
		});
		// getCurrentCycle(3 days ago) = 4, cycleToProcess = 3, last_processed = 2 → process
		// Query 2: optimistic lock update
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		// Query 3: get accepted members
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }, { user_id: UUID2 }, { user_id: UUID3 }, { user_id: UUID4 }] });
		// Query 4: get checkins for cycle 3
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }, { user_id: UUID2 }, { user_id: UUID3 }] });
		// → UUID4 missed, 1 miss → hearts_left = 2
		// Query 5: update challenge
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		// Queries 6-9: notifications for 4 members
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });

		const { processHeartDeductions } = require('@/lib/services/cronService');
		const result = await processHeartDeductions();
		expect(result.processed).toHaveLength(1);
		expect(result.processed[0].missed_count).toBe(1);
		expect(result.processed[0].hearts_left).toBe(2);
		expect(result.processed[0].new_status).toBe('active');
	});

	it('should deduct 1 heart even when all members missed', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Test', start_at: THREE_DAYS_AGO,
				reset_time: '06:00:00', hearts_left: 3, total_hearts: 3,
				duration_days: 30, current_step: 2, last_processed_cycle: 2,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // lock
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }, { user_id: UUID2 }] }); // members
		mockQuery.mockResolvedValueOnce({ rows: [] }); // no checkins
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // update
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // notify member 1
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // notify member 2

		const { processHeartDeductions } = require('@/lib/services/cronService');
		const result = await processHeartDeductions();
		expect(result.processed[0].missed_count).toBe(2);
		expect(result.processed[0].hearts_left).toBe(2); // 3-1=2
	});

	it('should fail challenge when hearts_left reaches 0', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Last Heart', start_at: THREE_DAYS_AGO,
				reset_time: '06:00:00', hearts_left: 1, total_hearts: 3,
				duration_days: 30, current_step: 2, last_processed_cycle: 2,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // lock
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }, { user_id: UUID2 }] }); // members
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }] }); // only UUID1 checked in
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // update challenge
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // notify 1
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // notify 2
		// Snapshot calls (createCompletionSnapshot)
		mockQuery.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Last Heart', duration_days: 30, hearts_left: 0, total_hearts: 3 }] }); // get challenge
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1, username: 'alice', display_name: 'Alice' }, { user_id: UUID2, username: 'bob', display_name: 'Bob' }] }); // members
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1, checkin_count: 3 }, { user_id: UUID2, checkin_count: 1 }] }); // checkin counts
		mockQuery.mockResolvedValueOnce({ rows: [] }); // danger zones
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // save snapshot
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // activity 1
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // activity 2

		const { processHeartDeductions } = require('@/lib/services/cronService');
		const result = await processHeartDeductions();
		expect(result.processed[0].hearts_left).toBe(0);
		expect(result.processed[0].new_status).toBe('failed');
	});

	it('should complete challenge when current_step reaches duration_days and no miss', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Almost Done', start_at: THREE_DAYS_AGO,
				reset_time: '06:00:00', hearts_left: 2, total_hearts: 3,
				duration_days: 3, current_step: 2, last_processed_cycle: 2,
			}],
		});
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // lock
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }, { user_id: UUID2 }] }); // members
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }, { user_id: UUID2 }] }); // all checked in
		// No miss → no heart deduction, current_step 2+1=3 >= duration_days 3 → completed
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // update challenge
		// Snapshot calls
		mockQuery.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Almost Done', duration_days: 3, hearts_left: 2, total_hearts: 3 }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1, username: 'alice', display_name: 'Alice' }, { user_id: UUID2, username: 'bob', display_name: 'Bob' }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1, checkin_count: 3 }, { user_id: UUID2, checkin_count: 3 }] });
		mockQuery.mockResolvedValueOnce({ rows: [] }); // danger zones
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // save snapshot
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // activity 1
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // activity 2

		const { processHeartDeductions } = require('@/lib/services/cronService');
		const result = await processHeartDeductions();
		expect(result.processed[0].new_status).toBe('completed');
		expect(result.processed[0].hearts_left).toBe(2); // no deduction
	});

	it('should not process same cycle twice (idempotent via last_processed_cycle)', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, title: 'Test', start_at: THREE_DAYS_AGO,
				reset_time: '06:00:00', hearts_left: 3, total_hearts: 3,
				duration_days: 30, current_step: 3, last_processed_cycle: 3,
				// currentCycle(3 days ago)=4, cycleToProcess=3, last_processed=3 → skip
			}],
		});

		const { processHeartDeductions } = require('@/lib/services/cronService');
		const result = await processHeartDeductions();
		expect(result.processed).toHaveLength(0);
		expect(result.skipped).toBe(1);
	});

	it('should skip already failed/completed challenges', async () => {
		// Query returns empty because WHERE status = 'active' excludes them
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { processHeartDeductions } = require('@/lib/services/cronService');
		const result = await processHeartDeductions();
		expect(result.processed).toHaveLength(0);
	});
});

// ============================================
// COMPLETION SNAPSHOT
// ============================================
describe('createCompletionSnapshot', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should create correct final_stats with per-member completion rates', async () => {
		// Query 1: get challenge
		mockQuery.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Done!', duration_days: 7, hearts_left: 1, total_hearts: 3 }] });
		// Query 2: get members
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ user_id: UUID1, username: 'alice', display_name: 'Alice' },
				{ user_id: UUID2, username: 'bob', display_name: 'Bob' },
			],
		});
		// Query 3: checkin counts
		mockQuery.mockResolvedValueOnce({
			rows: [
				{ user_id: UUID1, checkin_count: 7 },
				{ user_id: UUID2, checkin_count: 5 },
			],
		});
		// Query 4: danger zones
		mockQuery.mockResolvedValueOnce({ rows: [{ n: 3 }, { n: 6 }] });
		// Query 5: save final_stats
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		// Queries 6-7: activities
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });

		const { createCompletionSnapshot } = require('@/lib/services/cronService');
		const stats = await createCompletionSnapshot(CHALLENGE_ID, 'completed', 7);

		expect(stats.total_checkins).toBe(12);
		expect(stats.member_stats).toHaveLength(2);
		expect(stats.member_stats[0].completion_rate).toBe(100); // 7/7
		expect(stats.member_stats[1].completion_rate).toBe(71.4); // 5/7
		expect(stats.top_performer_id).toBe(UUID1);
		expect(stats.danger_zones).toEqual([3, 6]);
		expect(stats.hearts_remaining).toBe(1);
		expect(stats.actual_steps_completed).toBe(7);

		// Verify final_stats was saved to DB
		const saveCall = mockQuery.mock.calls.find(
			(call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('final_stats')
		);
		expect(saveCall).toBeDefined();
	});
});

// ============================================
// POST /api/challenges/:id/cancel
// ============================================
describe('POST /api/challenges/:id/cancel', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should reject non-host → 403', async () => {
		// Query: check host — returns empty
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { POST } = require('@/app/api/challenges/[id]/cancel/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/cancel?user_id=${UUID2}`,
			{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(403);
	});

	it('should reject if challenge not active → 409', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: CHALLENGE_ID, status: 'formation', creator_id: UUID1, title: 'Test' }],
		});

		const { POST } = require('@/app/api/challenges/[id]/cancel/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/cancel?user_id=${UUID1}`,
			{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(409);
	});

	it('should cancel active challenge → status cancelled, end_reason host_cancelled', async () => {
		// Query 1: verify host
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, status: 'active', creator_id: UUID1, title: 'Cancel Me',
				start_at: THREE_DAYS_AGO, duration_days: 30, current_step: 3,
				hearts_left: 2, total_hearts: 3,
			}],
		});
		// Query 2: UPDATE cancel
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		// Snapshot queries
		mockQuery.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Cancel Me', duration_days: 30, hearts_left: 2, total_hearts: 3 }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1, username: 'alice', display_name: 'Alice' }, { user_id: UUID2, username: 'bob', display_name: 'Bob' }] });
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1, checkin_count: 3 }, { user_id: UUID2, checkin_count: 2 }] });
		mockQuery.mockResolvedValueOnce({ rows: [] }); // danger zones
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // save snapshot
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // activity 1
		mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // activity 2
		// Get accepted members for notification
		mockQuery.mockResolvedValueOnce({ rows: [{ user_id: UUID1 }, { user_id: UUID2 }] });
		// Notifications
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });

		const { POST } = require('@/app/api/challenges/[id]/cancel/route');
		const req = new Request(
			`http://localhost/api/challenges/${CHALLENGE_ID}/cancel?user_id=${UUID1}`,
			{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'personal reasons' }) }
		);
		const res = await POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.status).toBe('cancelled');
		expect(data.end_reason).toBe('host_cancelled');
	});
});

// ============================================
// GET /api/challenges/:id/cancel (browser-testable)
// ============================================
describe('GET /api/challenges/:id/cancel', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return challenge cancel status info', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: CHALLENGE_ID, status: 'cancelled', end_reason: 'host_cancelled',
				title: 'Cancelled One', final_stats: { total_checkins: 5 },
			}],
		});

		const { GET } = require('@/app/api/challenges/[id]/cancel/route');
		const req = new Request(`http://localhost/api/challenges/${CHALLENGE_ID}/cancel`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.challenge_id).toBe(CHALLENGE_ID);
		expect(data.status).toBe('cancelled');
	});
});
