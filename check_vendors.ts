import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

async function check() {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Checking vendors...");
    const vendors = await prisma.vendorMaster.findMany();
    console.log("Found vendors:", vendors.length);
    console.log(JSON.stringify(vendors, null, 2));
  } catch (err) {
    console.error("Error fetching vendors:", err);
    
    try {
        console.log("Attempting raw query...");
        const res = await pool.query('SELECT * FROM vendor LIMIT 5');
        console.log("Raw query results:", res.rows);
    } catch (rawErr) {
        console.error("Raw query failed too:", rawErr);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

check();
