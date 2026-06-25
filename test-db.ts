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
    
    console.log("Checking duplicates in User.username...");
    const userGroups = await prisma.$queryRaw`SELECT username, COUNT(*) FROM "User" GROUP BY username HAVING COUNT(*) > 1`;
    console.log("Duplicate Users:", userGroups);

    console.log("Checking duplicates in SystemRole.name...");
    const roleGroups = await prisma.$queryRaw`SELECT name, COUNT(*) FROM "SystemRole" GROUP BY name HAVING COUNT(*) > 1`;
    console.log("Duplicate SystemRoles:", roleGroups);

    console.log("Checking duplicates in Executive.name...");
    const execGroups = await prisma.$queryRaw`SELECT name, COUNT(*) FROM "Executive" GROUP BY name HAVING COUNT(*) > 1`;
    console.log("Duplicate Executives:", execGroups);

    console.log("Checking duplicates in Plant.name...");
    const plantGroups = await prisma.$queryRaw`SELECT name, COUNT(*) FROM "Plant" GROUP BY name HAVING COUNT(*) > 1`;
    console.log("Duplicate Plants:", plantGroups);

    console.log("Checking duplicates in TermsTemplate.name...");
    try {
      const termsGroups = await prisma.$queryRaw`SELECT name, COUNT(*) FROM "TermsTemplate" GROUP BY name HAVING COUNT(*) > 1`;
      console.log("Duplicate TermsTemplates:", termsGroups);
    } catch (e: any) {
      console.log("TermsTemplate table check failed:", e.message);
    }
    console.log("Recreating ItAudit table...");
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "ItAudit"`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "ItAudit" (
        "id" SERIAL PRIMARY KEY,
        "employee_name" TEXT NOT NULL,
        "department" TEXT NOT NULL,
        "designation" TEXT NOT NULL,
        "sheets" JSONB NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("ItAudit table created or already exists!");

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
