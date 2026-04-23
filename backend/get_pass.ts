import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({
    where: { email: 'karthikvenkat1204@gmail.com' }
  });
  console.log('User password hash:', user?.password);
}

run().catch(console.error).finally(() => prisma.$disconnect());
