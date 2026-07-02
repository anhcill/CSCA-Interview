import { v2 as cloudinary } from "cloudinary";
// @ts-ignore
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { env } from "../../config/env.js";

// Cấu hình Cloudinary
if (env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret
  });
}

/**
 * Tải tệp tài liệu lên Cloudinary dưới dạng 'raw'
 */
export async function uploadToCloudinary(fileBuffer: Buffer, fileName: string): Promise<string> {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new Error("Cấu hình Cloudinary chưa đầy đủ trên server");
  }

  // Chuẩn hóa tên file sạch để làm public_id
  const cleanName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 100);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: `study-plans/${Date.now()}_${cleanName}`,
        folder: "study-plans"
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error("Lỗi không xác định khi upload Cloudinary"));
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
}

/**
 * Trích xuất văn bản từ tệp Buffer dựa vào đuôi mở rộng
 */
export async function extractTextFromDocument(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "pdf") {
    const data = await (pdf as any)(buffer);
    return data.text || "";
  }

  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (extension === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error("Định dạng tệp không được hỗ trợ. Vui lòng tải lên file PDF, DOCX hoặc TXT.");
}
