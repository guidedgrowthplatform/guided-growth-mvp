import pg from 'pg';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const client = await pool.connect();
const res = await client.query('SELECT DISTINCT cadence FROM user_habits');
console.log(
  'Distinct cadences:',
  res.rows.map((r) => r.cadence),
);
client.release();
await pool.end();
