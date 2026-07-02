import type { NextFunction, Request, Response } from "express";
import path from "node:path";

/** Allowed file extensions for static uploads */
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",  // images
  ".mp3", ".wav", ".ogg", ".webm", ".m4a",           // audio
  ".pdf", ".doc", ".docx",                            // documents
]);

/** Block requests for files with disallowed extensions under /uploads */
export function uploadSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  const ext = path.extname(req.path).toLowerCase();

  // No extension = directory listing attempt → block
  if (!ext) {
    res.status(403).json({ message: "Truy cập thư mục không được phép." });
    return;
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    res.status(403).json({ message: `Loại file không được phép: ${ext}` });
    return;
  }

  // Prevent path traversal
  if (req.path.includes("..")) {
    res.status(400).json({ message: "Đường dẫn không hợp lệ." });
    return;
  }

  // Set security headers — no sniffing, no inline execution
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");

  next();
}
