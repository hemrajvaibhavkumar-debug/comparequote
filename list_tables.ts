import pg from "pg";
import "dotenv/config";

async function check() {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Listing tables...");
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables:", res.rows.map(r => r.table_name));
  } catch (err) {
    console.error("Error listing tables:", err);
  } finally {
    await pool.end();
  }
}

check();
