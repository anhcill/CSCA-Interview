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
  passwordHashNeedsRefresh,
  passwordHashRounds,
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

  const passwordHash = await bcrypt.hash(password, passwordHashRounds);
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

  if (!user.passwordHash) {
    res.status(400).json({ message: "Tài khoản này được đăng ký bằng Google. Vui lòng sử dụng Đăng nhập bằng Google." });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    return;
  }

  const shouldRefreshPasswordHash = passwordHashNeedsRefresh(user.passwordHash);

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

  if (shouldRefreshPasswordHash) {
    void bcrypt.hash(password, passwordHashRounds)
      .then((passwordHash) => prisma.user.update({ where: { id: user.id }, data: { passwordHash } }))
      .catch(() => undefined);
  }
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

const getGoogleRedirectUri = (req: Request) => {
  const host = req.get("host");
  const protocol = env.isProd ? "https" : req.protocol;
  return `${protocol}://${host}/api/auth/google/callback`;
};

authRouter.get("/google", (req, res) => {
  const clientId = env.googleClientId;
  if (!clientId || clientId === "placeholder_google_client_id") {
    res.status(500).json({ message: "Google Client ID chưa được cấu hình trên Server." });
    return;
  }
  const redirectUri = getGoogleRedirectUri(req);
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&prompt=select_account`;
  res.redirect(authUrl);
});

authRouter.get("/google/callback", asyncRoute(async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error("Google Auth Error query:", error);
    res.redirect(`${env.frontendUrl}/login?error=${encodeURIComponent(String(error))}`);
    return;
  }

  if (!code || typeof code !== "string") {
    res.redirect(`${env.frontendUrl}/login?error=auth_code_missing`);
    return;
  }

  const clientId = env.googleClientId;
  const clientSecret = env.googleClientSecret;
  const redirectUri = getGoogleRedirectUri(req);

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId || "",
        client_secret: clientSecret || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Lỗi trao đổi token với Google:", errorText);
      res.redirect(`${env.frontendUrl}/login?error=token_exchange_failed`);
      return;
    }

    const tokens = await tokenRes.json() as { access_token: string };

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error("Lỗi lấy thông tin người dùng từ Google:", errorText);
      res.redirect(`${env.frontendUrl}/login?error=user_info_failed`);
      return;
    }

    const googleUser = await userRes.json() as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };

    const { sub, email, name, picture } = googleUser;

    if (!email) {
      res.redirect(`${env.frontendUrl}/login?error=email_not_provided`);
      return;
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: sub },
          { email: email.toLowerCase() }
        ]
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: name || email.split("@")[0] || "Google User",
          email: email.toLowerCase(),
          googleId: sub,
          avatarUrl: picture || null,
          passwordHash: null,
          role: "USER",
          emailVerifiedAt: new Date(),
          isActive: true
        }
      });
    } else {
      const updateData: any = {};
      if (!user.googleId) {
        updateData.googleId = sub;
      }
      if (!user.avatarUrl && picture) {
        updateData.avatarUrl = picture;
      }
      if (!user.emailVerifiedAt) {
        updateData.emailVerifiedAt = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });
      }
    }

    if (user.deletedAt || !user.isActive) {
      res.redirect(`${env.frontendUrl}/login?error=account_disabled`);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = createAccessToken(user);
    await issueRefreshSession(req, res, user.id);

    res.redirect(`${env.frontendUrl}/login/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("Lỗi xác thực Google OAuth2:", err);
    res.redirect(`${env.frontendUrl}/login?error=server_error`);
  }
}));
