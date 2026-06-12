"use client";

import Link from "next/link";
import { useState } from "react";
import type { AnswerDetailedAnalysisDto } from "@/lib/interview-client";

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
}: {
  details: AnswerDetailedAnalysisDto[];
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!details || details.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
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
