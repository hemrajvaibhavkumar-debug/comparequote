import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("neon.tech") || process.env.DATABASE_URL?.includes("render.com") 
    ? { rejectUnauthorized: false } 
    : false
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const indents = await prisma.indent.findMany({
    orderBy: { id: 'asc' }
  });
  console.log("Total Indents:", indents.length);
  let globalCount = 0;
  for (const indent of indents) {
    const items = indent.items as any[];
    console.log(`Indent ID: ${indent.id}, Indent No: ${indent.indent_no}, Date: ${indent.date.toISOString().split('T')[0]}, Items Count: ${items?.length}`);
    if (items) {
      for (let i = 0; i < items.length; i++) {
        globalCount++;
        if (indent.indent_no === '174' || indent.indent_no === '177' || indent.indent_no === '178') {
          console.log(`  Item ${i + 1}: Global Index ${globalCount} -> PI-${globalCount}`);
        }
      }
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
