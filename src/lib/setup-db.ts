// This is a one-time setup script to initialize the database schema.
// Run it from your terminal with: `npx tsx src/lib/setup-db.ts`
import { pool } from './db';

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('Starting database setup...');
    
    await client.query('BEGIN');

    // -- Create Tables --
    console.log('Creating tables...');

    // SETTINGS Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // CLASSES Table
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

    // BOOKINGS Table
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

    // CLASS_PACKS Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS class_packs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        classes INTEGER NOT NULL,
        price NUMERIC(10, 2) NOT NULL
      );
    `);

    // CUSTOM_PACK_PRICES Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_pack_prices (
        num_classes INTEGER PRIMARY KEY,
        price NUMERIC(10, 2) NOT NULL
      );
    `);

    console.log('Tables created successfully.');

    // -- Seed Initial Data (optional, good for getting started) --
    console.log('Seeding initial data...');
    
    // Seed default class packs if table is empty
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

    // Seed default custom prices if table is empty
    const customPricesCount = await client.query('SELECT COUNT(*) FROM custom_pack_prices');
    if (customPricesCount.rows[0].count === '0') {
        const prices = Array.from({ length: 12 }, (_, i) => i + 1).map(val => ({ num: val, price: val * 18 }));
        for (const p of prices) {
            await client.query('INSERT INTO custom_pack_prices (num_classes, price) VALUES ($1, $2)', [p.num, p.price]);
        }
        console.log('Seeded default custom pack prices.');
    }
    
    // Seed settings if not present
    const settingsCount = await client.query("SELECT COUNT(*) FROM settings WHERE key = 'activeBookingMonth'");
    if (settingsCount.rows[0].count === '0') {
        const defaultMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        await client.query("INSERT INTO settings (key, value) VALUES ('activeBookingMonth', $1)", [defaultMonth.toISOString()]);
        console.log('Seeded default active booking month.');
    }

    await client.query('COMMIT');
    
    console.log('✅ Database setup complete!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔴 Error setting up database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
