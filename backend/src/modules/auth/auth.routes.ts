import bcrypt from "bcryptjs";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import {
  clearRefreshTokenCookie,
  createAccessToken,
  createRefreshToken,
  getBearerToken,
  getRefreshTokenExpiresAt,
  getRefreshTokenFromRequest,
  hashRefreshToken,
  sanitizeUser,
  setRefreshTokenCookie
} from "./auth.utils.js";

export const authRouter = Router();

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncRoute(handler: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên phải có ít nhất 2 ký tự"),
  email: z.string().trim().email("Email không hợp lệ"),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự")
});

const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu")
});

async function issueRefreshSession(req: Request, res: Response, userId: string) {
  const refreshToken = createRefreshToken();
  const expiresAt = getRefreshTokenExpiresAt();

  await prisma.authSession.create({
    data: {
      expiresAt,
      refreshTokenHash: hashRefreshToken(refreshToken),
      userAgent: req.get("user-agent") ?? null,
      userId
    }
  });

  setRefreshTokenCookie(res, refreshToken, expiresAt);
}

authRouter.post("/register", asyncRoute(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Dữ liệu đăng ký không hợp lệ",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }

  const { fullName, email, phone, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (existingUser) {
    res.status(409).json({ message: "Email này đã được đăng ký" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      fullName,
      email: normalizedEmail,
      phone: phone || null,
      passwordHash,
      role: "USER"
    }
  });

  const token = createAccessToken(user);
  await issueRefreshSession(req, res, user.id);

  res.status(201).json({
    message: "Đăng ký tài khoản thành công",
    token,
    user: sanitizeUser(user)
  });
}));

authRouter.post("/login", asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Dữ liệu đăng nhập không hợp lệ",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user || user.deletedAt || !user.isActive) {
    res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const token = createAccessToken(user);
  await issueRefreshSession(req, res, user.id);

  res.json({
    message: "Đăng nhập thành công",
    token,
    user: sanitizeUser(user)
  });
}));

authRouter.post("/refresh", asyncRoute(async (req, res) => {
  const refreshToken = getRefreshTokenFromRequest(req);

  if (!refreshToken) {
    clearRefreshTokenCookie(res);
    res.status(401).json({ message: "Phiên đăng nhập đã hết hạn" });
    return;
  }

  try {
  const session = await prisma.authSession.findFirst({
    where: {
      expiresAt: { gt: new Date() },
      refreshTokenHash: hashRefreshToken(refreshToken),
      revokedAt: null
    },
    include: { user: true }
  });

  if (!session || !session.user || session.user.deletedAt || !session.user.isActive) {
    clearRefreshTokenCookie(res);
    res.status(401).json({ message: "Phiên đăng nhập đã hết hạn" });
    return;
  }

  const nextRefreshToken = createRefreshToken();
  const nextExpiresAt = getRefreshTokenExpiresAt();

  await prisma.authSession.update({
    where: { id: session.id },
    data: {
      expiresAt: nextExpiresAt,
      refreshTokenHash: hashRefreshToken(nextRefreshToken)
    }
  });

  setRefreshTokenCookie(res, nextRefreshToken, nextExpiresAt);

  res.json({
    message: "Làm mới phiên đăng nhập thành công",
    token: createAccessToken(session.user),
    user: sanitizeUser(session.user)
  });
  } catch (error) {
    if (getErrorCode(error) === "P1001") {
      res.status(503).json({ message: "Khong ket noi duoc co so du lieu. Vui long thu lai sau." });
      return;
    }

    throw error;
  }
}));

authRouter.post("/logout", asyncRoute(async (req, res) => {
  const refreshToken = getRefreshTokenFromRequest(req);

  if (refreshToken) {
    await prisma.authSession.updateMany({
      where: {
        refreshTokenHash: hashRefreshToken(refreshToken),
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
  }

  clearRefreshTokenCookie(res);
  res.json({ message: "Đăng xuất thành công" });
}));

authRouter.get("/me", asyncRoute(async (req, res) => {
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

    res.json({ user: sanitizeUser(user) });
  } catch {
    res.status(401).json({ message: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ" });
  }
}));
