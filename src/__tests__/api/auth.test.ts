import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

beforeAll(() => {
	process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
	process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-jwt-needs-to-be-32-chars';
	process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
	process.env.CRON_SECRET = 'test-cron-secret';
	process.env.APP_BASE_URL = 'http://localhost:3000';
	process.env.NODE_ENV = 'test';
});

// Mock bcrypt
jest.mock('bcrypt', () => ({
	hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
	compare: jest.fn().mockImplementation((plain: string, hash: string) => {
		// Simulate: correct password = 'Password123!'
		return Promise.resolve(plain === 'Password123!');
	}),
}));

// Mock crypto
jest.mock('crypto', () => {
	const actual = jest.requireActual('crypto') as typeof import('crypto');
	return {
		...actual,
		randomBytes: jest.fn().mockReturnValue(Buffer.from('mock-refresh-token-bytes-here-1234567890')),
		createHash: jest.fn().mockReturnValue({
			update: jest.fn().mockReturnThis(),
			digest: jest.fn().mockReturnValue('mock-token-hash'),
		}),
	};
});

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
	sign: jest.fn().mockReturnValue('mock-jwt-token'),
	verify: jest.fn().mockImplementation((token: string, secret: string) => {
		if (token === 'valid-token') {
			return { userId: 'user-uuid-123', email: 'test@test.com' };
		}
		throw new Error('Invalid token');
	}),
}));

// Mock DB
const mockQuery = jest.fn();
jest.mock('@/lib/db', () => ({
	pool: { query: jest.fn(), end: jest.fn() },
	query: (...args: unknown[]) => mockQuery(...args),
}));

function makeRequest(url: string, options?: RequestInit) {
	return new Request(url, {
		headers: { 'content-type': 'application/json' },
		...options,
	});
}

describe('POST /api/auth/register', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 for invalid email', async () => {
		const { POST } = require('@/app/api/auth/register/route');
		const req = new Request('http://localhost:3000/api/auth/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'not-an-email',
				password: 'Password123!',
				username: 'validuser',
				terms_agreed: true,
			}),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 400 for short password', async () => {
		const { POST } = require('@/app/api/auth/register/route');
		const req = new Request('http://localhost:3000/api/auth/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'test@test.com',
				password: 'short',
				username: 'validuser',
				terms_agreed: true,
			}),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 400 for short username', async () => {
		const { POST } = require('@/app/api/auth/register/route');
		const req = new Request('http://localhost:3000/api/auth/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'test@test.com',
				password: 'Password123!',
				username: 'ab',
				terms_agreed: true,
			}),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 400 when terms_agreed is false', async () => {
		const { POST } = require('@/app/api/auth/register/route');
		const req = new Request('http://localhost:3000/api/auth/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'test@test.com',
				password: 'Password123!',
				username: 'validuser',
				terms_agreed: false,
			}),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 409 when email already exists', async () => {
		// Simulate unique violation on email
		mockQuery.mockRejectedValueOnce({ code: '23505', constraint: 'users_email_key' });
		const { POST } = require('@/app/api/auth/register/route');
		const req = new Request('http://localhost:3000/api/auth/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'taken@test.com',
				password: 'Password123!',
				username: 'validuser',
				terms_agreed: true,
			}),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(409);
		expect(body.error).toMatch(/email/i);
	});

	it('should return 409 when username already exists', async () => {
		mockQuery.mockRejectedValueOnce({ code: '23505', constraint: 'users_username_key' });
		const { POST } = require('@/app/api/auth/register/route');
		const req = new Request('http://localhost:3000/api/auth/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'test@test.com',
				password: 'Password123!',
				username: 'taken_user',
				terms_agreed: true,
			}),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(409);
		expect(body.error).toMatch(/username/i);
	});

	it('should return 201 with tokens on successful registration', async () => {
		const mockUser = {
			id: 'user-uuid-123',
			email: 'test@test.com',
			username: 'validuser',
			display_name: null,
			avatar_url: null,
		};
		// INSERT user returns user
		mockQuery.mockResolvedValueOnce({ rows: [mockUser] });
		// INSERT refresh_token
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { POST } = require('@/app/api/auth/register/route');
		const req = new Request('http://localhost:3000/api/auth/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'test@test.com',
				password: 'Password123!',
				username: 'validuser',
				terms_agreed: true,
			}),
		});
		const res = await POST(req);
		const body = await res.json();

		expect(res.status).toBe(201);
		expect(body.user).toBeDefined();
		expect(body.user.id).toBe('user-uuid-123');
		expect(body.access_token).toBeDefined();
		expect(body.refresh_token).toBeDefined();
		// Password should NEVER appear in response
		expect(body.user.password).toBeUndefined();
		expect(body.user.password_hash).toBeUndefined();
	});
});

describe('POST /api/auth/login', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 for invalid body', async () => {
		const { POST } = require('@/app/api/auth/login/route');
		const req = new Request('http://localhost:3000/api/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'not-email' }),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 401 when email not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { POST } = require('@/app/api/auth/login/route');
		const req = new Request('http://localhost:3000/api/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'noexist@test.com', password: 'Password123!' }),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(401);
		expect(body.error).toBe('Invalid credentials');
	});

	it('should return 401 when password is wrong', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: 'user-uuid-123', email: 'test@test.com', password_hash: '$2b$12$hash',
				username: 'testuser', display_name: null, avatar_url: null, is_active: true,
			}],
		});
		const { POST } = require('@/app/api/auth/login/route');
		const req = new Request('http://localhost:3000/api/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'test@test.com', password: 'WrongPass123!' }),
		});
		const res = await POST(req);
		expect(res.status).toBe(401);
	});

	it('should return 403 when account is disabled', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: 'user-uuid-123', email: 'test@test.com', password_hash: '$2b$12$hash',
				username: 'testuser', display_name: null, avatar_url: null, is_active: false,
			}],
		});
		const { POST } = require('@/app/api/auth/login/route');
		const req = new Request('http://localhost:3000/api/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'test@test.com', password: 'Password123!' }),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(403);
		expect(body.error).toBe('Account disabled');
	});

	it('should return 200 with tokens on successful login', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: 'user-uuid-123', email: 'test@test.com', password_hash: '$2b$12$hash',
				username: 'testuser', display_name: 'Test User', avatar_url: null, is_active: true,
			}],
		});
		// INSERT refresh_token
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { POST } = require('@/app/api/auth/login/route');
		const req = new Request('http://localhost:3000/api/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'test@test.com', password: 'Password123!' }),
		});
		const res = await POST(req);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.user.id).toBe('user-uuid-123');
		expect(body.access_token).toBeDefined();
		expect(body.refresh_token).toBeDefined();
		expect(body.user.password_hash).toBeUndefined();
	});
});

describe('GET /api/auth/check-username', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when username param is missing', async () => {
		const { GET } = require('@/app/api/auth/check-username/route');
		const req = new Request('http://localhost:3000/api/auth/check-username');
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return 400 when username is too short', async () => {
		const { GET } = require('@/app/api/auth/check-username/route');
		const req = new Request('http://localhost:3000/api/auth/check-username?username=ab');
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return available: true when username not taken', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { GET } = require('@/app/api/auth/check-username/route');
		const req = new Request('http://localhost:3000/api/auth/check-username?username=newuser');
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.available).toBe(true);
	});

	it('should return available: false when username is taken', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ id: 'some-uuid' }] });
		const { GET } = require('@/app/api/auth/check-username/route');
		const req = new Request('http://localhost:3000/api/auth/check-username?username=takenuser');
		const res = await GET(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.available).toBe(false);
	});
});

describe('POST /api/auth/refresh', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when refresh_token is missing', async () => {
		const { POST } = require('@/app/api/auth/refresh/route');
		const req = new Request('http://localhost:3000/api/auth/refresh', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({}),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 401 when token not found in DB', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { POST } = require('@/app/api/auth/refresh/route');
		const req = new Request('http://localhost:3000/api/auth/refresh', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ refresh_token: 'invalid-token' }),
		});
		const res = await POST(req);
		expect(res.status).toBe(401);
	});

	it('should return 200 with new tokens on valid refresh', async () => {
		// Find token in DB
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: 'token-uuid',
				user_id: 'user-uuid-123',
				expires_at: new Date(Date.now() + 86400000).toISOString(),
				revoked_at: null,
			}],
		});
		// Revoke old token
		mockQuery.mockResolvedValueOnce({ rows: [] });
		// Get user info
		mockQuery.mockResolvedValueOnce({
			rows: [{ id: 'user-uuid-123', email: 'test@test.com' }],
		});
		// Insert new refresh token
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { POST } = require('@/app/api/auth/refresh/route');
		const req = new Request('http://localhost:3000/api/auth/refresh', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ refresh_token: 'valid-refresh-token' }),
		});
		const res = await POST(req);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.access_token).toBeDefined();
		expect(body.refresh_token).toBeDefined();
	});
});

describe('POST /api/auth/signout', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return 400 when refresh_token missing', async () => {
		const { POST } = require('@/app/api/auth/signout/route');
		const req = new Request('http://localhost:3000/api/auth/signout', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({}),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it('should return 200 on successful signout', async () => {
		mockQuery.mockResolvedValueOnce({ rowCount: 1 });
		const { POST } = require('@/app/api/auth/signout/route');
		const req = new Request('http://localhost:3000/api/auth/signout', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ refresh_token: 'some-token' }),
		});
		const res = await POST(req);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.message).toBe('Signed out');
	});
});

describe('GET /api/users/me', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should return user profile for valid user_id query param', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: 'user-uuid-123',
				email: 'test@test.com',
				username: 'testuser',
				display_name: 'Test User',
				avatar_url: null,
				bio: null,
				is_private: false,
				is_active: true,
				created_at: '2026-01-01T00:00:00Z',
			}],
		});
		const { GET } = require('@/app/api/users/me/route');
		const req = new Request('http://localhost:3000/api/users/me?user_id=user-uuid-123');
		const res = await GET(req);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.user.id).toBe('user-uuid-123');
		expect(body.user.password_hash).toBeUndefined();
	});

	it('should return 400 when user_id is missing', async () => {
		const { GET } = require('@/app/api/users/me/route');
		const req = new Request('http://localhost:3000/api/users/me');
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it('should return 404 when user not found', async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });
		const { GET } = require('@/app/api/users/me/route');
		const req = new Request('http://localhost:3000/api/users/me?user_id=nonexistent');
		const res = await GET(req);
		expect(res.status).toBe(404);
	});
});

describe('PATCH /api/users/me', () => {
	beforeEach(() => {
		jest.resetModules();
		mockQuery.mockReset();
	});

	it('should update display_name successfully', async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{
				id: 'user-uuid-123',
				email: 'test@test.com',
				username: 'testuser',
				display_name: 'New Name',
				avatar_url: null,
				bio: null,
				is_private: false,
			}],
		});
		const { PATCH } = require('@/app/api/users/me/route');
		const req = new Request('http://localhost:3000/api/users/me?user_id=user-uuid-123', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ displayName: 'New Name' }),
		});
		const res = await PATCH(req);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.user.display_name).toBe('New Name');
	});

	it('should return 400 when user_id missing', async () => {
		const { PATCH } = require('@/app/api/users/me/route');
		const req = new Request('http://localhost:3000/api/users/me', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ displayName: 'New Name' }),
		});
		const res = await PATCH(req);
		expect(res.status).toBe(400);
	});
});
