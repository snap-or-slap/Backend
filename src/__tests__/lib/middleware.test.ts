import { describe, it, expect, beforeAll } from '@jest/globals';
import { NextRequest } from 'next/server';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-middleware';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  process.env.CRON_SECRET = 'test';
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.NODE_ENV = 'test';
});

import jwt from 'jsonwebtoken';

function makeRequest(token?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return new NextRequest('http://localhost:3000/api/test', { headers });
}

describe('withAuth middleware', () => {
  it('should return 401 when no Bearer token', async () => {
    const { withAuth } = require('@/lib/middleware/withAuth');
    const handler = jest.fn();
    const wrapped = withAuth(handler);

    const req = makeRequest();
    const res = await wrapped(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return 401 when token is expired', async () => {
    const { withAuth } = require('@/lib/middleware/withAuth');
    const handler = jest.fn();
    const wrapped = withAuth(handler);

    const expiredToken = jwt.sign(
      { userId: '123', email: 'test@test.com' },
      'test-access-secret-for-middleware',
      { expiresIn: '-1s' }
    );
    const req = makeRequest(expiredToken);
    const res = await wrapped(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Token expired');
  });

  it('should call handler with correct user when token is valid', async () => {
    const { withAuth } = require('@/lib/middleware/withAuth');
    const handler = jest.fn().mockImplementation(async () => {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ ok: true });
    });
    const wrapped = withAuth(handler);

    const validToken = jwt.sign(
      { userId: 'user-123', email: 'test@test.com' },
      'test-access-secret-for-middleware',
      { expiresIn: '15m' }
    );
    const req = makeRequest(validToken);
    await wrapped(req);

    expect(handler).toHaveBeenCalled();
    const callArgs = handler.mock.calls[0];
    expect(callArgs[0]).toBe(req); // first arg is request
    expect(callArgs[1]).toMatchObject({ userId: 'user-123', email: 'test@test.com' });
  });
});

describe('Error Handler', () => {
  it('should return 400 for ValidationError', async () => {
    const { AppError } = require('@/lib/errors');
    const { withErrorHandler } = require('@/lib/middleware/errorHandler');

    const handler = withErrorHandler(async () => {
      throw new AppError('Invalid input', 400);
    });

    const req = makeRequest();
    const res = await handler(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('should return 404 for NotFoundError', async () => {
    const { AppError } = require('@/lib/errors');
    const { withErrorHandler } = require('@/lib/middleware/errorHandler');

    const handler = withErrorHandler(async () => {
      throw new AppError('Not found', 404);
    });

    const req = makeRequest();
    const res = await handler(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Not found');
  });

  it('should return 500 for unknown errors without stack trace', async () => {
    const { withErrorHandler } = require('@/lib/middleware/errorHandler');

    const handler = withErrorHandler(async () => {
      throw new Error('Something broke');
    });

    const req = makeRequest();
    const res = await handler(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(body.stack).toBeUndefined();
  });
});
