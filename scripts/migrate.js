const fs = require('fs');
const path = require('path');
const { loadEnvConfig } = require('@next/env');
const { Pool } = require('pg');

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

    const migrationsDir = path.join(
      process.cwd(),
      'src',
      'lib',
      'db',
      'migrations',
    );

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql') && !file.includes('rollback'))
      .sort();

    for (const file of files) {
      const { rows } = await pool.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [file],
      );

      if (rows.length > 0) {
        console.log(`Skipped: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying: ${file}`);

      if (sql.includes('ALTER TYPE') && sql.includes('ADD VALUE')) {
        const statements = sql
          .split(';')
          .map((statement) => statement.trim())
          .filter((statement) => {
            const withoutComments = statement
              .replace(/^(--[^\n]*\n\s*)*/g, '')
              .trim();
            return withoutComments.length > 0;
          });

        for (const statement of statements) {
          await pool.query(statement);
        }
      } else {
        await pool.query(sql);
      }

      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      console.log(`Applied: ${file}`);
    }

    console.log('All migrations complete.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
