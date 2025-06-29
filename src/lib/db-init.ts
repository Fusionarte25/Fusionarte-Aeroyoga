// This script runs automatically on application startup in production.
import { pool } from './db';

let isInitialized = false;

async function initializeDatabase() {
  // Prevent re-running if already initialized
  if (isInitialized) return;

  const client = await pool.connect();
  try {
    console.log('Checking database schema...');
    
    await client.query('BEGIN');

    // -- Create Tables --
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        total_spots INTEGER NOT NULL,
        booked_spots INTEGER NOT NULL DEFAULT 0,
        teacher TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        student_name TEXT NOT NULL,
        student_email TEXT NOT NULL,
        student_phone TEXT NOT NULL,
        booking_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        pack_size INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'completed')),
        class_ids TEXT[] NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS class_packs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        classes INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_pack_prices (
        num_classes INTEGER PRIMARY KEY,
        price NUMERIC(10, 2) NOT NULL
      );
    `);

    // -- Seed Initial Data --
    const packsCount = await client.query('SELECT COUNT(*) FROM class_packs');
    if (packsCount.rows[0].count === '0') {
      await client.query(`
        INSERT INTO class_packs (id, name, classes, price) VALUES
        ('4', '4 Clases / mes', 4, 65),
        ('8', '8 Clases / mes', 8, 110),
        ('12', '12 Clases / mes', 12, 150);
      `);
      console.log('Seeded default class packs.');
    }

    const customPricesCount = await client.query('SELECT COUNT(*) FROM custom_pack_prices');
    if (customPricesCount.rows[0].count === '0') {
        const prices = Array.from({ length: 12 }, (_, i) => i + 1).map(val => ({ num: val, price: val * 18 }));
        for (const p of prices) {
            await client.query('INSERT INTO custom_pack_prices (num_classes, price) VALUES ($1, $2)', [p.num, p.price]);
        }
        console.log('Seeded default custom pack prices.');
    }
    
    const settingsCount = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'activeBookingMonth'");
    if (settingsCount.rows[0].count === '0') {
        const defaultMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        await client.query("INSERT INTO settings (key, value) VALUES ('activeBookingMonth', $1)", [defaultMonth.toISOString()]);
        console.log('Seeded default active booking month.');
    }

    await client.query('COMMIT');
    
    console.log('✅ Database schema and initial data are OK.');
    isInitialized = true;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔴 Error during automatic database initialization:', error);
    // We throw the error so the calling function knows something went wrong, but the app won't crash.
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureDatabaseInitialized() {
  // Only run this in a production environment (like Render) where a DB is expected.
  // This prevents it from running during local development if you don't have a DB configured.
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    try {
      await initializeDatabase();
    } catch (e) {
      console.error("Database initialization failed. The application might not work correctly.");
    }
  }
}
