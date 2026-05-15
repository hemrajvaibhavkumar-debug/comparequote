import pg from "pg";
import "dotenv/config";

async function check() {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Checking columns for VendorMaster...");
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'VendorMaster'
    `);
    console.log("Columns:", res.rows);
  } catch (err) {
    console.error("Error checking columns:", err);
  } finally {
    await pool.end();
  }
}

check();
