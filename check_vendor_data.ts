import pg from "pg";
import "dotenv/config";

async function check() {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Checking data in 'vendor' table...");
    const res = await pool.query('SELECT * FROM "vendor" LIMIT 10');
    console.log("Vendors found:", res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Error checking data:", err);
  } finally {
    await pool.end();
  }
}

check();
