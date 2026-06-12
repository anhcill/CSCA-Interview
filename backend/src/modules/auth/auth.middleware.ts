import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { getBearerToken, sanitizeUser } from "./auth.utils.js";

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  avatarUrl?: string | null;
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ message: "Bạn chưa đăng nhập" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const userId = typeof payload === "object" && "sub" in payload ? payload.sub : null;

    if (!userId || typeof userId !== "string") {
      res.status(401).json({ message: "Token không hợp lệ" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.deletedAt || !user.isActive) {
      res.status(401).json({ message: "Tài khoản không còn khả dụng" });
      return;
    }

    res.locals.user = sanitizeUser(user);
    next();
  } catch {
    res.status(401).json({ message: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ" });
  }
}

export function requireRole(...roles: AuthenticatedUser["role"][]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthenticatedUser | undefined;

    if (!user) {
      res.status(401).json({ message: "Bạn chưa đăng nhập" });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({ message: "Bạn không có quyền truy cập chức năng này" });
      return;
    }

    next();
  };
}
