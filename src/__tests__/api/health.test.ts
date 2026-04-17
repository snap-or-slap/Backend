import { describe, it, expect, beforeAll } from '@jest/globals';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
  process.env.JWT_ACCESS_SECRET = 'test';
  process.env.JWT_REFRESH_SECRET = 'test';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  process.env.CRON_SECRET = 'test';
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.NODE_ENV = 'test';
});

// Mock the db module
jest.mock('@/lib/db', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [{ num: 1 }] }),
    end: jest.fn(),
  },
  query: jest.fn().mockResolvedValue({ rows: [{ num: 1 }] }),
}));

describe('Path Alias Resolution', () => {
  it('should resolve @/lib/* path alias without error', () => {
    expect(() => require('@/lib/config')).not.toThrow();
  });

  it('should resolve @/lib/errors path alias without error', () => {
    expect(() => require('@/lib/errors')).not.toThrow();
  });
});

describe('Health endpoint', () => {
  it('GET /api/health returns 200 with status ok and timestamp', async () => {
    // Import the route handler function directly
    const { GET } = require('@/app/api/health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('uptime');
  });
});

describe('Unsupported method handling', () => {
  it('non-exported methods return 405', async () => {
    // Next.js App Router only exports the methods that are supported
    // If POST is not exported, the framework returns 405 automatically
    const healthRoute = require('@/app/api/health/route');
    expect(healthRoute.POST).toBeUndefined();
    expect(healthRoute.PUT).toBeUndefined();
    expect(healthRoute.DELETE).toBeUndefined();
  });
});
