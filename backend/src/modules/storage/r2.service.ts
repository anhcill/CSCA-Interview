import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";

const r2UrlPrefix = "r2://";
const signedUrlExpiresInSeconds = 60 * 60;

let client: S3Client | null = null;

export type UploadQuestionAudioInput = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  questionId: string;
};

export type UploadStudyPlanInput = {
  buffer: Buffer;
  fileName: string;
  userId: string;
};

type R2Config = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  region: string;
  secretAccessKey: string;
};

export class MissingR2ConfigError extends Error {
  constructor() {
    super("R2 storage chưa được cấu hình đầy đủ.");
    this.name = "MissingR2ConfigError";
  }
}

function getR2Config(): R2Config {
  const endpoint = env.r2Endpoint
    || (env.r2AccountId ? `https://${env.r2AccountId}.r2.cloudflarestorage.com` : "");

  if (!env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2Bucket || !endpoint) {
    throw new MissingR2ConfigError();
  }

  return {
    accessKeyId: env.r2AccessKeyId,
    bucket: env.r2Bucket,
    endpoint,
    region: env.r2Region,
    secretAccessKey: env.r2SecretAccessKey
  };
}

function getR2Client() {
  if (client) return client;

  const config = getR2Config();
  client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    endpoint: config.endpoint,
    forcePathStyle: true,
    region: config.region
  });

  return client;
}

export function isR2StoredUrl(value: string | null | undefined) {
  return Boolean(value?.startsWith(r2UrlPrefix));
}

export function formatR2StoredUrl(bucket: string, key: string) {
  return `${r2UrlPrefix}${bucket}/${key}`;
}

function parseR2StoredUrl(value: string) {
  if (!isR2StoredUrl(value)) return null;

  const withoutPrefix = value.slice(r2UrlPrefix.length);
  const slashIndex = withoutPrefix.indexOf("/");
  if (slashIndex <= 0) return null;

  return {
    bucket: withoutPrefix.slice(0, slashIndex),
    key: withoutPrefix.slice(slashIndex + 1)
  };
}

function encodeObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export async function uploadQuestionAudioToR2(input: UploadQuestionAudioInput) {
  const config = getR2Config();
  const objectKey = `question-audios/${input.questionId}/${randomUUID()}${input.extension}`;

  await getR2Client().send(new PutObjectCommand({
    Body: input.buffer,
    Bucket: config.bucket,
    CacheControl: "public, max-age=31536000, immutable",
    ContentType: input.contentType,
    Key: objectKey
  }));

  return formatR2StoredUrl(config.bucket, objectKey);
}

export function getStudyPlanContentType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "txt") return "text/plain; charset=utf-8";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";

  return "application/octet-stream";
}

export async function uploadStudyPlanToR2(input: UploadStudyPlanInput) {
  const config = getR2Config();
  const objectKey = `study-plans/${input.userId}/${Date.now()}_${randomUUID()}_${sanitizeObjectFileName(input.fileName)}`;

  await getR2Client().send(new PutObjectCommand({
    Body: input.buffer,
    Bucket: config.bucket,
    ContentDisposition: `attachment; filename="${sanitizeHeaderFileName(input.fileName)}"`,
    ContentType: getStudyPlanContentType(input.fileName),
    Key: objectKey
  }));

  return formatR2StoredUrl(config.bucket, objectKey);
}

export async function getR2ObjectBuffer(fileUrl: string) {
  const parsed = parseR2StoredUrl(fileUrl);

  if (!parsed) {
    throw new Error("Tham chiếu R2 không hợp lệ");
  }

  const response = await getR2Client().send(new GetObjectCommand({
    Bucket: parsed.bucket,
    Key: parsed.key
  }));
  const body = response.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;

  if (!body?.transformToByteArray) {
    throw new Error("Không thể đọc file từ R2");
  }

  return {
    buffer: Buffer.from(await body.transformToByteArray()),
    contentType: response.ContentType ?? "application/octet-stream"
  };
}

export async function getR2PlaybackUrl(fileUrl: string) {
  const parsed = parseR2StoredUrl(fileUrl);
  if (!parsed) return fileUrl;

  if (env.r2PublicBaseUrl) {
    return `${env.r2PublicBaseUrl.replace(/\/+$/, "")}/${encodeObjectKey(parsed.key)}`;
  }

  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key
    }),
    { expiresIn: signedUrlExpiresInSeconds }
  );
}

function sanitizeObjectFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "study_plan";
}

function sanitizeHeaderFileName(fileName: string) {
  return fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
}
