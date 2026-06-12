import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/auth.middleware.js";
import { MissingOpenAiKeyError, synthesizeSpeech, transcribeAudio } from "./speech.service.js";

export const speechRouter = Router();

speechRouter.use(requireAuth);

const transcribeSchema = z.object({
  audio: z.string().min(1, "Audio data required"),
  mimeType: z.string().optional().default("audio/webm"),
  language: z.enum(["vi", "zh", "en"]).optional()
});

speechRouter.post("/transcribe", async (req: Request, res: Response) => {
  try {
    const parsed = transcribeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Dữ liệu không hợp lệ",
        errors: parsed.error.flatten().fieldErrors
      });
      return;
    }

    const { audio, mimeType, language } = parsed.data;
    const result = await transcribeAudio(audio, mimeType, language);

    res.json({
      duration: result.duration,
      language: result.language,
      text: result.text
    });
  } catch (err) {
    console.error("[SPEECH] Transcribe error:", err);
    if (err instanceof MissingOpenAiKeyError) {
      res.status(503).json({ message: err.message });
      return;
    }
    const rawMessage = err instanceof Error ? err.message : "Lỗi xử lý giọng nói";
    const message = rawMessage.includes("<!DOCTYPE") || rawMessage.includes("404")
      ? "Provider AI hiện không hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome/Edge để nhận dạng trực tiếp trên trình duyệt."
      : rawMessage;
    res.status(500).json({ message });
  }
});

const synthesizeSchema = z.object({
  text: z.string().min(1, "Text required").max(4096, "Text quá dài (tối đa 4096 ký tự)"),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().default("nova"),
  speed: z.number().min(0.25).max(4.0).optional().default(1.0)
});

speechRouter.post("/synthesize", async (req: Request, res: Response) => {
  try {
    const parsed = synthesizeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Dữ liệu không hợp lệ",
        errors: parsed.error.flatten().fieldErrors
      });
      return;
    }

    const { text, voice, speed } = parsed.data;
    const result = await synthesizeSpeech(text, voice, speed);

    res.json({
      audio: result.audioBuffer.toString("base64"),
      contentType: result.contentType
    });
  } catch (err) {
    console.error("[SPEECH] Synthesize error:", err);
    if (err instanceof MissingOpenAiKeyError) {
      res.status(503).json({ message: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : "Lỗi tổng hợp giọng nói";
    res.status(500).json({ message });
  }
});
