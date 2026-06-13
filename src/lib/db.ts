import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaClientSingleton: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
}

export const db: PrismaClient =
  globalThis.prismaClientSingleton ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaClientSingleton = db;
}

export default db;
