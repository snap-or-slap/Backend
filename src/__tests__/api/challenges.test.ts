import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const UUID1 = '00000000-0000-4000-a000-000000000001';
const UUID2 = '00000000-0000-4000-a000-000000000002';
const CHALLENGE_ID = '00000000-0000-4000-a000-000000000c01';

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

// ===========================================
// GET /api/challenges — List challenges
// ===========================================
describe('GET /api/challenges', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { GET } = require('@/app/api/challenges/route');
		const req = new Request('http://localhost:3000/api/challenges');
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return paginated challenges list', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [] }) // opportunistic formation transition
			.mockResolvedValueOnce({
				rows: [
					{
						id: CHALLENGE_ID,
						title: 'Wake Up Early',
						status: 'active',
						member_count: 3,
						my_role: 'host',
						creator_username: 'alice',
					},
				],
			})
			.mockResolvedValueOnce({ rows: [{ count: 1 }] });

		const { GET } = require('@/app/api/challenges/route');
		const req = new Request(`http://localhost:3000/api/challenges?user_id=${UUID1}`);
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.challenges).toHaveLength(1);
		expect(body.total).toBe(1);
		expect(body.page).toBe(1);
	});

	it('should support status filter', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [] }) // opportunistic formation transition
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ count: 0 }] });

		const { GET } = require('@/app/api/challenges/route');
		const req = new Request(`http://localhost:3000/api/challenges?user_id=${UUID1}&status=active`);
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.challenges).toEqual([]);
	});
});

// ===========================================
// POST /api/challenges — Create challenge
// ===========================================
describe('POST /api/challenges', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { POST } = require('@/app/api/challenges/route');
		const req = new Request('http://localhost:3000/api/challenges', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'Test' }),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 404 when user not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { POST } = require('@/app/api/challenges/route');
		const req = new Request(`http://localhost:3000/api/challenges?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'Test', durationDays: 30, frequency: 'daily' }),
		});
		const res = await POST(req);
		expect(res.status).toBe(404);
	});

	it('should return 400 for invalid body', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: UUID1 }] });
		const { POST } = require('@/app/api/challenges/route');
		const req = new Request(`http://localhost:3000/api/challenges?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: '' }),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should create challenge and add host member', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: UUID1 }] }) // user exists
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, title: 'Wake Up Early', status: 'formation' }] }) // insert challenge
			.mockResolvedValueOnce({ rows: [] }); // insert host member

		const { POST } = require('@/app/api/challenges/route');
		const req = new Request(`http://localhost:3000/api/challenges?user_id=${UUID1}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: 'Wake Up Early',
				description: '30 days of waking up at 6AM',
				durationDays: 30,
				frequency: 'daily',
				totalHearts: 3,
				maxMembers: 10,
			}),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(201);
		expect(body.challenge.id).toBe(CHALLENGE_ID);
	});
});

// ===========================================
// GET /api/challenges/[id] — Get single
// ===========================================
describe('GET /api/challenges/[id]', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 404 when challenge not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { GET } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(404);
	});

	it('should return challenge with members', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [] }) // opportunistic formation transition
			.mockResolvedValueOnce({
				rows: [{
					id: CHALLENGE_ID, title: 'Wake Up Early', status: 'active',
					creator_username: 'alice', member_count: 2,
				}],
			})
			.mockResolvedValueOnce({
				rows: [
					{ user_id: UUID1, role: 'host', status: 'accepted', username: 'alice' },
					{ user_id: UUID2, role: 'member', status: 'accepted', username: 'bob_the_builder' },
				],
			});

		const { GET } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}?user_id=${UUID1}`);
		const res = await GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.challenge.id).toBe(CHALLENGE_ID);
		expect(body.members).toHaveLength(2);
		expect(body.my_membership).not.toBeNull();
		expect(body.my_membership.role).toBe('host');
	});
});

// ===========================================
// PATCH /api/challenges/[id] — Update
// ===========================================
describe('PATCH /api/challenges/[id]', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { PATCH } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'New Title' }),
		});
		const res = await PATCH(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});

	it('should return 404 when challenge not found or not host', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { PATCH } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}?user_id=${UUID1}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'New Title' }),
		});
		const res = await PATCH(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(404);
	});

	it('should return 400 when challenge not in formation', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, status: 'active' }] });
		const { PATCH } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}?user_id=${UUID1}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'New Title' }),
		});
		const res = await PATCH(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});

	it('should update challenge fields', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, status: 'formation' }] })
			.mockResolvedValueOnce({
				rows: [{ id: CHALLENGE_ID, title: 'Updated Title', status: 'formation' }],
			});

		const { PATCH } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}?user_id=${UUID1}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'Updated Title', maxMembers: 5 }),
		});
		const res = await PATCH(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.challenge.title).toBe('Updated Title');
	});
});

// ===========================================
// DELETE /api/challenges/[id] — Delete/Cancel
// ===========================================
describe('DELETE /api/challenges/[id]', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when user_id missing', async () => {
		const { DELETE } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}`, {
			method: 'DELETE',
		});
		const res = await DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});

	it('should return 404 when not host', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { DELETE } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}?user_id=${UUID2}`, {
			method: 'DELETE',
		});
		const res = await DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(404);
	});

	it('should delete formation challenge', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, status: 'formation' }] })
			.mockResolvedValueOnce({ rows: [] });

		const { DELETE } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}?user_id=${UUID1}`, {
			method: 'DELETE',
		});
		const res = await DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.message).toContain('deleted');
	});

	it('should cancel active challenge', async () => {
		mockQuery
			.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, status: 'active' }] })
			.mockResolvedValueOnce({ rows: [] });

		const { DELETE } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}?user_id=${UUID1}`, {
			method: 'DELETE',
		});
		const res = await DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.message).toContain('cancelled');
	});

	it('should return 400 when deleting completed challenge', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: CHALLENGE_ID, status: 'completed' }] });
		const { DELETE } = require('@/app/api/challenges/[id]/route');
		const req = new Request(`http://localhost:3000/api/challenges/${CHALLENGE_ID}?user_id=${UUID1}`, {
			method: 'DELETE',
		});
		const res = await DELETE(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
		expect(res.status).toBe(400);
	});
});
