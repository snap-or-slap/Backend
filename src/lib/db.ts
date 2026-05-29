import { Pool, QueryResult, QueryResultRow } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

const isInternalConnection = databaseUrl.includes('.railway.internal');

const isLocalConnection =
  databaseUrl.includes('localhost') ||
  databaseUrl.includes('127.0.0.1') ||
  databaseUrl.includes('host.docker.internal');

const shouldUseSsl =
  process.env.DATABASE_SSL === 'true' ||
  (!isLocalConnection &&
    !isInternalConnection &&
    process.env.NODE_ENV === 'production');

const rejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: shouldUseSsl
    ? {
        rejectUnauthorized,
      }
    : false,
});

async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export { pool, query };