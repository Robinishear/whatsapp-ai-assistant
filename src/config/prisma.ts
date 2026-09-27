import { PrismaClient } from "@prisma/client";

// Reuse a single instance across hot-reloads / requests.
export const prisma = new PrismaClient();
