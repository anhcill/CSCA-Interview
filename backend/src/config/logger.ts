import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.isProd ? "info" : "debug",
  transport:
    !env.isProd
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
  formatters: {
    level(label) {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: "ai-phongvan-backend" }
});
