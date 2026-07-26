import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import helmet from "helmet";
import { createHash } from "node:crypto";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { WebSocketServer, type WebSocket } from "ws";
import { errorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { uploadSecurityMiddleware } from "./middleware/upload-security.js";
import { logger } from "./config/logger.js";
import { clearMemoryCache, getCachedJson, getCacheStatus, setCachedJson } from "./cache/cache.service.js";
import { prisma } from "./db/prisma.js";
import { env } from "./config/env.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { interviewsRouter } from "./modules/interviews/interviews.routes.js";
import { profilesRouter } from "./modules/profiles/profiles.routes.js";
import { majorsRouter } from "./modules/majors/majors.routes.js";
import { questionsRouter } from "./modules/questions/questions.routes.js";
import { scholarshipsRouter } from "./modules/scholarships/scholarships.routes.js";
import { schoolsRouter } from "./modules/schools/schools.routes.js";
import { speechRouter } from "./modules/speech/speech.routes.js";
import { gamificationRouter } from "./modules/gamification/gamification.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";
import { siteExperienceRouter } from "./modules/site-experience/site-experience.routes.js";
import { wsInterviewHandler } from "./modules/realtime/ws-interview.handler.js";

const app = express();
app.set("trust proxy", env.isProd ? 1 : false);

const startedAt = new Date();
const realtimeState = {
  websocketClients: 0,
  websocketReady: false
};

type HealthState = "ok" | "error" | "not_configured" | "fallback" | "enabled";
type AsyncLayer = {
  handle: RequestHandler & { __asyncWrapped?: true };
  route?: {
    stack: AsyncLayer[];
  };
};
type RouterWithStack = RequestHandler & { stack?: AsyncLayer[] };

function wrapAsyncLayer(layer: AsyncLayer) {
  const original = layer.handle;
  if (original.length > 3 || original.__asyncWrapped) return;

  const wrapped: RequestHandler & { __asyncWrapped?: true } = (req, res, next) => {
    try {
      const result = original(req, res, next) as unknown;
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        void (result as Promise<unknown>).catch(next);
      }
    } catch (error) {
      next(error);
    }
  };

  wrapped.__asyncWrapped = true;
  layer.handle = wrapped;
}

function wrapAsyncRouter<T extends RouterWithStack>(router: T): T {
  router.stack?.forEach((layer) => {
    if (layer.route?.stack) {
      layer.route.stack.forEach(wrapAsyncLayer);
      return;
    }

    wrapAsyncLayer(layer);
  });

  return router;
}

async function checkDatabaseStatus(): Promise<"ok" | "error"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch (_error) {
    return "error";
  }
}

async function collectHealthStatus() {
  const memory = process.memoryUsage();
  const db = await checkDatabaseStatus();
  const ai: HealthState = env.openAiApiKey ? "ok" : "fallback";
  const cache = getCacheStatus();
  const websocket: HealthState = realtimeState.websocketReady ? "ok" : "not_configured";
  const sse: HealthState = "ok";

  return {
    ai: {
      model: env.openAiApiKey ? env.openAiModel : null,
      reason: env.openAiApiKey
        ? null
        : "OPENAI_API_KEY missing; interview text uses deterministic fallback.",
      status: ai,
      mode: env.openAiApiKey ? "openai" : "fallback"
    },
    cache: {
      entries: cache.entries,
      redis: cache.redis,
      status: cache.status
    },
    database: {
      provider: "postgresql",
      status: db,
      urlConfigured: Boolean(env.databaseUrl)
    },
    memory: {
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      rssMb: Math.round(memory.rss / 1024 / 1024)
    },
    realtime: {
      sse: {
        endpoint: "/api/realtime/stream",
        status: sse
      },
      websocket: {
        clients: realtimeState.websocketClients,
        endpoint: "/ws/realtime",
        status: websocket,
        note: websocket === "ok" ? "WebSocket server ready." : "WebSocket server chưa cấu hình."
      }
    },
    security: {
      compression: "enabled" as HealthState,
      cors: "enabled" as HealthState,
      helmet: "enabled" as HealthState,
      rateLimit: "enabled" as HealthState
    },
    service: "ai-phongvan-backend",
    startedAt: startedAt.toISOString(),
    status: db === "ok" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime())
  };
}

async function logStartupStatus() {
  const health = await collectHealthStatus();
  const baseUrl = `http://localhost:${env.port}`;

  logger.info({ url: baseUrl, health: baseUrl + "/health" }, "Startup: %s", health.service);
  logger.info({ db: health.database.status, ai: health.ai.mode, cache: health.cache.status, memory: health.memory }, "Status");

  if (health.database.status !== "ok") {
    logger.warn("Database check failed — degraded mode");
  }
  if (health.ai.status === "fallback") {
    logger.warn("OPENAI_API_KEY missing — fallback mode");
  }
}

function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info({ method: req.method, url: req.originalUrl, status: res.statusCode, ms: Date.now() - startedAt, reqId: req.requestId }, "HTTP");
  });
  next();
}


function cachePublic(ttlMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    if (req.headers.authorization) return next();
    if (shouldBypassCache(req)) {
      res.setHeader("Cache-Control", "no-store");
      return next();
    }
    const key = req.originalUrl;
    try {
      const cached = await getCachedJson(key);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Cache-Control", `public, max-age=${Math.floor(ttlMs / 1000)}, stale-while-revalidate=${Math.floor(ttlMs / 500)}`);
        res.json(cached);
        return;
      }
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : error }, "Cache read failed");
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void setCachedJson(key, body, ttlMs).catch((error) => {
          logger.warn({ err: error instanceof Error ? error.message : error }, "Cache write failed");
        });
      }
      res.setHeader("Cache-Control", `public, max-age=${Math.floor(ttlMs / 1000)}, stale-while-revalidate=${Math.floor(ttlMs / 500)}`);
      res.setHeader("X-Cache", "MISS");
      return originalJson(body);
    };
    next();
  };
}

function cachePrivate(ttlMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
    if (shouldBypassCache(req)) {
      res.setHeader("Cache-Control", "no-store");
      return next();
    }

    const authHash = req.headers.authorization
      ? createHash("sha256").update(req.headers.authorization).digest("hex").slice(0, 18)
      : "anon";
    const key = `private:${authHash}:${req.originalUrl}`;

    try {
      const cached = await getCachedJson(key);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Cache-Control", `private, max-age=${Math.floor(ttlMs / 1000)}, stale-while-revalidate=${Math.floor(ttlMs / 500)}`);
        res.json(cached);
        return;
      }
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : error }, "Private cache read failed");
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void setCachedJson(key, body, ttlMs).catch((error) => {
          logger.warn({ err: error instanceof Error ? error.message : error }, "Private cache write failed");
        });
      }
      res.setHeader("Cache-Control", `private, max-age=${Math.floor(ttlMs / 1000)}, stale-while-revalidate=${Math.floor(ttlMs / 500)}`);
      res.setHeader("X-Cache", "MISS");
      return originalJson(body);
    };
    next();
  };
}

function shouldBypassCache(req: Request) {
  const cacheControl = String(req.headers["cache-control"] ?? "").toLowerCase();
  const pragma = String(req.headers.pragma ?? "").toLowerCase();
  return cacheControl.includes("no-cache") || cacheControl.includes("no-store") || pragma.includes("no-cache");
}

function clearCacheOnMutation(req: Request, _res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    clearMemoryCache();
  }
  next();
}

// --- Security ---
app.use(helmet());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || env.frontendUrls.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`));
  }
}));
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(compression({ filter: (req, res) => {
  if (String(res.getHeader("Content-Type") ?? "").includes("text/event-stream")) return false;
  return compression.filter(req, res);
}}) as unknown as RequestHandler);
app.use(express.json({ limit: env.requestBodyLimit }));
app.use(cookieParser() as unknown as RequestHandler);
app.use("/uploads", uploadSecurityMiddleware, express.static(path.join(process.cwd(), "uploads")));
app.use(clearCacheOnMutation);

// Global rate limit: 100 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Quá nhiều yêu cầu, vui lòng thử lại sau." }
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(globalLimiter as any);

// Auth rate limit: 10 req/min per IP (login/register brute-force protection)
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Quá nhiều lần thử đăng nhập, vui lòng đợi 1 phút." }
});

// Speech rate limit: 5 req/min per IP (audio endpoints cost more)
const speechLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Quá nhiều yêu cầu xử lý giọng nói, vui lòng đợi 1 phút." }
});

// --- Health ---
app.get("/health", async (_req, res) => {
  const health = await collectHealthStatus();
  res.status(health.status === "ok" ? 200 : 503).json(health);
});

app.get("/api/realtime/stream", (req, res) => {
  const message = String(req.query.message ?? "AI đang chuẩn bị phản hồi realtime cho buổi phỏng vấn.");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const words = message.split(/\s+/).filter(Boolean);
  let index = 0;
  const timer = setInterval(() => {
    if (index >= words.length) {
      res.write(`event: done\ndata: ${JSON.stringify({ done: true })}\n\n`);
      clearInterval(timer);
      res.end();
      return;
    }
    res.write(`event: token\ndata: ${JSON.stringify({ token: `${words[index]} ` })}\n\n`);
    index += 1;
  }, 80);

  req.on("close", () => clearInterval(timer));
});

// --- Routes ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use("/api/auth", authLimiter as any, cachePrivate(30_000) as any, wrapAsyncRouter(authRouter));
app.use("/api/admin", cachePrivate(30_000) as any, wrapAsyncRouter(adminRouter));
app.use("/api/profiles", cachePrivate(30_000) as any, wrapAsyncRouter(profilesRouter));
app.use("/api/questions", cachePrivate(30_000) as any, wrapAsyncRouter(questionsRouter));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use("/api/schools", cachePublic(5 * 60_000) as any, cachePrivate(30_000) as any, wrapAsyncRouter(schoolsRouter));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use("/api/majors", cachePublic(5 * 60_000) as any, cachePrivate(30_000) as any, wrapAsyncRouter(majorsRouter));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use("/api/scholarships", cachePublic(5 * 60_000) as any, cachePrivate(30_000) as any, wrapAsyncRouter(scholarshipsRouter));
app.use("/api/gamification", wrapAsyncRouter(gamificationRouter));
app.use("/api/interviews", cachePrivate(30_000) as any, wrapAsyncRouter(interviewsRouter));
app.use("/api/notifications", wrapAsyncRouter(notificationsRouter));
app.use("/api/payments", wrapAsyncRouter(paymentsRouter));
app.use("/api/site-experience", cachePrivate(15_000) as any, wrapAsyncRouter(siteExperienceRouter));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use("/api/speech", speechLimiter as any, wrapAsyncRouter(speechRouter));

// --- 404 ---
app.use((_req, res) => {
  res.status(404).json({ message: "Route không tồn tại" });
});

// --- Global error handler ---
app.use(errorHandler as any);

const server = app.listen(env.port, () => {
  void logStartupStatus();
  logger.info("Backend running at http://localhost:%d", env.port);
});

const wss = new WebSocketServer({ path: "/ws/realtime", server });
realtimeState.websocketReady = true;

wss.on("connection", (socket, req) => {
  realtimeState.websocketClients += 1;

  socket.on("close", () => {
    realtimeState.websocketClients = Math.max(0, realtimeState.websocketClients - 1);
  });

  void wsInterviewHandler(socket, req);
});

server.on("error", (error) => {
  logger.fatal({ err: error }, "Server failed to start");
});

// --- Graceful shutdown ---
function gracefulShutdown(signal: string) {
  logger.info("Shutdown: %s received", signal);
  wss.clients.forEach((ws) => {
    ws.close(1001, "Server shutting down");
  });
  server.close(async () => {
    logger.info("HTTP server closed");
    await prisma.$disconnect();
    logger.info("Database disconnected. Bye.");
    process.exit(0);
  });
  setTimeout(() => {
    logger.fatal("Forced exit after timeout");
    process.exit(1);
  }, 10_000);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
