import { vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

// Mock prisma client globally
vi.mock("../db/prisma.js", () => ({
  prisma: mockDeep<PrismaClient>()
}));

import { prisma } from "../db/prisma.js";

beforeEach(() => {
  mockReset(prisma);
});

// Mock environment variables
process.env.JWT_SECRET = "test_secret_key_long_enough_for_jwt_signing_1234567890";
process.env.PASSWORD_HASH_ROUNDS = "8";
process.env.PORT = "4001";
process.env.NODE_ENV = "test";
