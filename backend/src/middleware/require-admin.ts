import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedUser } from "../modules/auth/auth.middleware.js";

const adminRoles: AuthenticatedUser["role"][] = ["ADMIN", "SUPER_ADMIN"];

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  const user = res.locals.user as AuthenticatedUser | undefined;

  if (!user) {
    res.status(401).json({ message: "Bạn chưa đăng nhập" });
    return;
  }

  if (!adminRoles.includes(user.role)) {
    res.status(403).json({ message: "Bạn không có quyền quản trị" });
    return;
  }

  next();
}
