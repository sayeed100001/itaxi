import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Cleaning up sample data...');

  // Delete sample phone numbers
  const samplePhones = [
    '+93700000000', '+93700000001', '+93700000002',
    '+93700000010', '+93700000011', '+93700000012', '+93700000013'
  ];

  for (const phone of samplePhones) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (user) {
      // Delete related data first
      await prisma.driver.deleteMany({ where: { userId: user.id } });
      await prisma.trip.deleteMany({ where: { OR: [{ riderId: user.id }, { driverId: user.id }] } });
      await prisma.oTP.deleteMany({ where: { phone } });
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`✅ Deleted user: ${phone}`);
    }
  }

  console.log('🎉 Cleanup completed!');
}

cleanup()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
