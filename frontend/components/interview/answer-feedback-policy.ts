import type { AnswerDetailedAnalysisDto } from "@/lib/interview-client";

export function shouldShowAudioAnalysis(
  detail: Pick<AnswerDetailedAnalysisDto, "answerSource" | "audioScore" | "speech">
) {
  return detail.answerSource === "MIC"
    && detail.speech != null
    && detail.audioScore != null;
}
