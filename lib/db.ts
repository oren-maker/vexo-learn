import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// JSON helpers for SQLite (stores arrays as JSON strings)
export const jsonArray = {
  stringify: (v: unknown) => JSON.stringify(Array.isArray(v) ? v : []),
  parse: (v: string | null | undefined): string[] => {
    if (!v) return [];
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  },
};
