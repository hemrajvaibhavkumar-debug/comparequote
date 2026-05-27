import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function test() {
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("neon.tech") || process.env.DATABASE_URL?.includes("render.com") 
      ? { rejectUnauthorized: false } 
      : false
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  try {
    console.log("Attempting to connect to DB...");
    const count = await prisma.purchaseOrder.count();
    console.log("Connection successful! PO Count:", count);
    
    console.log("Checking Users...");
    const users = await prisma.user.findMany();
    console.log("Users in DB:", users.map(u => u.username));
    
    console.log("Attempting to fetch first PO...");
    const firstPo = await prisma.purchaseOrder.findFirst();
    console.log("First PO:", JSON.stringify(firstPo, null, 2));
  } catch (e: any) {
    console.error("DB Test Failed!");
    console.error("Message:", e.message);
    if (e.code) console.error("Code:", e.code);
    if (e.meta) console.error("Meta:", JSON.stringify(e.meta, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

test();
