import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  TooManyRequestsError,
  DatabaseError,
  ValidationError
} from "./errors.js";

describe("Error Classes", () => {
  it("should create AppError with default status 500", () => {
    const err = new AppError("Something went wrong");
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe("AppError");
  });

  it("should create NotFoundError with status 404", () => {
    const err = new NotFoundError("Custom not found message");
    expect(err.message).toBe("Custom not found message");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.name).toBe("NotFoundError");
  });

  it("should create BadRequestError with status 400", () => {
    const err = new BadRequestError();
    expect(err.message).toBe("Dữ liệu không hợp lệ");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
  });

  it("should create UnauthorizedError with status 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("should create ForbiddenError with status 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("should create ConflictError with status 409", () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("should create TooManyRequestsError with status 429", () => {
    const err = new TooManyRequestsError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("TOO_MANY_REQUESTS");
  });

  it("should create DatabaseError with status 503", () => {
    const err = new DatabaseError();
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe("DATABASE_ERROR");
  });

  it("should create ValidationError with fieldErrors", () => {
    const fieldErrors = { email: ["Invalid email format"] };
    const err = new ValidationError("Validation failed", fieldErrors);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.fieldErrors).toEqual(fieldErrors);
  });
});
