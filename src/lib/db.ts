import { Pool, QueryResult, QueryResultRow } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

const isInternalConnection = databaseUrl?.includes('.railway.internal');

const isLocalConnection =
	databaseUrl?.includes('localhost') ||
	databaseUrl?.includes('127.0.0.1') ||
	databaseUrl?.includes('host.docker.internal');

const shouldUseSsl = Boolean(databaseUrl) && !isLocalConnection && !isInternalConnection;

const pool = new Pool({
	connectionString: databaseUrl,
	max: 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 5000,
	ssl: shouldUseSsl,
});

async function query<T extends QueryResultRow = QueryResultRow>(
	text: string,
	params?: unknown[]
): Promise<QueryResult<T>> {
	return pool.query<T>(text, params);
}

export { pool, query };
