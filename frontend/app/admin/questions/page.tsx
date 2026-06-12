"use client";

import { Download, Link as LinkIcon, Trash2, Upload, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { VirtualList } from "@/components/ui/virtual-list";
import { apiDelete, apiGet, apiGetText, apiPost, apiPut, buildApiUrl } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

type Question = {
  category?: string | null;
  degreeLevel?: string | null;
  difficulty?: string | null;
  id: string;
  isActive: boolean;
  keywords?: string | null;
  language?: string | null;
  major?: { id: string; name: string } | null;
  majorId?: string | null;
  questionText: string;
  sampleAnswer?: string | null;
  scholarship?: { id: string; name: string } | null;
  scholarshipId?: string | null;
  school?: { id: string; name: string } | null;
  schoolId?: string | null;
  suggestedAnswerLogic?: string | null;
};

type ListResponse = { data: Question[]; total: number; page: number; totalPages: number };
type SelectItem = { id: string; name: string };
type LookupResponse = { data: SelectItem[] };

type AudioSource = "AI_TTS" | "HUMAN_RECORDED" | "USER_RECORDING";
type QuestionAudio = {
  created_at: string;
  duration_seconds?: number | string | null;
  file_url: string;
  id: string;
  language: "VI" | "ZH" | "EN";
  question_id: string;
  source: AudioSource;
  transcript?: string | null;
  voice_name?: string | null;
};
type AudioListResponse = { data: QuestionAudio[] };
type CsvImportResponse = { created: number; skipped: Array<{ line: number; reason: string }> };

const emptyForm = {
  category: "",
  degreeLevel: "",
  difficulty: "MEDIUM",
  keywords: "",
  language: "VI",
  majorId: "",
  questionText: "",
  sampleAnswer: "",
  scholarshipId: "",
  schoolId: "",
  suggestedAnswerLogic: ""
};

const emptyAudioForm = {
  audioFileBase64: "",
  durationSeconds: "",
  fileName: "",
  fileUrl: "",
  language: "VI",
  mimeType: "",
  source: "AI_TTS" as AudioSource,
  transcript: "",
  voiceName: ""
};

const categories = ["PERSONAL", "ACADEMIC", "STUDY_PLAN", "SCHOOL_MAJOR", "SCHOLARSHIP", "CAREER_PLAN", "SITUATION", "LANGUAGE", "RESEARCH", "OTHER"];
const difficulties = ["EASY", "MEDIUM", "HARD"];
const audioSources: AudioSource[] = ["AI_TTS", "HUMAN_RECORDED", "USER_RECORDING"];
const diffLabel: Record<string, string> = { EASY: "De", HARD: "Kho", MEDIUM: "TB" };

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterDiff, setFilterDiff] = useState("");
  const [schools, setSchools] = useState<SelectItem[]>([]);
  const [majors, setMajors] = useState<SelectItem[]>([]);
  const [scholarships, setScholarships] = useState<SelectItem[]>([]);
  const [csvText, setCsvText] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvImportResponse | null>(null);
  const [audioQuestion, setAudioQuestion] = useState<Question | null>(null);
  const [audios, setAudios] = useState<QuestionAudio[]>([]);
  const [audioForm, setAudioForm] = useState(emptyAudioForm);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioSaving, setAudioSaving] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);
  const token = getAuthToken();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/questions?active=all&page=${page}&limit=50&search=${encodeURIComponent(debouncedSearch)}`;
      if (filterCat) url += `&category=${filterCat}`;
      if (filterDiff) url += `&difficulty=${filterDiff}`;
      const res = await apiGet<ListResponse>(url, { token });
      setQuestions(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the tai cau hoi");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterCat, filterDiff, page, token]);

  const loadAudios = useCallback(async (questionId: string) => {
    setAudioLoading(true);
    setError("");
    try {
      const res = await apiGet<AudioListResponse>(`/api/questions/${questionId}/audios`, { token });
      setAudios(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the tai audio cau hoi");
    } finally {
      setAudioLoading(false);
    }
  }, [token]);

  useEffect(() => {
    async function loadLookups() {
      try {
        const [nextSchools, nextMajors, nextScholarships] = await Promise.all([
          apiGet<LookupResponse>("/api/schools?limit=100", { cacheMs: 5 * 60_000 }),
          apiGet<LookupResponse>("/api/majors?limit=100", { cacheMs: 5 * 60_000 }),
          apiGet<LookupResponse>("/api/scholarships?limit=100", { cacheMs: 5 * 60_000 })
        ]);
        setSchools(nextSchools.data);
        setMajors(nextMajors.data);
        setScholarships(nextScholarships.data);
      } catch {
        // Lookup data is optional for manual question entry.
      }
    }

    void loadLookups();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const body = {
        ...form,
        category: form.category || undefined,
        degreeLevel: form.degreeLevel || null,
        difficulty: form.difficulty || undefined,
        language: form.language || undefined,
        majorId: form.majorId || null,
        scholarshipId: form.scholarshipId || null,
        schoolId: form.schoolId || null
      };
      if (editId) await apiPut(`/api/questions/${editId}`, body, { token });
      else await apiPost("/api/questions", body, { token });
      setForm(emptyForm);
      setEditId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the luu cau hoi");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(question: Question) {
    setEditId(question.id);
    setForm({
      category: question.category || "",
      degreeLevel: question.degreeLevel || "",
      difficulty: question.difficulty || "MEDIUM",
      keywords: question.keywords || "",
      language: question.language || "VI",
      majorId: question.majorId || "",
      questionText: question.questionText,
      sampleAnswer: question.sampleAnswer || "",
      scholarshipId: question.scholarshipId || "",
      schoolId: question.schoolId || "",
      suggestedAnswerLogic: question.suggestedAnswerLogic || ""
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoa cau hoi nay?")) return;
    setError("");
    try {
      await apiDelete(`/api/questions/${id}`, { token });
      await load();
      if (audioQuestion?.id === id) {
        setAudioQuestion(null);
        setAudios([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the xoa cau hoi");
    }
  }

  async function handleExportCsv() {
    setCsvBusy(true);
    setError("");
    try {
      const csv = await apiGetText("/api/questions/export", { token });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `questions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the export CSV");
    } finally {
      setCsvBusy(false);
    }
  }

  async function handleImportCsv() {
    if (!csvText.trim()) {
      setError("CSV khong duoc de trong");
      return;
    }

    setCsvBusy(true);
    setError("");
    setCsvResult(null);
    try {
      const result = await apiPost<CsvImportResponse>("/api/questions/import", { csv: csvText }, { token });
      setCsvResult(result);
      setCsvText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the import CSV");
    } finally {
      setCsvBusy(false);
    }
  }

  function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.onerror = () => setError("Khong the doc file CSV");
    reader.readAsText(file);
  }

  async function openAudioPanel(question: Question) {
    setAudioQuestion(question);
    setAudioForm(emptyAudioForm);
    await loadAudios(question.id);
  }

  function handleAudioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError("File audio vuot qua 8MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAudioForm((current) => ({
        ...current,
        audioFileBase64: String(reader.result ?? ""),
        fileName: file.name,
        fileUrl: "",
        mimeType: file.type
      }));
    };
    reader.onerror = () => setError("Khong the doc file audio");
    reader.readAsDataURL(file);
  }

  async function handleAudioSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!audioQuestion) return;

    setAudioSaving(true);
    setError("");
    try {
      await apiPost(`/api/questions/${audioQuestion.id}/audios`, {
        audioFileBase64: audioForm.audioFileBase64 || null,
        durationSeconds: audioForm.durationSeconds ? Number(audioForm.durationSeconds) : null,
        fileName: audioForm.fileName || null,
        fileUrl: audioForm.fileUrl || null,
        language: audioForm.language,
        mimeType: audioForm.mimeType || null,
        source: audioForm.source,
        transcript: audioForm.transcript || null,
        voiceName: audioForm.voiceName || null
      }, { token });
      setAudioForm(emptyAudioForm);
      await loadAudios(audioQuestion.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the luu audio");
    } finally {
      setAudioSaving(false);
    }
  }

  async function handleAudioDelete(audio: QuestionAudio) {
    if (!audioQuestion) return;
    if (!confirm("Xoa audio nay?")) return;

    setError("");
    try {
      await apiDelete(`/api/questions/${audioQuestion.id}/audios/${audio.id}`, { token });
      await loadAudios(audioQuestion.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khong the xoa audio");
    }
  }

  function renderQuestionCard(question: Question) {
    return (
      <div key={question.id} className="rounded-lg border bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <p className="flex-1 font-medium">{question.questionText}</p>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button type="button" onClick={() => void openAudioPanel(question)} className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:underline">
              <Volume2 size={14} />Audio
            </button>
            <button type="button" onClick={() => startEdit(question)} className="text-xs font-bold text-indigo-600 hover:underline">
              Sua
            </button>
            <button type="button" onClick={() => void handleDelete(question.id)} className="text-xs font-bold text-red-600 hover:underline">
              Xoa
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {question.category ? <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">{question.category}</span> : null}
          {question.difficulty ? (
            <span className={`rounded px-2 py-0.5 ${question.difficulty === "HARD" ? "bg-red-50 text-red-700" : question.difficulty === "EASY" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
              {diffLabel[question.difficulty] || question.difficulty}
            </span>
          ) : null}
          {question.language ? <span className="rounded bg-slate-100 px-2 py-0.5">{question.language}</span> : null}
          {question.school ? <span className="rounded bg-purple-50 px-2 py-0.5 text-purple-700">{question.school.name}</span> : null}
          {question.major ? <span className="rounded bg-teal-50 px-2 py-0.5 text-teal-700">{question.major.name}</span> : null}
          {question.scholarship ? <span className="rounded bg-orange-50 px-2 py-0.5 text-orange-700">{question.scholarship.name}</span> : null}
          <span className={`rounded-full px-2 py-0.5 ${question.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {question.isActive ? "Hoat dong" : "Tat"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <div>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Quan ly cau hoi</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} cau hoi {loading ? "(dang cap nhat...)" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((current) => !current);
            setEditId(null);
            setForm(emptyForm);
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
        >
          {showForm ? "Dong" : "+ Them cau hoi"}
        </button>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="mb-6 grid gap-4 rounded-lg border bg-white p-4 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-bold">CSV cau hoi</h2>
          <p className="mt-1 text-sm text-slate-500">Export toan bo ngan hang cau hoi hoac import them tu CSV.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void handleExportCsv()} disabled={csvBusy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">
              <Download size={16} />Export CSV
            </button>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-bold hover:bg-slate-50">
              <Upload size={16} />Chon CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} />
            </label>
          </div>
          {csvResult ? (
            <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              Da import {csvResult.created} cau hoi. Bo qua {csvResult.skipped.length} dong.
            </p>
          ) : null}
        </div>
        <div className="space-y-3">
          <textarea
            className="min-h-28 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Dan noi dung CSV vao day neu khong upload file..."
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
          />
          <button type="button" onClick={() => void handleImportCsv()} disabled={csvBusy || !csvText.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
            <Upload size={16} />Import CSV
          </button>
        </div>
      </section>

      {showForm ? (
        <form onSubmit={handleSubmit} className="mb-8 space-y-3 rounded-lg border bg-white p-5">
          <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Noi dung cau hoi *" value={form.questionText} onChange={(event) => setForm({ ...form, questionText: event.target.value })} rows={3} required />
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded-lg border px-3 py-2" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="">-- Danh muc --</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}>
              {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{diffLabel[difficulty]}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>
              <option value="VI">Tieng Viet</option>
              <option value="ZH">Tieng Trung</option>
              <option value="EN">Tieng Anh</option>
            </select>
            <select className="rounded-lg border px-3 py-2" value={form.degreeLevel} onChange={(event) => setForm({ ...form, degreeLevel: event.target.value })}>
              <option value="">-- Bac hoc --</option>
              <option value="BACHELOR">Dai hoc</option>
              <option value="MASTER">Thac si</option>
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="rounded-lg border px-3 py-2" value={form.schoolId} onChange={(event) => setForm({ ...form, schoolId: event.target.value })}>
              <option value="">-- Truong --</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2" value={form.majorId} onChange={(event) => setForm({ ...form, majorId: event.target.value })}>
              <option value="">-- Nganh --</option>
              {majors.map((major) => <option key={major.id} value={major.id}>{major.name}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2" value={form.scholarshipId} onChange={(event) => setForm({ ...form, scholarshipId: event.target.value })}>
              <option value="">-- Hoc bong --</option>
              {scholarships.map((scholarship) => <option key={scholarship.id} value={scholarship.id}>{scholarship.name}</option>)}
            </select>
          </div>
          <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Goi y logic tra loi" value={form.suggestedAnswerLogic} onChange={(event) => setForm({ ...form, suggestedAnswerLogic: event.target.value })} rows={2} />
          <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Cau tra loi mau" value={form.sampleAnswer} onChange={(event) => setForm({ ...form, sampleAnswer: event.target.value })} rows={2} />
          <input className="w-full rounded-lg border px-3 py-2" placeholder="Tu khoa" value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              {editId ? "Cap nhat" : "Tao cau hoi"}
            </button>
            {editId ? <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); }} className="rounded-lg border px-4 py-2 hover:bg-slate-50">Huy</button> : null}
          </div>
        </form>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-3">
        <input className="min-w-[200px] flex-1 rounded-lg border px-3 py-2" placeholder="Tim kiem cau hoi..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select className="rounded-lg border px-3 py-2" value={filterCat} onChange={(event) => { setFilterCat(event.target.value); setPage(1); }}>
          <option value="">Tat ca danh muc</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select className="rounded-lg border px-3 py-2" value={filterDiff} onChange={(event) => { setFilterDiff(event.target.value); setPage(1); }}>
          <option value="">Tat ca do kho</option>
          {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{diffLabel[difficulty]}</option>)}
        </select>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : questions.length > 12 ? (
        <VirtualList
          className="rounded-lg border border-slate-100"
          estimateSize={132}
          items={questions}
          renderItem={(question) => <div className="pb-3">{renderQuestionCard(question)}</div>}
          viewportHeight={640}
        />
      ) : questions.length ? (
        <div className="space-y-3">
          {questions.map(renderQuestionCard)}
        </div>
      ) : (
        <EmptyState title="Chua co cau hoi" description="Ngan hang cau hoi hien tai dang trong." />
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30">&larr; Truoc</button>
          <span className="text-sm text-slate-500">Trang {page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30">Sau &rarr;</button>
        </div>
      ) : null}

      {audioQuestion ? (
        <section className="mt-8 rounded-lg border bg-white p-5">
          <div className="flex flex-col justify-between gap-3 border-b pb-4 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-bold text-sky-700">Audio cau hoi</p>
              <h2 className="mt-1 text-lg font-bold">{audioQuestion.questionText}</h2>
            </div>
            <button type="button" onClick={() => { setAudioQuestion(null); setAudios([]); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-bold hover:bg-slate-50">
              <X size={16} />Dong
            </button>
          </div>

          <form onSubmit={handleAudioSubmit} className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Link audio TTS/human recorded"
                value={audioForm.fileUrl}
                onChange={(event) => setAudioForm({ ...audioForm, audioFileBase64: "", fileName: "", fileUrl: event.target.value, mimeType: "" })}
              />
              <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-bold hover:bg-slate-50">
                <Upload size={16} />Upload audio file
                <input type="file" accept="audio/*" className="hidden" onChange={handleAudioFile} />
              </label>
              {audioForm.fileName ? <p className="text-xs font-semibold text-slate-500">Da chon: {audioForm.fileName}</p> : null}
              <div className="grid gap-3 md:grid-cols-3">
                <select className="rounded-lg border px-3 py-2" value={audioForm.source} onChange={(event) => setAudioForm({ ...audioForm, source: event.target.value as AudioSource })}>
                  {audioSources.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
                <select className="rounded-lg border px-3 py-2" value={audioForm.language} onChange={(event) => setAudioForm({ ...audioForm, language: event.target.value })}>
                  <option value="VI">VI</option>
                  <option value="ZH">ZH</option>
                  <option value="EN">EN</option>
                </select>
                <input className="rounded-lg border px-3 py-2" type="number" min="0" step="0.1" placeholder="Giay" value={audioForm.durationSeconds} onChange={(event) => setAudioForm({ ...audioForm, durationSeconds: event.target.value })} />
              </div>
            </div>
            <div className="space-y-3">
              <input className="w-full rounded-lg border px-3 py-2" placeholder="Voice name" value={audioForm.voiceName} onChange={(event) => setAudioForm({ ...audioForm, voiceName: event.target.value })} />
              <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Transcript" value={audioForm.transcript} onChange={(event) => setAudioForm({ ...audioForm, transcript: event.target.value })} rows={4} />
              <button type="submit" disabled={audioSaving || (!audioForm.fileUrl && !audioForm.audioFileBase64)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-700 px-4 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50">
                <Volume2 size={16} />Luu audio
              </button>
            </div>
          </form>

          <div className="mt-5">
            {audioLoading ? (
              <ListSkeleton rows={3} />
            ) : audios.length ? (
              <div className="space-y-3">
                {audios.map((audio) => (
                  <div key={audio.id} className="rounded-lg border p-3">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <p className="text-sm font-bold">{audio.source} - {audio.language}</p>
                        <p className="mt-1 text-xs text-slate-500">{audio.voice_name || "No voice"} - {formatAudioDuration(audio.duration_seconds)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a href={resolveAudioUrl(audio.file_url)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold hover:bg-slate-50">
                          <LinkIcon size={14} />Mo link
                        </a>
                        <button type="button" onClick={() => void handleAudioDelete(audio)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50">
                          <Trash2 size={14} />Xoa
                        </button>
                      </div>
                    </div>
                    <audio className="mt-3 w-full" controls src={resolveAudioUrl(audio.file_url)} />
                    {audio.transcript ? <p className="mt-2 text-sm text-slate-600">{audio.transcript}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Chua co audio" description="Them link TTS hoac upload file human recorded cho cau hoi nay." />
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function resolveAudioUrl(fileUrl: string) {
  if (/^(https?:|blob:|data:)/i.test(fileUrl)) return fileUrl;
  return buildApiUrl(fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`);
}

function formatAudioDuration(value?: number | string | null) {
  if (value == null) return "Chua co duration";
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "Chua co duration";
  return `${seconds.toFixed(1)}s`;
}
