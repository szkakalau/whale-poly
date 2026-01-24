
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from project root
const envPath = path.join(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

async function nukeSnapshots() {
  console.log('WARNING: This will delete ALL data in orderbook_snapshots table.');
  console.log('This is an emergency operation to free up disk space immediately.');
  console.log('Waiting 5 seconds before execution... Press Ctrl+C to cancel.');
  
  await new Promise(r => setTimeout(r, 5000));

  try {
    console.log('Executing TRUNCATE...');
    // TRUNCATE is much faster than DELETE and reclaims disk space immediately without generating massive WAL logs
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "orderbook_snapshots";`);
    console.log('Successfully truncated orderbook_snapshots table.');
  } catch (err) {
    console.error('Failed to truncate table:', err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  nukeSnapshots()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
