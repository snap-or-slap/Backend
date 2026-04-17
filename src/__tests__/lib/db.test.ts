import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// These tests require a real DATABASE_URL to run
// They will be skipped if DATABASE_URL is not set
const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

describeWithDb('Database Connection', () => {
	beforeAll(() => {
		process.env.DATABASE_URL = DATABASE_URL!;
		process.env.JWT_ACCESS_SECRET = 'test';
		process.env.JWT_REFRESH_SECRET = 'test';
		process.env.CRON_SECRET = 'test';
		process.env.APP_BASE_URL = 'http://localhost:3000';
		process.env.NODE_ENV = 'test';
	});

	afterAll(async () => {
		const { pool } = require('@/lib/db');
		await pool.end();
	});

	it('should connect without throwing', async () => {
		const { pool } = require('@/lib/db');
		const client = await pool.connect();
		expect(client).toBeDefined();
		client.release();
	});

	it('should execute SELECT 1 correctly', async () => {
		const { query } = require('@/lib/db');
		const result = await query('SELECT 1 AS num');
		expect(result.rows[0].num).toBe(1);
	});
});

describe('Database module exports', () => {
	beforeAll(() => {
		process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
		process.env.JWT_ACCESS_SECRET = 'test';
		process.env.JWT_REFRESH_SECRET = 'test';
		process.env.CRON_SECRET = 'test';
		process.env.APP_BASE_URL = 'http://localhost:3000';
		process.env.NODE_ENV = 'test';
	});

	it('should export pool and query function', () => {
		const db = require('@/lib/db');
		expect(db.pool).toBeDefined();
		expect(typeof db.query).toBe('function');
	});
});
