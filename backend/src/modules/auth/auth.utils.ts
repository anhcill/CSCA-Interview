import type { Role } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

const isProduction = process.env.NODE_ENV === "production";
const configuredPasswordHashRounds = Number(process.env.PASSWORD_HASH_ROUNDS);
export const passwordHashRounds =
  Number.isInteger(configuredPasswordHashRounds) &&
  configuredPasswordHashRounds >= 8 &&
  configuredPasswordHashRounds <= 14
    ? configuredPasswordHashRounds
    : isProduction
      ? 12
      : 10;
export const refreshTokenCookieName = "ai_phongvan_refresh";
export const refreshTokenTtlMs = 1000 * 60 * 60 * 24 * 30;

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
};

export function createAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    env.jwtSecret,
    { expiresIn: "15m" }
  );
}

export function createRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getRefreshTokenExpiresAt() {
  return new Date(Date.now() + refreshTokenTtlMs);
}

export function getRefreshTokenFromRequest(req: Request) {
  const token = req.cookies?.[refreshTokenCookieName] as string | undefined;
  return token ?? null;
}

export function setRefreshTokenCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(refreshTokenCookieName, token, {
    httpOnly: true,
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    path: "/api/auth",
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction
  });
}

export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(refreshTokenCookieName, {
    httpOnly: true,
    path: "/api/auth",
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction
  });
}

export function sanitizeUser(user: AuthUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null
  };
}

export function passwordHashNeedsRefresh(passwordHash: string) {
  const match = /^\$2[aby]\$(\d{2})\$/.exec(passwordHash);
  if (!match) return false;
  return Number(match[1]) !== passwordHashRounds;
}

export function getBearerToken(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const [type, token] = authorization.split(" ");
  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
}
