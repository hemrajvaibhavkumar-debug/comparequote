import pg from "pg";
import "dotenv/config";

async function check() {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Checking data in VendorMaster...");
    const res = await pool.query('SELECT * FROM "VendorMaster" LIMIT 5');
    console.log("Data:", res.rows);
  } catch (err) {
    console.error("Error checking data:", err);
  } finally {
    await pool.end();
  }
}

check();
