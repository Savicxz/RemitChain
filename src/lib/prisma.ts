import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as typeof globalThis & {
  prisma?: PrismaClient | null;
};

export function getPrisma() {
  if (globalForPrisma.prisma !== undefined) {
    return globalForPrisma.prisma;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    globalForPrisma.prisma = null;
    return globalForPrisma.prisma;
  }

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
}
