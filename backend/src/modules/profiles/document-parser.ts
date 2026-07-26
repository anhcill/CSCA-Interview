import { v2 as cloudinary } from "cloudinary";
import { ai_task_type } from "@prisma/client";
import pdf, { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";
import { env } from "../../config/env.js";
import { resolveAiModelRoute, type AiProviderId } from "../ai/ai-model-router.service.js";

export type SupportedDocumentType = "pdf" | "docx" | "txt" | "image";
export type StudyPlanParseStatus = "success" | "warning" | "failed";
export type StudyPlanOcrProvider = AiProviderId;

export type StudyPlanParseMetadata = {
  extractedTextLength: number;
  fileName: string | null;
  fileType?: SupportedDocumentType;
  originalTextLength?: number;
  ocrModel?: string;
  ocrPageCount?: number;
  ocrProvider?: StudyPlanOcrProvider;
  ocrUsed?: boolean;
  pageCount?: number;
  parseStatus: StudyPlanParseStatus;
  truncated?: boolean;
  warnings: string[];
};

export type CleanedStudyPlanText = {
  cleanedLength: number;
  originalLength: number;
  text: string;
  truncated: boolean;
};

export type DocumentExtractionResult = {
  metadata: StudyPlanParseMetadata;
  text: string;
};

export const minimumStudyPlanTextLength = 10;
export const minimumUsefulStudyPlanTextLength = 120;
export const maxStudyPlanAnalysisCharacters = 30_000;

const textTruncatedWarning = "Nội dung Study Plan quá dài nên hệ thống đã cắt bớt phần cuối trước khi gửi AI phân tích.";
const maxOcrPdfPages = Math.max(1, Math.min(10, Number(process.env.OPENAI_OCR_MAX_PDF_PAGES) || 4));

if (env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret
  });
}

export async function uploadToCloudinary(fileBuffer: Buffer, fileName: string): Promise<string> {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new Error("Cấu hình Cloudinary chưa đầy đủ trên server");
  }

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

export function stripBase64DataUrl(fileContent: string) {
  return fileContent.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
}

export function decodeBase64DocumentPayload(fileContent: string) {
  const base64Data = stripBase64DataUrl(fileContent);

  if (!base64Data) {
    throw new Error("Nội dung file upload không hợp lệ.");
  }

  return Buffer.from(base64Data, "base64");
}

export function cleanStudyPlanText(
  rawText: string,
  maxLength = maxStudyPlanAnalysisCharacters
): CleanedStudyPlanText {
  const originalLength = rawText.length;
  const normalized = rawText
    .replace(/^\uFEFF/, "")
    .split("\u0000").join("")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[^\S\n]+/g, " ");

  const text = normalized
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length <= maxLength) {
    return {
      cleanedLength: text.length,
      originalLength,
      text,
      truncated: false
    };
  }

  const clipped = text.slice(0, maxLength);
  const paragraphBreak = clipped.lastIndexOf("\n\n");
  const splitAt = paragraphBreak > maxLength * 0.7 ? paragraphBreak : clipped.length;
  const truncatedText = `${clipped.slice(0, splitAt).trimEnd()}\n\n[Study Plan truncated before AI analysis]`;

  return {
    cleanedLength: truncatedText.length,
    originalLength,
    text: truncatedText,
    truncated: true
  };
}

export function createStudyPlanParseMetadata(input: {
  fileName?: string | null;
  fileType?: SupportedDocumentType;
  ocrModel?: string;
  ocrPageCount?: number;
  ocrProvider?: StudyPlanOcrProvider;
  ocrUsed?: boolean;
  originalTextLength?: number;
  pageCount?: number;
  text: string;
  truncated?: boolean;
  warnings?: string[];
}): StudyPlanParseMetadata {
  const warnings = dedupeWarnings(input.warnings ?? []);
  const extractedTextLength = input.text.trim().length;

  if (input.truncated) {
    warnings.push(textTruncatedWarning);
  }

  if (extractedTextLength < minimumStudyPlanTextLength) {
    warnings.push("Không trích xuất được đủ nội dung từ file Study Plan. Nếu đây là PDF scan/ảnh, vui lòng OCR hoặc upload bản có lớp text.");
  } else if (extractedTextLength < minimumUsefulStudyPlanTextLength) {
    warnings.push("Nội dung trích xuất khá ngắn, AI có thể phân tích thiếu chính xác. Nếu file là PDF scan/ảnh, vui lòng OCR hoặc upload DOCX/TXT.");
  }

  return {
    extractedTextLength,
    fileName: input.fileName ?? null,
    fileType: input.fileType,
    ocrModel: input.ocrModel,
    ocrPageCount: input.ocrPageCount,
    ocrProvider: input.ocrProvider,
    ocrUsed: input.ocrUsed || undefined,
    originalTextLength: input.originalTextLength,
    pageCount: input.pageCount,
    parseStatus: extractedTextLength < minimumStudyPlanTextLength ? "failed" : warnings.length ? "warning" : "success",
    truncated: input.truncated || undefined,
    warnings: dedupeWarnings(warnings)
  };
}

export async function extractTextFromDocument(
  buffer: Buffer,
  fileName: string
): Promise<DocumentExtractionResult> {
  const fileType = getSupportedDocumentType(fileName);
  const warnings: string[] = [];
  let rawText = "";
  let ocrPageCount: number | undefined;
  let ocrModel: string | undefined;
  let ocrProvider: StudyPlanOcrProvider | undefined;
  let ocrUsed = false;
  let pageCount: number | undefined;

  if (fileType === "pdf") {
    const data = await (pdf as any)(buffer);
    rawText = typeof data?.text === "string" ? data.text : "";
    pageCount = typeof data?.numpages === "number" ? data.numpages : undefined;

    if (pageCount && rawText.trim().length < minimumUsefulStudyPlanTextLength) {
      const ocrResult = await extractTextFromPdfScreenshots(buffer);
      if (ocrResult.text.trim().length > rawText.trim().length) {
        rawText = ocrResult.text;
        ocrPageCount = ocrResult.pageCount;
        ocrModel = ocrResult.model;
        ocrProvider = ocrResult.provider;
        ocrUsed = true;
        warnings.push(`PDF có ít text gốc nên hệ thống đã OCR ${ocrResult.pageCount} trang đầu bằng ${formatOcrProvider(ocrResult.provider)}.`);
      } else {
        warnings.push(ocrResult.warning ?? "PDF có rất ít text đọc được. File có thể là bản scan/ảnh hoặc bị khóa text; OCR chưa đọc được nội dung rõ ràng.");
      }
    }
  }

  if (fileType === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value || "";
    const parserWarnings = result.messages
      ?.map((message) => message.message)
      .filter(Boolean)
      .slice(0, 3);

    if (parserWarnings?.length) {
      warnings.push(`DOCX parser cảnh báo: ${parserWarnings.join("; ")}`);
    }
  }

  if (fileType === "txt") {
    rawText = buffer.toString("utf-8");

    if (countReplacementCharacters(rawText) > Math.max(3, rawText.length * 0.01)) {
      warnings.push("File TXT có thể không dùng UTF-8 nên một số ký tự có thể bị lỗi. Vui lòng lưu lại file ở UTF-8 nếu nội dung hiển thị sai.");
    }
  }

  if (fileType === "image") {
    const ocrResult = await extractTextFromImages([toImageDataUrl(buffer, fileName)]);
    rawText = ocrResult.text;
    if (ocrResult.text.trim()) {
      ocrPageCount = 1;
      ocrModel = ocrResult.model;
      ocrProvider = ocrResult.provider;
      ocrUsed = true;
      warnings.push(`File ảnh Study Plan đã được OCR bằng ${formatOcrProvider(ocrResult.provider)} trước khi gửi AI phân tích.`);
    } else {
      warnings.push(ocrResult.warning ?? "Không OCR được nội dung từ ảnh Study Plan. Vui lòng upload ảnh rõ hơn hoặc file PDF/DOCX/TXT có text.");
    }
  }

  const cleaned = cleanStudyPlanText(rawText);
  const metadata = createStudyPlanParseMetadata({
    fileName,
    fileType,
    ocrModel,
    ocrPageCount,
    ocrProvider: ocrUsed ? ocrProvider : undefined,
    ocrUsed,
    originalTextLength: cleaned.originalLength,
    pageCount,
    text: cleaned.text,
    truncated: cleaned.truncated,
    warnings
  });

  return {
    metadata,
    text: cleaned.text
  };
}

export async function extractTextFromImageDocuments(
  files: Array<{ buffer: Buffer; fileName: string }>
): Promise<DocumentExtractionResult> {
  if (!files.length) {
    throw new Error("Chưa có ảnh Study Plan để OCR.");
  }

  const ocrResult = await extractTextFromImages(
    files.map((file) => toImageDataUrl(file.buffer, file.fileName))
  );
  const cleaned = cleanStudyPlanText(ocrResult.text);
  const metadata = createStudyPlanParseMetadata({
    fileName: files.length === 1 ? files[0]?.fileName : `${files.length} ảnh Study Plan`,
    fileType: "image",
    ocrModel: ocrResult.model,
    ocrPageCount: ocrResult.text.trim() ? files.length : 0,
    ocrProvider: ocrResult.provider,
    ocrUsed: Boolean(ocrResult.provider && ocrResult.text.trim()),
    originalTextLength: cleaned.originalLength,
    pageCount: files.length,
    text: cleaned.text,
    truncated: cleaned.truncated,
    warnings: ocrResult.text.trim()
      ? [`Đã OCR ${files.length} ảnh Study Plan bằng ${formatOcrProvider(ocrResult.provider)}.`]
      : [ocrResult.warning ?? "Không OCR được nội dung từ các ảnh Study Plan."]
  });

  return { metadata, text: cleaned.text };
}

function getSupportedDocumentType(fileName: string): SupportedDocumentType {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "pdf" || extension === "docx" || extension === "txt") {
    return extension;
  }

  if (extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp") {
    return "image";
  }

  throw new Error("Định dạng tệp không được hỗ trợ. Vui lòng tải lên file PDF, DOCX, TXT hoặc ảnh PNG/JPG/WEBP.");
}

async function extractTextFromPdfScreenshots(buffer: Buffer): Promise<{ model?: string; pageCount: number; provider?: StudyPlanOcrProvider; text: string; warning?: string }> {
  const config = await getOcrConfig();
  if (!config) {
    return {
      pageCount: 0,
      text: "",
      warning: "PDF có rất ít text đọc được nhưng chưa cấu hình model AI cho tác vụ phân tích Study Plan."
    };
  }

  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const screenshots = await parser.getScreenshot({
      desiredWidth: 1400,
      first: maxOcrPdfPages,
      imageBuffer: true,
      imageDataUrl: true
    } as any);
    const imageDataUrls = screenshots.pages
      .map((page) => page.dataUrl || `data:image/png;base64,${Buffer.from(page.data).toString("base64")}`)
      .filter(Boolean);

    if (!imageDataUrls.length) {
      return { pageCount: 0, text: "", warning: "Không render được trang PDF để OCR." };
    }

    const text = await extractTextWithVision(config, imageDataUrls);
    return { model: config.model, pageCount: imageDataUrls.length, provider: config.provider, text };
  } catch (error) {
    return {
      pageCount: 0,
      text: "",
      warning: `Không thể OCR PDF scan: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

async function extractTextFromImages(imageDataUrls: string[]): Promise<{ model?: string; provider?: StudyPlanOcrProvider; text: string; warning?: string }> {
  const config = await getOcrConfig();
  if (!config) {
    return {
      text: "",
      warning: "Chưa cấu hình model AI cho tác vụ phân tích Study Plan."
    };
  }

  try {
    return { model: config.model, provider: config.provider, text: await extractTextWithVision(config, imageDataUrls) };
  } catch (error) {
    return {
      text: "",
      warning: `Không thể OCR ảnh Study Plan: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function extractTextWithVision(
  config: { client: OpenAI; model: string; provider: StudyPlanOcrProvider },
  imageDataUrls: string[]
) {
  const response = await config.client.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are an OCR engine. Extract visible text exactly and return plain text only."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Trích xuất toàn bộ chữ nhìn thấy trong Study Plan.",
              "Giữ đúng thứ tự đọc theo từng trang, giữ tiếng Việt/Anh/Trung nếu có.",
              "Không nhận xét, không tóm tắt, không thêm nội dung ngoài văn bản trong ảnh.",
              "Nếu một trang không đọc được thì bỏ qua trang đó."
            ].join("\n")
          },
          ...imageDataUrls.map((url) => ({
            type: "image_url",
            image_url: { detail: "high", url }
          }))
        ] as any
      }
    ],
    model: config.model,
    temperature: 0
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

async function getOcrConfig() {
  const route = await resolveAiModelRoute({
    agentKey: "study_plan_analyzer",
    operation: "extractStudyPlanText",
    taskType: ai_task_type.ANALYZE_STUDY_PLAN
  });
  if (!route.client || !route.model || route.provider === "fallback") return null;

  return {
    client: route.client,
    model: route.model,
    provider: route.provider
  };
}

function formatOcrProvider(provider?: StudyPlanOcrProvider) {
  if (provider === "9router") return "9Router";
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "deepseek") return "DeepSeek";
  return "OpenAI";
}

function toImageDataUrl(buffer: Buffer, fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const mimeType = extension === "jpg" || extension === "jpeg"
    ? "image/jpeg"
    : extension === "webp"
      ? "image/webp"
      : "image/png";

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function countReplacementCharacters(value: string) {
  return (value.match(/\uFFFD/g) ?? []).length;
}

function dedupeWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.map((warning) => warning.trim()).filter(Boolean)));
}
