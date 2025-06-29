import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render provides SSL, but might require this setting
  // if you're connecting from a local machine that doesn't default to it.
  // For Render's internal network, it's often not needed.
  // ssl: {
  //   rejectUnauthorized: false,
  // },
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
