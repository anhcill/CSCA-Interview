import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import helmet from "helmet";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from "ws";
import { createBrotliCompress, createGzip } from "zlib";
import { getCachedJson, getCacheStatus, setCachedJson } from "./cache/cache.service.js";
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

const app = express();

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
        : "OPENAI_API_KEY missing; interview text uses deterministic fallback and server speech endpoints return 503.",
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
        note: websocket === "ok" ? "WebSocket server ready." : "WebSocket server chua cau hinh."
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

  console.log(`[STARTUP] Service: ${health.service}`);
  console.log(`[STARTUP] URL: ${baseUrl}`);
  console.log(`[STARTUP] Health: ${baseUrl}/health`);
  console.log(`[STATUS] Database: ${health.database.status}`);
  console.log(`[STATUS] Realtime SSE: ${health.realtime.sse.status} (${health.realtime.sse.endpoint})`);
  console.log(`[STATUS] WebSocket: ${health.realtime.websocket.status} (${health.realtime.websocket.endpoint})`);
  console.log(`[STATUS] AI: ${health.ai.status} (${health.ai.mode})`);
  console.log(`[STATUS] Cache: ${health.cache.status} redis=${health.cache.redis} (${health.cache.entries} memory entries)`);
  console.log(`[STATUS] Security: helmet/cors/rate-limit/compression enabled`);
  console.log(`[STATUS] Memory: heap ${health.memory.heapUsedMb}MB, rss ${health.memory.rssMb}MB`);

  if (health.database.status !== "ok") {
    console.warn("[STATUS] Database check failed. Server running in degraded mode.");
  }
  if (health.ai.status === "fallback") {
    console.warn("[STATUS] OPENAI_API_KEY missing. Interview text fallback enabled; speech endpoints disabled.");
  }
}

function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
}

function compressionLike(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Vary", "Accept-Encoding");
  next();
}

function responseCompression(req: Request, res: Response, next: NextFunction) {
  const acceptEncoding = String(req.headers["accept-encoding"] ?? "");
  const wantsBrotli = acceptEncoding.includes("br");
  const wantsGzip = acceptEncoding.includes("gzip");

  if ((!wantsBrotli && !wantsGzip) || req.method === "HEAD") {
    next();
    return;
  }

  const encoding: "br" | "gzip" = wantsBrotli ? "br" : "gzip";

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  let compressor: ReturnType<typeof createBrotliCompress> | ReturnType<typeof createGzip> | null = null;

  function startCompression() {
    if (compressor || res.headersSent) return;
    const contentType = String(res.getHeader("Content-Type") ?? "");
    if (contentType.includes("text/event-stream") || res.statusCode < 200 || res.statusCode >= 300) return;

    compressor = encoding === "br" ? createBrotliCompress() : createGzip();
    res.setHeader("Content-Encoding", encoding);
    res.removeHeader("Content-Length");
    compressor.on("data", (chunk) => originalWrite(chunk));
    compressor.on("end", () => originalEnd());
  }

  res.write = ((chunk: unknown, encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
    startCompression();
    if (!compressor) return originalWrite(chunk as never, encodingOrCallback as never, callback as never);
    return compressor.write(chunk as never, encodingOrCallback as never, callback as never);
  }) as typeof res.write;

  res.end = ((chunk?: unknown, encodingOrCallback?: BufferEncoding | (() => void), callback?: () => void) => {
    startCompression();
    if (!compressor) return originalEnd(chunk as never, encodingOrCallback as never, callback as never);
    if (chunk) compressor.end(chunk as never, encodingOrCallback as never, callback as never);
    else compressor.end(callback);
    return res;
  }) as typeof res.end;

  next();
}

function cachePublic(ttlMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();
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
      console.warn("[CACHE] read failed", error instanceof Error ? error.message : error);
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void setCachedJson(key, body, ttlMs).catch((error) => {
          console.warn("[CACHE] write failed", error instanceof Error ? error.message : error);
        });
      }
      res.setHeader("Cache-Control", `public, max-age=${Math.floor(ttlMs / 1000)}, stale-while-revalidate=${Math.floor(ttlMs / 500)}`);
      res.setHeader("X-Cache", "MISS");
      return originalJson(body);
    };
    next();
  };
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
app.use(requestLogger);
app.use(compressionLike);
app.use(responseCompression);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Global rate limit: 100 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Quá nhiều yêu cầu, vui lòng thử lại sau." }
});
app.use(globalLimiter);

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
app.use("/api/auth", authLimiter, wrapAsyncRouter(authRouter));
app.use("/api/admin", wrapAsyncRouter(adminRouter));
app.use("/api/profiles", wrapAsyncRouter(profilesRouter));
app.use("/api/questions", wrapAsyncRouter(questionsRouter));
app.use("/api/schools", cachePublic(5 * 60_000), wrapAsyncRouter(schoolsRouter));
app.use("/api/majors", cachePublic(5 * 60_000), wrapAsyncRouter(majorsRouter));
app.use("/api/scholarships", cachePublic(5 * 60_000), wrapAsyncRouter(scholarshipsRouter));
app.use("/api/gamification", wrapAsyncRouter(gamificationRouter));
app.use("/api/interviews", wrapAsyncRouter(interviewsRouter));
app.use("/api/speech", speechLimiter, wrapAsyncRouter(speechRouter));

// --- 404 ---
app.use((_req, res) => {
  res.status(404).json({ message: "Route không tồn tại" });
});

// --- Global error handler ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[SERVER ERROR]", err);

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== "production";
  const errorCode = typeof err === "object" && err !== null && "code" in err ? String(err.code) : null;
  const statusCode = errorCode === "P1001" ? 503 : 500;
  res.status(statusCode).json({
    message: "Lỗi server nội bộ",
    ...(isDev && { error: err.message })
  });
});

const server = app.listen(env.port, () => {
  void logStartupStatus();
  console.log(`Backend đang chạy tại http://localhost:${env.port}`);
});

const wss = new WebSocketServer({ path: "/ws/realtime", server });
realtimeState.websocketReady = true;

wss.on("connection", (socket) => {
  realtimeState.websocketClients += 1;
  socket.send(JSON.stringify({
    event: "status",
    payload: {
      service: "ai-phongvan-backend",
      status: "ok",
      timestamp: new Date().toISOString()
    }
  }));

  socket.on("message", (message) => {
    socket.send(JSON.stringify({
      event: "echo",
      payload: {
        message: message.toString(),
        timestamp: new Date().toISOString()
      }
    }));
  });

  socket.on("close", () => {
    realtimeState.websocketClients = Math.max(0, realtimeState.websocketClients - 1);
  });
});

server.on("error", (error) => {
  console.error("[STARTUP] Server failed", error);
});
