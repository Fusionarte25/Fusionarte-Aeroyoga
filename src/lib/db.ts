import { Pool } from 'pg';

let pool: Pool;

// Check if the DATABASE_URL is provided.
if (process.env.DATABASE_URL) {
  pool = new Pool({
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
} else {
  // If the DATABASE_URL is not set, we are likely in a local development environment
  // without a database. We create a "mock" pool that will throw an error
  // if any code tries to use it, but it won't crash the entire application on startup.
  console.warn(`
    ------------------------------------------------------------------------------------------
    WARNING: DATABASE_URL environment variable is not set.
    The application will not be able to connect to the database.
    If you are developing locally, you can create a .env.local file in the root directory
    and add your database connection string there:
    DATABASE_URL="postgres://user:password@host:port/database"
    ------------------------------------------------------------------------------------------
  `);

  // This is a mock pool. It allows the app to start, but any database query will fail.
  pool = {
    query: () => Promise.reject(new Error("Database not configured. DATABASE_URL is not set.")),
    connect: () => Promise.reject(new Error("Database not configured. DATABASE_URL is not set.")),
    on: () => {}, // Mock 'on' method to prevent crashes
    end: () => Promise.resolve(), // Mock 'end' method
  } as any;
}

export { pool };
