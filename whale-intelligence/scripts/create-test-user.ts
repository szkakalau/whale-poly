
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from project root
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

async function main() {
  console.log('----------------------------------------');
  console.log('Create Test User Script');
  console.log('----------------------------------------');
  
  // Debug Database Connection
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL is not defined in environment variables.');
    console.error('👉 Please make sure you have a .env file in the root directory.');
    process.exit(1);
  }
  
  // Mask password for security but show host to verify connection
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`🔌 Connecting to Database: ${maskedUrl}`);
  
  // Parse host to give user a hint
  const match = dbUrl.match(/@([^/:]+)/);
  if (match) {
    console.log(`   Host: ${match[1]}`);
    if (match[1].includes('localhost') || match[1].includes('127.0.0.1')) {
       console.warn('   ⚠️  WARNING: You are connecting to a LOCAL database.');
       console.warn('   If your Telegram Bot is on Render, it will NOT see this token.');
       console.warn('   Please update .env with the Render Database URL.');
    } else {
       console.log('   ✅ Remote Database detected (likely Render/Cloud).');
    }
  }

  console.log('\nCreating test user...');

  const email = 'test@internal.com';
  
  // 1. Create or Update User
  const user = await prisma.users.upsert({
    where: { email },
    update: {
      plan: 'elite',
      status: 'active',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    },
    create: {
      email,
      plan: 'elite',
      status: 'active',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }
  });

  console.log(`User created/updated: ${user.id} (${user.email})`);

  // 2. Generate Access Token
  const token = crypto.randomBytes(16).toString('hex');
  
  await prisma.access_tokens.create({
    data: {
      token,
      user_id: user.id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      used: false
    }
  });

  console.log('\n✅ Access Token Generated Successfully!');
  console.log('----------------------------------------');
  console.log(`Token: ${token}`);
  console.log('----------------------------------------');
  console.log(`👉 Send this message to your Telegram Bot:`);
  console.log(`/start ${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
