import { PrismaClient } from '@prisma/client';

// Workers share the generated client from the API package (monorepo node_modules).
export const prisma = new PrismaClient();
