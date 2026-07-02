/**
 * Custom error classes for consistent error handling across the app.
 */

export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Không tìm thấy tài nguyên") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Dữ liệu không hợp lệ") {
    super(message, 400, "BAD_REQUEST");
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Chưa xác thực") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Không có quyền truy cập") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Xung đột dữ liệu") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Quá nhiều yêu cầu, vui lòng thử lại sau") {
    super(message, 429, "TOO_MANY_REQUESTS");
    this.name = "TooManyRequestsError";
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Lỗi kết nối cơ sở dữ liệu") {
    super(message, 503, "DATABASE_ERROR");
    this.name = "DatabaseError";
  }
}

export class ValidationError extends AppError {
  fieldErrors?: Record<string, string[]>;

  constructor(message = "Dữ liệu không hợp lệ", fieldErrors?: Record<string, string[]>) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}
