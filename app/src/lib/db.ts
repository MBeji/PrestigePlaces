import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./dbUrl";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const datasourceUrl = resolveDatabaseUrl();
  return datasourceUrl ? new PrismaClient({ datasourceUrl }) : new PrismaClient();
}

/** Client Prisma singleton (évite les connexions multiples en développement). */
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
