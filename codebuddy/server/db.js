import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Return DATE columns as 'YYYY-MM-DD' strings instead of JS Dates
pg.types.setTypeParser(1082, (v) => v);

const url = process.env.DATABASE_URL || '';
export const pool = new pg.Pool({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
  max: 5,
});

// All queries use $1, $2 … parameters, so user input is never concatenated into SQL (SQL-injection safe).
export const q = async (text, params) => (await pool.query(text, params)).rows;
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

export async function initSchema() {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'schema.sql');
  await pool.query(await readFile(file, 'utf8'));
}
