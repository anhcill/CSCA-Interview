"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AnswerDetailedAnalysisDto } from "@/lib/interview-client";
import { activeInterviewSessionStorageKey } from "@/lib/interview-client";
import { apiPost } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { Loader2, RefreshCw } from "lucide-react";

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color =
    score >= 8
      ? "bg-green-900/50 text-green-300 border-green-700"
      : score >= 6
        ? "bg-yellow-900/50 text-yellow-300 border-yellow-700"
        : "bg-red-900/50 text-red-300 border-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${color}`}>
      {label}: {score}
    </span>
  );
}

export function AnswerFeedbackPanel({
  details,
  sessionId,
}: {
  details: AnswerDetailedAnalysisDto[];
  sessionId: string;
}) {
  const router = useRouter();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>(() => {
    // Tự động chọn trước các câu hỏi có điểm số thấp (< 6.5)
    return details
      .filter((d) => d.scores.total < 6.5)
      .map((d) => d.sessionQuestionId);
  });
  const [isRePracticing, setIsRePracticing] = useState(false);

  if (!details || details.length === 0) return null;

  const toggleSelect = (id: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleRePractice = async () => {
    if (selectedQuestions.length === 0 || !sessionId) return;
    setIsRePracticing(true);
    try {
      const token = getAuthToken();
      const res = await apiPost<{ session: { id: string } }>(
        "/api/interviews/re-practice",
        {
          sourceSessionId: sessionId,
          questionIds: selectedQuestions
        },
        { token }
      );
      if (res?.session?.id) {
        sessionStorage.setItem(activeInterviewSessionStorageKey, res.session.id);
        router.push(`/interview?sessionId=${res.session.id}`);
      }
    } catch (err) {
      console.error("Lỗi khởi tạo phiên luyện tập lại:", err);
      alert("Không thể khởi tạo phiên luyện tập lại. Vui lòng thử lại sau.");
    } finally {
      setIsRePracticing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tính năng Luyện tập lại câu hỏi yếu */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-black text-foreground flex items-center gap-2">
              <span>🎯 Luyện tập có chủ đích</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Chọn các câu hỏi bạn muốn luyện tập lại để nâng điểm số.
            </p>
          </div>
          <button
            onClick={handleRePractice}
            disabled={selectedQuestions.length === 0 || isRePracticing}
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-black text-primary-foreground shadow-md hover:bg-primary/95 disabled:opacity-50 transition-all"
          >
            {isRePracticing ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <RefreshCw size={14} />
            )}
            Luyện lại các câu đã chọn ({selectedQuestions.length})
          </button>
        </div>

        {/* Danh sách câu hỏi để tick chọn nhanh */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {details.map((d, index) => {
            const isSelected = selectedQuestions.includes(d.sessionQuestionId);
            const isWeak = d.scores.total < 6.5;
            return (
              <button
                type="button"
                key={d.sessionQuestionId}
                aria-pressed={isSelected}
                onClick={() => toggleSelect(d.sessionQuestionId)}
                className={`flex w-full items-start gap-3 p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:bg-muted/50"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                    isSelected ? "border-primary bg-primary" : "border-border bg-background"
                  }`}
                >
                  {isSelected && <span className="h-1.5 w-1.5 rounded-sm bg-primary-foreground" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-foreground truncate">
                    Câu {index + 1}: {d.questionText}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      Điểm: {d.scores.total}
                    </span>
                    {isWeak && (
                      <span className="inline-flex rounded-full bg-red-100 dark:bg-red-950/50 px-1.5 py-0.2 text-[8px] font-black text-red-700 dark:text-red-300">
                        Cần cải thiện
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <h3 className="text-lg font-black text-foreground mt-6">
        📝 Chi tiết từng câu trả lời
      </h3>

      {details.map((d, i) => {
        const expanded = expandedIdx === i;
        return (
          <div
            key={d.sessionQuestionId}
            className="border border-gray-700 rounded-lg overflow-hidden"
          >
            {/* Header - clickable */}
            <button
              onClick={() => setExpandedIdx(expanded ? null : i)}
              className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 transition text-left"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-400 mr-2">Câu {i + 1}:</span>
                <span className="text-sm text-gray-200 truncate">
                  {d.questionText.length > 80
                    ? d.questionText.slice(0, 80) + "…"
                    : d.questionText}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <ScoreBadge label="Tổng" score={d.scores.total} />
                <span className="text-gray-400 text-xs">
                  {expanded ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {/* Expanded content */}
            {expanded && (
              <div className="p-4 space-y-4 bg-gray-900/50">
                <div className="flex justify-end">
                  <Link href={`/interview/setup?practiceQuestionId=${d.sessionQuestionId}`} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-black text-gray-200 hover:bg-gray-800">
                    Luyện lại câu này
                  </Link>
                </div>

                {/* Score badges */}
                <div className="flex flex-wrap gap-2">
                  <ScoreBadge label="Nội dung" score={d.scores.content} />
                  <ScoreBadge label="Logic" score={d.scores.logic} />
                  <ScoreBadge label="Ngôn ngữ" score={d.scores.language} />
                  <ScoreBadge label="Tự tin" score={d.scores.confidence} />
                  <ScoreBadge label="Chuyên ngành" score={d.scores.expertise} />
                  <ScoreBadge label="Ấn tượng" score={d.scores.impression} />
                </div>

                {d.speech ? (
                  <div className="rounded-lg border border-cyan-800 bg-cyan-950/30 p-3">
                    <p className="text-xs font-black uppercase text-cyan-200">Phân tích giọng nói</p>
                    <div className="mt-2 grid gap-2 text-xs text-cyan-50 sm:grid-cols-3">
                      {d.speech.fluencyScore !== null ? <span>Trôi chảy: {d.speech.fluencyScore}/100</span> : null}
                      {d.speech.pronunciationScore !== null ? <span>Phát âm: {d.speech.pronunciationScore}/100</span> : null}
                      {d.speech.confidenceScore !== null ? <span>Tự tin: {d.speech.confidenceScore}/100</span> : null}
                      {d.speech.wpm !== null ? <span>Tốc độ: {d.speech.wpm} WPM</span> : null}
                      {d.speech.pauseCount !== null ? <span>Ngắt nghỉ dài: {d.speech.pauseCount}</span> : null}
                      {d.speech.fillerWordTotal !== null ? <span>Từ đệm: {d.speech.fillerWordTotal}</span> : null}
                    </div>
                  </div>
                ) : null}

                {/* Answer text */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Câu trả lời của bạn:</p>
                  <p className="text-sm text-gray-300 bg-gray-800 p-2 rounded">
                    {d.answerText}
                  </p>
                </div>

                {/* Feedback */}
                {d.feedback && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">💬 Nhận xét:</p>
                    <p className="text-sm text-gray-300">{d.feedback}</p>
                  </div>
                )}

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {d.strengths.length > 0 && (
                    <div>
                      <p className="text-xs text-green-400 mb-1">✅ Điểm mạnh:</p>
                      <ul className="text-sm text-gray-300 space-y-1">
                        {d.strengths.map((s, j) => (
                          <li key={j}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {d.weaknesses.length > 0 && (
                    <div>
                      <p className="text-xs text-red-400 mb-1">⚠️ Cần cải thiện:</p>
                      <ul className="text-sm text-gray-300 space-y-1">
                        {d.weaknesses.map((w, j) => (
                          <li key={j}>• {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Tips */}
                {d.tips.length > 0 && (
                  <div>
                    <p className="text-xs text-blue-400 mb-1">💡 Gợi ý:</p>
                    <ul className="text-sm text-gray-300 space-y-1">
                      {d.tips.map((t, j) => (
                        <li key={j}>• {t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Improved answer */}
                {d.improvedAnswer && (
                  <div>
                    <p className="text-xs text-purple-400 mb-1">🎯 Câu trả lời mẫu:</p>
                    <p className="text-sm text-gray-300 bg-purple-900/20 border border-purple-800 p-2 rounded">
                      {d.improvedAnswer}
                    </p>
                  </div>
                )}

                {d.sampleComparison ? (
                  <div className="rounded-lg border border-blue-800 bg-blue-950/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase text-blue-300">So sánh với câu trả lời mẫu từ DB</p>
                      <span className="rounded-full bg-blue-900 px-2 py-1 text-xs font-black text-blue-100">
                        {d.sampleComparison.coveragePercent}% coverage
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-300">{d.sampleComparison.sampleAnswer}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-black text-emerald-300">Từ khóa đã có</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {d.sampleComparison.matchedKeywords.length ? d.sampleComparison.matchedKeywords.map((keyword) => (
                            <span key={keyword} className="rounded border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs text-emerald-200">{keyword}</span>
                          )) : <span className="text-xs text-gray-400">Chưa khớp từ khóa nào.</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-black text-red-300">Từ khóa còn thiếu</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {d.sampleComparison.missingKeywords.length ? d.sampleComparison.missingKeywords.map((keyword) => (
                            <span key={keyword} className="rounded border border-red-800 bg-red-950 px-2 py-0.5 text-xs text-red-200">{keyword}</span>
                          )) : <span className="text-xs text-gray-400">Không còn từ khóa thiếu nào.</span>}
                        </div>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs font-semibold text-blue-100">
                      {d.sampleComparison.notes.map((note) => <li key={note}>- {note}</li>)}
                    </ul>
                  </div>
                ) : null}

                {/* Academic keywords */}
                {d.academicKeywords.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">🏷️ Từ khóa học thuật:</p>
                    <div className="flex flex-wrap gap-1">
                      {d.academicKeywords.map((kw, j) => (
                        <span
                          key={j}
                          className="text-xs bg-blue-900/30 text-blue-300 border border-blue-800 px-2 py-0.5 rounded"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
