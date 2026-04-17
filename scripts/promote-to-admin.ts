import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function promoteUserToAdmin(email: string) {
  try {
    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`Found user: ${user.name || user.firstName} ${user.lastName} (${user.email})`);
    console.log(`Current role: ${user.role}`);

    // Update the user role to ADMIN
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });

    console.log(`✅ Successfully promoted user to ADMIN`);
    console.log(`Updated role: ${updatedUser.role}`);
  } catch (error) {
    console.error('Error promoting user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
const email = process.argv[2] || 'ompandya311@gmail.com';
console.log(`Promoting ${email} to admin...`);
promoteUserToAdmin(email);
