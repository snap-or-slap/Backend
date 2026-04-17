import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Config', () => {
  const REQUIRED_VARS = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    CRON_SECRET: 'test-cron-secret',
    APP_BASE_URL: 'http://localhost:3000',
  };

  beforeEach(() => {
    jest.resetModules();
    // Clear all env vars
    for (const key of Object.keys(REQUIRED_VARS)) {
      delete process.env[key];
    }
    delete process.env.NODE_ENV;
  });

  it('should throw error if DATABASE_URL is missing', () => {
    // Set all EXCEPT DATABASE_URL
    const { DATABASE_URL, ...rest } = REQUIRED_VARS;
    Object.assign(process.env, rest);
    process.env.NODE_ENV = 'test';

    expect(() => {
      require('@/lib/config');
    }).toThrow(/DATABASE_URL/);
  });

  it('should export correct typed config object when all vars present', () => {
    Object.assign(process.env, REQUIRED_VARS);
    process.env.NODE_ENV = 'test';

    const { config } = require('@/lib/config');
    expect(config.DATABASE_URL).toBe(REQUIRED_VARS.DATABASE_URL);
    expect(config.JWT_ACCESS_SECRET).toBe(REQUIRED_VARS.JWT_ACCESS_SECRET);
    expect(config.JWT_REFRESH_SECRET).toBe(REQUIRED_VARS.JWT_REFRESH_SECRET);
    expect(config.SUPABASE_URL).toBe(REQUIRED_VARS.SUPABASE_URL);
    expect(config.SUPABASE_SERVICE_ROLE_KEY).toBe(REQUIRED_VARS.SUPABASE_SERVICE_ROLE_KEY);
    expect(config.CRON_SECRET).toBe(REQUIRED_VARS.CRON_SECRET);
    expect(config.APP_BASE_URL).toBe(REQUIRED_VARS.APP_BASE_URL);
    expect(config.NODE_ENV).toBe('test');
  });

  it('should default NODE_ENV to development if not set', () => {
    Object.assign(process.env, REQUIRED_VARS);

    const { config } = require('@/lib/config');
    expect(config.NODE_ENV).toBe('development');
  });
});
