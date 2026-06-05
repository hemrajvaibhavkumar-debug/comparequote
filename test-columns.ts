import 'dotenv/config';
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("neon.tech") || process.env.DATABASE_URL?.includes("render.com") 
      ? { rejectUnauthorized: false } 
      : false
  });
  
  try {
    const client = await pool.connect();
    console.log("Connected to DB. Querying table columns...");
    
    // query information_schema for columns of table 'vendor' (mapped from @@map("vendor") in prisma)
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vendor';
    `);
    
    console.log("Columns of table 'vendor':");
    console.log(res.rows);
    
    // query all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log("All tables in public schema:");
    console.log(tablesRes.rows.map((r: any) => r.table_name));

    client.release();
  } catch (err) {
    console.error("Error query:", err);
  } finally {
    await pool.end();
  }
}

main();
