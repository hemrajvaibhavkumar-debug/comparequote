import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('UPDATING DATABASE SETTINGS TO HEMRAJ...');

  const settings = await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {
      name: "HEMRAJ INDUSTRIES PRIVATE LIMITED",
      cin: "U01111WB1991PTC051314",
      gstin: "19AAACH8249K1Z4",
      pan: "AAACH8249K",
      email: "purchase@hemrajgroup.co.in",
      phone: "+91 33 2229 8038 / 4064 9316",
      website: "www.hemrajgroup.co.in",
      regd_office: "46B Rafi Ahmed Kidwai Road, 1st Floor, Kolkata-700 016",
      factory_address: "Vill. P.O. Chandul, G.T. Road, Burdwan (W.B.) Pin : 713141"
    },
    create: {
      id: 1,
      name: "HEMRAJ INDUSTRIES PRIVATE LIMITED",
      cin: "U01111WB1991PTC051314",
      gstin: "19AAACH8249K1Z4",
      pan: "AAACH8249K",
      email: "purchase@hemrajgroup.co.in",
      phone: "+91 33 2229 8038 / 4064 9316",
      website: "www.hemrajgroup.co.in",
      regd_office: "46B Rafi Ahmed Kidwai Road, 1st Floor, Kolkata-700 016",
      factory_address: "Vill. P.O. Chandul, G.T. Road, Burdwan (W.B.) Pin : 713141"
    }
  });

  console.log('SUCCESS: Database updated to:', settings.name);
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
