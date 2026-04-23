import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  // Try to find a user, or create one if none exist
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'password',
        name: 'Test Tracker'
      }
    });
  }

  const token = jwt.sign({ userId: user.id }, 'neet-ai-super-secret-jwt-key-change-in-production', { expiresIn: '1h' });

  const res = await fetch('http://localhost:5000/api/tutor/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ subject: 'Physics', message: 'Hello!' })
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);
  
  await prisma.$disconnect();
}

run().catch(console.error);
