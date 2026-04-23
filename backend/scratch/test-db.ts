import { prisma } from '../src/db.ts';
async function main() {
  const user = await prisma.user.findUnique({ where: { email: "nihilkaarthikeyan@gmail.com" } });
  console.log(user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
