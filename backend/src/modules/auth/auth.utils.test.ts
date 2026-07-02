import { describe, it, expect } from "vitest";
import { sanitizeUser, getBearerToken, createAccessToken } from "./auth.utils.js";
import jwt from "jsonwebtoken";

describe("Auth Utilities", () => {
  const mockUser = {
    id: "user-uuid-12345",
    fullName: "Nguyen Van A",
    email: "test@example.com",
    role: "USER" as const,
    avatarUrl: null
  };

  it("should sanitize user data, removing password hashes", () => {
    const sanitized = sanitizeUser(mockUser);
    expect(sanitized).toEqual({
      id: "user-uuid-12345",
      fullName: "Nguyen Van A",
      email: "test@example.com",
      role: "USER",
      avatarUrl: null
    });
  });

  it("should extract bearer token from Authorization header", () => {
    const header = "Bearer valid-token-string";
    const token = getBearerToken(header);
    expect(token).toBe("valid-token-string");
  });

  it("should return null if Authorization header is invalid or missing", () => {
    expect(getBearerToken("")).toBeNull();
    expect(getBearerToken("InvalidHeader token")).toBeNull();
    expect(getBearerToken("Bearer ")).toBeNull();
  });

  it("should create a valid JWT access token for a user", () => {
    const token = createAccessToken(mockUser);
    expect(token).toBeTypeOf("string");

    // Verify token using JWT library
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "test_secret_key_long_enough_for_jwt_signing_1234567890") as any;
    expect(decoded.sub).toBe(mockUser.id);
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.role).toBe(mockUser.role);
  });
});
