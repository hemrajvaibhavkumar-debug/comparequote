import pg from "pg";
import "dotenv/config";

async function fix() {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Dropping VendorMaster and creating vendor...");
    await pool.query('DROP TABLE IF EXISTS "VendorMaster"');
    await pool.query(`
      CREATE TABLE "vendor" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT UNIQUE NOT NULL,
        "_address" TEXT,
        "state" TEXT,
        "gstin" TEXT,
        "moblie_no" TEXT
      )
    `);
    console.log("Success!");
  } catch (err) {
    console.error("Error fixing table:", err);
  } finally {
    await pool.end();
  }
}

fix();
