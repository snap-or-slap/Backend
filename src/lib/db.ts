import { Pool, QueryResult, QueryResultRow } from 'pg';

const isInternalConnection = process.env.DATABASE_URL?.includes('.railway.internal');

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 5000,
	ssl: isInternalConnection ? false : { rejectUnauthorized: false },
});

async function query<T extends QueryResultRow = QueryResultRow>(
	text: string,
	params?: unknown[]
): Promise<QueryResult<T>> {
	return pool.query<T>(text, params);
}

export { pool, query };
