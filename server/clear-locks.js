// Clear OTP locks and rate limits for development
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearLocks() {
  try {
    // Clear OTP locks
    const deletedLocks = await prisma.oTPLock.deleteMany({});
    console.log(`✅ Cleared ${deletedLocks.count} OTP locks`);

    // Clear rate limit records
    const deletedRequests = await prisma.oTPRequest.deleteMany({});
    console.log(`✅ Cleared ${deletedRequests.count} rate limit records`);

    console.log('\n✅ All locks cleared! You can now login again.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearLocks();
