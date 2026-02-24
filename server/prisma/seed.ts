import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with sample data...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Admin
  const admin = await prisma.user.upsert({
    where: { phone: '+93700000000' },
    update: { password: hashedPassword },
    create: {
      phone: '+93700000000',
      name: 'Admin User',
      email: 'admin@itaxi.af',
      city: 'kabul-city',
      province: 'kabul',
      role: 'ADMIN',
      password: hashedPassword,
    },
  });
  console.log('✅ Admin: +93700000000 (password: admin123)');

  // Riders
  const rider1 = await prisma.user.upsert({
    where: { phone: '+93700000001' },
    update: {},
    create: {
      phone: '+93700000001',
      name: 'Ahmad Rahimi',
      email: 'ahmad@example.af',
      city: 'kabul-city',
      province: 'kabul',
      role: 'RIDER',
    },
  });

  const rider2 = await prisma.user.upsert({
    where: { phone: '+93700000002' },
    update: {},
    create: {
      phone: '+93700000002',
      name: 'Fatima Karimi',
      email: 'fatima@example.af',
      city: 'kabul-city',
      province: 'kabul',
      role: 'RIDER',
    },
  });
  console.log('✅ Riders: +93700000001, +93700000002');

  // Drivers with profiles
  const driverData = [
    { phone: '+93700000010', name: 'Hamid Khan', vehicle: 'Toyota Corolla', plate: 'KBL-1001', lat: 34.5260, lng: 69.1777 },
    { phone: '+93700000011', name: 'Rashid Ali', vehicle: 'Honda Civic', plate: 'KBL-1002', lat: 34.5280, lng: 69.1800 },
    { phone: '+93700000012', name: 'Karim Shah', vehicle: 'Toyota Camry', plate: 'KBL-1003', lat: 34.5240, lng: 69.1750 },
    { phone: '+93700000013', name: 'Nasir Ahmad', vehicle: 'Nissan Sunny', plate: 'KBL-1004', lat: 34.5300, lng: 69.1820 },
  ];

  for (const d of driverData) {
    const driver = await prisma.user.upsert({
      where: { phone: d.phone },
      update: {},
      create: {
        phone: d.phone,
        name: d.name,
        email: `${d.name.toLowerCase().replace(' ', '.')}@itaxi.af`,
        city: 'kabul-city',
        province: 'kabul',
        role: 'DRIVER',
      },
    });

    const driverProfile = await prisma.driver.upsert({
      where: { userId: driver.id },
      update: {
        status: 'ONLINE',
      },
      create: {
        userId: driver.id,
        vehicleType: d.vehicle,
        plateNumber: d.plate,
        city: 'kabul-city',
        province: 'kabul',
        baseFare: 50,
        perKmRate: 20,
        status: 'ONLINE',
      },
    });

    // Create/update driver location
    await prisma.driverLocation.upsert({
      where: { driverId: driverProfile.id },
      update: {
        lat: d.lat,
        lng: d.lng,
      },
      create: {
        driverId: driverProfile.id,
        lat: d.lat,
        lng: d.lng,
      },
    });
  }
  console.log('✅ Drivers: +93700000010 to +93700000013 (ONLINE in Kabul)');

  console.log('\n🎉 Sample data created!');
  console.log('\n📱 Login Credentials:');
  console.log('   Admin:  +93700000000 / admin123');
  console.log('   Rider:  +93700000001 (OTP)');
  console.log('   Driver: +93700000010 (OTP)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
