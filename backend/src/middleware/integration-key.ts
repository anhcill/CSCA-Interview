import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export function requireIntegrationKey(req: Request, res: Response, next: NextFunction) {
  const expected = (process.env.INTEGRATION_API_KEY ?? "").trim();
  const provided = String(req.header("x-integration-key") ?? "").trim();

  if (!expected) {
    res.status(503).json({
      success: false,
      code: "INTEGRATION_NOT_CONFIGURED",
      message: "Integration endpoint is not configured."
    });
    return;
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  const valid = expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);

  if (!valid) {
    res.status(401).json({
      success: false,
      code: "INVALID_INTEGRATION_KEY",
      message: "Integration key is invalid."
    });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  next();
}
