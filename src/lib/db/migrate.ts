import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

loadEnvConfig(process.cwd());

async function migrate() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL or DIRECT_URL must be set');
    process.exit(1);
  }

  const isInternalConnection = databaseUrl.includes('.railway.internal');

  const isLocalConnection =
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1') ||
    databaseUrl.includes('host.docker.internal');

  const shouldUseSsl = !isLocalConnection && !isInternalConnection;

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl,
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.includes('rollback'))
      .sort();

    for (const file of files) {
      const { rows } = await pool.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [file],
      );

      if (rows.length > 0) {
        console.log(`⏭  Already applied: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      console.log(`▶  Applying: ${file}`);

      if (sql.includes('ALTER TYPE') && sql.includes('ADD VALUE')) {
        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => {
            const withoutComments = s.replace(/^(--[^\n]*\n\s*)*/g, '').trim();
            return withoutComments.length > 0;
          });

        for (const stmt of statements) {
          await pool.query(stmt);
        }
      } else {
        await pool.query(sql);
      }

      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);

      console.log(`✅ Applied: ${file}`);
    }

    console.log('\nAll migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
