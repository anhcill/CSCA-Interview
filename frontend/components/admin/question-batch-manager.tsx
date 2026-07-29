"use client";

import { Check, ClipboardList, Copy, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { parseBulkQuestionLines } from "./bulk-question-lines";

type SelectItem = {
  degreeLevel?: "BACHELOR" | "MASTER";
  id: string;
  name: string;
  nameZh?: string | null;
};

type QuestionCandidate = {
  category?: string | null;
  id: string;
  language?: string | null;
  questionText: string;
};

type ListResponse<T> = {
  data: T[];
};

type BatchResult = {
  created: number;
  duplicateNewQuestions: number;
  reused: number;
  skippedReuseQuestions: number;
};

const categories = [
  "PERSONAL",
  "ACADEMIC",
  "STUDY_PLAN",
  "SCHOOL_MAJOR",
  "SCHOLARSHIP",
  "CAREER_PLAN",
  "SITUATION",
  "LANGUAGE",
  "RESEARCH",
  "OTHER"
];

export function QuestionBatchManager({
  initialSchoolId = "",
  majors,
  onSaved,
  schools,
  token
}: {
  initialSchoolId?: string;
  majors: SelectItem[];
  onSaved: () => Promise<void> | void;
  schools: SelectItem[];
  token: string | null;
}) {
  const [targetSchoolId, setTargetSchoolId] = useState(initialSchoolId);
  const [targetMajorId, setTargetMajorId] = useState("");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [language, setLanguage] = useState("VI");
  const [sourceSchoolId, setSourceSchoolId] = useState("COMMON");
  const [sourceMajorId, setSourceMajorId] = useState("");
  const [sourceMajors, setSourceMajors] = useState<SelectItem[]>([]);
  const [candidates, setCandidates] = useState<QuestionCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const parsedQuestions = useMemo(() => parseBulkQuestionLines(newQuestionText), [newQuestionText]);
  const targetMajor = majors.find((major) => major.id === targetMajorId);
  const canSubmit = Boolean(
    targetSchoolId
    && targetMajorId
    && (parsedQuestions.length || selectedIds.length)
    && !saving
  );

  useEffect(() => {
    let ignore = false;
    setSourceMajorId("");
    setCandidates([]);
    setSelectedIds([]);

    if (!sourceSchoolId || sourceSchoolId === "COMMON") {
      setSourceMajors([]);
      return;
    }

    apiGet<ListResponse<SelectItem>>(
      `/api/majors?schoolId=${encodeURIComponent(sourceSchoolId)}&limit=300`,
      { cacheMs: 60_000, token }
    )
      .then((response) => {
        if (!ignore) setSourceMajors(response.data);
      })
      .catch(() => {
        if (!ignore) setSourceMajors([]);
      });

    return () => {
      ignore = true;
    };
  }, [sourceSchoolId, token]);

  useEffect(() => {
    let ignore = false;
    const canLoad = sourceSchoolId === "COMMON" || (sourceSchoolId && sourceMajorId);
    if (!canLoad) {
      setCandidates([]);
      setSelectedIds([]);
      return;
    }

    const params = new URLSearchParams({
      active: "all",
      limit: "100"
    });
    if (sourceSchoolId === "COMMON") {
      params.set("scope", "global");
    } else {
      params.set("schoolId", sourceSchoolId);
      params.set("majorId", sourceMajorId);
    }

    setLoadingCandidates(true);
    apiGet<ListResponse<QuestionCandidate>>(`/api/questions?${params.toString()}`, {
      cacheMs: 0,
      token
    })
      .then((response) => {
        if (ignore) return;
        setCandidates(response.data);
        setSelectedIds([]);
      })
      .catch(() => {
        if (!ignore) setCandidates([]);
      })
      .finally(() => {
        if (!ignore) setLoadingCandidates(false);
      });

    return () => {
      ignore = true;
    };
  }, [sourceMajorId, sourceSchoolId, token]);

  function toggleQuestion(questionId: string) {
    setSelectedIds((current) => (
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId]
    ));
  }

  async function saveBatch() {
    if (!canSubmit || !targetMajor) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await apiPost<BatchResult>("/api/questions/bulk", {
        majorId: targetMajorId,
        questions: parsedQuestions.map((questionText) => ({
          category,
          degreeLevel: targetMajor.degreeLevel,
          difficulty,
          language,
          questionText
        })),
        reuseQuestionIds: selectedIds,
        schoolId: targetSchoolId
      }, { token });

      setMessage(
        `Đã tạo ${result.created} câu mới và gán ${result.reused} câu dùng lại.`
        + (result.duplicateNewQuestions ? ` Bỏ qua ${result.duplicateNewQuestions} câu trùng.` : "")
      );
      setNewQuestionText("");
      setSelectedIds([]);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu bộ câu hỏi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/20">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Thao tác nhanh</p>
          <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Tạo bộ câu hỏi theo trường – ngành</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
            Dán nhiều câu mới và chọn lại câu hỏi chung hoặc câu của trường–ngành khác trong cùng một lần lưu.
          </p>
        </div>
        <div className="rounded-xl bg-white px-4 py-3 text-sm font-black text-indigo-700 shadow-sm dark:bg-slate-950 dark:text-indigo-300">
          {parsedQuestions.length} câu mới · {selectedIds.length} câu dùng lại
        </div>
      </div>

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
      {message ? <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">{message}</p> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="space-y-4 rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={18} />
            <h3 className="font-black">1. Chọn nơi áp dụng và nhập câu mới</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="min-h-11 rounded-lg border px-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
              value={targetSchoolId}
              onChange={(event) => {
                setTargetSchoolId(event.target.value);
                setTargetMajorId("");
              }}
            >
              <option value="">Chọn trường đích *</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
            <select
              className="min-h-11 rounded-lg border px-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
              value={targetMajorId}
              onChange={(event) => setTargetMajorId(event.target.value)}
              disabled={!targetSchoolId}
            >
              <option value="">{targetSchoolId ? "Chọn ngành đích *" : "Chọn trường trước"}</option>
              {majors.map((major) => (
                <option key={major.id} value={major.id}>
                  {major.name}{major.degreeLevel ? ` · ${major.degreeLevel === "MASTER" ? "Thạc sĩ" : "Đại học"}` : ""}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="min-h-52 w-full rounded-lg border px-3 py-3 text-sm leading-6 dark:border-slate-700 dark:bg-slate-900"
            value={newQuestionText}
            onChange={(event) => setNewQuestionText(event.target.value)}
            placeholder={"Mỗi dòng là một câu hỏi mới, ví dụ:\nVì sao bạn chọn ngành này?\nBạn đã chuẩn bị kiến thức gì cho ngành?\nMục tiêu nghề nghiệp sau tốt nghiệp là gì?"}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="min-h-10 rounded-lg border px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="min-h-10 rounded-lg border px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
              <option value="EASY">Dễ</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HARD">Khó</option>
            </select>
            <select className="min-h-10 rounded-lg border px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="VI">Tiếng Việt</option>
              <option value="ZH">Tiếng Trung</option>
              <option value="EN">Tiếng Anh</option>
            </select>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <Copy className="text-indigo-600" size={18} />
            <h3 className="font-black">2. Chọn câu hỏi có sẵn để dùng lại</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="min-h-11 rounded-lg border px-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900"
              value={sourceSchoolId}
              onChange={(event) => setSourceSchoolId(event.target.value)}
            >
              <option value="COMMON">Kho câu hỏi chung</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
            <select
              className="min-h-11 rounded-lg border px-3 text-sm font-bold disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
              value={sourceMajorId}
              onChange={(event) => setSourceMajorId(event.target.value)}
              disabled={sourceSchoolId === "COMMON"}
            >
              <option value="">{sourceSchoolId === "COMMON" ? "Không cần chọn ngành" : "Chọn ngành nguồn"}</option>
              {sourceMajors.map((major) => <option key={major.id} value={major.id}>{major.name}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
            <span>{loadingCandidates ? "Đang tải câu hỏi..." : `${candidates.length} câu có thể chọn`}</span>
            {candidates.length ? (
              <button
                type="button"
                className="text-indigo-700 hover:underline dark:text-indigo-300"
                onClick={() => setSelectedIds(selectedIds.length === candidates.length ? [] : candidates.map((item) => item.id))}
              >
                {selectedIds.length === candidates.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            ) : null}
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {candidates.map((question) => {
              const selected = selectedIds.includes(question.id);
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => toggleQuestion(question.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                    selected
                      ? "border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  }`}
                >
                  {selected ? <Check className="mt-0.5 shrink-0 text-indigo-600" size={17} /> : <Square className="mt-0.5 shrink-0 text-slate-400" size={17} />}
                  <span>
                    <span className="block text-sm font-semibold leading-5">{question.questionText}</span>
                    <span className="mt-1 block text-[11px] font-bold text-slate-500">
                      {question.language ?? "VI"} · {question.category ?? "OTHER"}
                    </span>
                  </span>
                </button>
              );
            })}
            {!loadingCandidates && !candidates.length ? (
              <p className="rounded-lg border border-dashed p-5 text-center text-sm font-semibold text-slate-500">
                Chưa có câu hỏi trong nguồn này.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl bg-white p-4 dark:bg-slate-950 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Khi lưu, hệ thống tự liên kết ngành với trường và không tạo bản sao cho câu hỏi dùng lại.
        </p>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void saveBatch()}
          className="min-h-11 rounded-lg bg-indigo-600 px-5 text-sm font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Đang lưu bộ câu hỏi..." : "Lưu toàn bộ"}
        </button>
      </div>
    </section>
  );
}
