import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.isProd ? "info" : "debug",
  transport:
    !env.isProd
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname,service",
            levelFirst: true,
            singleLine: true,
            translateTime: "HH:MM:ss.l"
          }
        }
      : undefined,
  formatters: {
    level(label) {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: "ai-phongvan-backend" }
});
