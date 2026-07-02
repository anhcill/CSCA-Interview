import type { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../utils/errors.js";
import { ZodError } from "zod";

/**
 * Unified error handler middleware.
 * Place LAST in Express middleware chain.
 *
 * Handles:
 * - AppError subclasses → structured JSON with statusCode
 * - ZodError → 400 with field errors
 * - Unknown errors → 500 generic
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Already sent headers — let Express default handler close connection
  if (res.headersSent) return;

  // Custom AppError hierarchy
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      errors: err.fieldErrors ?? {}
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message
    });
    return;
  }

  // Zod validation errors (from middleware or direct throw)
  if (err instanceof ZodError) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Dữ liệu không hợp lệ",
      errors: err.flatten().fieldErrors
    });
    return;
  }

  // Prisma known request errors
  if (err.constructor?.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as Error & { code?: string };
    if (prismaErr.code === "P2002") {
      res.status(409).json({ code: "CONFLICT", message: "Dữ liệu đã tồn tại" });
      return;
    }
    if (prismaErr.code === "P2025") {
      res.status(404).json({ code: "NOT_FOUND", message: "Không tìm thấy bản ghi" });
      return;
    }
  }

  // Unknown errors — log full stack, return generic message
  console.error("[ERROR]", err);
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: process.env.NODE_ENV === "production"
      ? "Đã xảy ra lỗi nội bộ"
      : err.message
  });
}
