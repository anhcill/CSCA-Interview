"use client";

import { Link as LinkIcon, Trash2, Upload, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { MasterSheetImporter } from "@/components/admin/master-sheet-importer";
import { QuestionsImporter } from "@/components/admin/questions-importer";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { VirtualList } from "@/components/ui/virtual-list";
import { apiDelete, apiGet, apiPost, apiPut, buildApiUrl } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

type Question = {
  category?: string | null;
  commonMistakes?: string | null;
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
  scoringRubric?: unknown;
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

const emptyForm = {
  category: "",
  commonMistakes: "",
  degreeLevel: "",
  difficulty: "MEDIUM",
  keywords: "",
  language: "VI",
  majorId: "",
  questionText: "",
  sampleAnswer: "",
  scholarshipId: "",
  scoringRubric: "",
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
const questionLanguages = ["VI", "ZH", "EN"] as const;
const audioSources: AudioSource[] = ["AI_TTS", "HUMAN_RECORDED", "USER_RECORDING"];
const diffLabel: Record<string, string> = { EASY: "Dễ", HARD: "Khó", MEDIUM: "TB" };
const languageLabel: Record<string, string> = { EN: "Tiếng Anh", VI: "Tiếng Việt", ZH: "Tiếng Trung" };

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
  const [filterLang, setFilterLang] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [schools, setSchools] = useState<SelectItem[]>([]);
  const [majors, setMajors] = useState<SelectItem[]>([]);
  const [scholarships, setScholarships] = useState<SelectItem[]>([]);
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
      if (filterLang) url += `&language=${filterLang}`;
      if (filterSchool) url += `&schoolId=${filterSchool}`;
      const res = await apiGet<ListResponse>(url, { token });
      setQuestions(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải câu hỏi");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterCat, filterDiff, filterLang, filterSchool, page, token]);

  const loadAudios = useCallback(async (questionId: string) => {
    setAudioLoading(true);
    setError("");
    try {
      const res = await apiGet<AudioListResponse>(`/api/questions/${questionId}/audios`, { token });
      setAudios(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải audio câu hỏi");
    } finally {
      setAudioLoading(false);
    }
  }, [token]);

  useEffect(() => {
    async function loadLookups() {
      try {
        const [nextSchools, nextMajors, nextScholarships] = await Promise.all([
          apiGet<LookupResponse>("/api/schools?limit=500", { cacheMs: 5 * 60_000 }),
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
        commonMistakes: form.commonMistakes || null,
        degreeLevel: form.degreeLevel || null,
        difficulty: form.difficulty || undefined,
        keywords: form.keywords || null,
        language: form.language || undefined,
        majorId: form.majorId || null,
        sampleAnswer: form.sampleAnswer || null,
        scholarshipId: form.scholarshipId || null,
        scoringRubric: parseScoringRubricForm(form.scoringRubric),
        schoolId: form.schoolId || null,
        suggestedAnswerLogic: form.suggestedAnswerLogic || null
      };
      if (editId) await apiPut(`/api/questions/${editId}`, body, { token });
      else await apiPost("/api/questions", body, { token });
      setForm(emptyForm);
      setEditId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu câu hỏi");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(question: Question) {
    if (editId === question.id && showForm) {
      setEditId(null);
      setForm(emptyForm);
      setShowForm(false);
      return;
    }

    setAudioQuestion(null);
    setAudios([]);
    setEditId(question.id);
    setForm({
      category: question.category || "",
      commonMistakes: question.commonMistakes || "",
      degreeLevel: question.degreeLevel || "",
      difficulty: question.difficulty || "MEDIUM",
      keywords: question.keywords || "",
      language: question.language || "VI",
      majorId: question.majorId || "",
      questionText: question.questionText,
      sampleAnswer: question.sampleAnswer || "",
      scholarshipId: question.scholarshipId || "",
      scoringRubric: formatScoringRubric(question.scoringRubric),
      schoolId: question.schoolId || "",
      suggestedAnswerLogic: question.suggestedAnswerLogic || ""
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa câu hỏi này?")) return;
    setError("");
    try {
      await apiDelete(`/api/questions/${id}`, { token });
      await load();
      if (audioQuestion?.id === id) {
        setAudioQuestion(null);
        setAudios([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa câu hỏi");
    }
  }

  async function openAudioPanel(question: Question) {
    if (audioQuestion?.id === question.id) {
      setAudioQuestion(null);
      setAudios([]);
      return;
    }

    setEditId(null);
    setForm(emptyForm);
    setShowForm(false);
    setAudioQuestion(question);
    setAudioForm(emptyAudioForm);
    await loadAudios(question.id);
  }

  function handleAudioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError("File audio vượt quá 8MB");
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
    reader.onerror = () => setError("Không thể đọc file audio");
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
      setError(err instanceof Error ? err.message : "Không thể lưu audio");
    } finally {
      setAudioSaving(false);
    }
  }

  async function handleAudioDelete(audio: QuestionAudio) {
    if (!audioQuestion) return;
    if (!confirm("Xóa audio này?")) return;

    setError("");
    try {
      await apiDelete(`/api/questions/${audioQuestion.id}/audios/${audio.id}`, { token });
      await loadAudios(audioQuestion.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa audio");
    }
  }

  function renderQuestionForm(className: string) {
    return (
      <form onSubmit={handleSubmit} className={`${className} space-y-3 rounded-lg border bg-white p-5`}>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <label className="block">
            <span className="text-sm font-bold text-indigo-900">1. Chọn trường áp dụng</span>
            <select className="mt-2 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2" value={form.schoolId} onChange={(event) => setForm({ ...form, schoolId: event.target.value })}>
              <option value="">Câu hỏi chung cho mọi trường</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
            </select>
          </label>
          <p className="mt-2 text-sm font-semibold text-indigo-800">
            Nếu chọn trường, câu hỏi và đáp án mẫu này sẽ ưu tiên xuất hiện khi ứng viên chọn đúng trường đó.
          </p>
        </div>
        <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Nội dung câu hỏi *" value={form.questionText} onChange={(event) => setForm({ ...form, questionText: event.target.value })} rows={3} required />
        <div className="grid gap-3 md:grid-cols-4">
          <select className="rounded-lg border px-3 py-2" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            <option value="">-- Danh mục --</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}>
            {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{diffLabel[difficulty]}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>
            <option value="VI">Tiếng Việt</option>
            <option value="ZH">Tiếng Trung</option>
            <option value="EN">Tiếng Anh</option>
          </select>
          <select className="rounded-lg border px-3 py-2" value={form.degreeLevel} onChange={(event) => setForm({ ...form, degreeLevel: event.target.value })}>
            <option value="">-- Bậc học --</option>
            <option value="BACHELOR">Đại học</option>
            <option value="MASTER">Thạc sĩ</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <select className="rounded-lg border px-3 py-2" value={form.majorId} onChange={(event) => setForm({ ...form, majorId: event.target.value })}>
            <option value="">-- Ngành --</option>
            {majors.map((major) => <option key={major.id} value={major.id}>{major.name}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2" value={form.scholarshipId} onChange={(event) => setForm({ ...form, scholarshipId: event.target.value })}>
            <option value="">-- Học bổng --</option>
            {scholarships.map((scholarship) => <option key={scholarship.id} value={scholarship.id}>{scholarship.name}</option>)}
          </select>
        </div>
        <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Gợi ý logic trả lời" value={form.suggestedAnswerLogic} onChange={(event) => setForm({ ...form, suggestedAnswerLogic: event.target.value })} rows={2} />
        <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Câu trả lời mẫu" value={form.sampleAnswer} onChange={(event) => setForm({ ...form, sampleAnswer: event.target.value })} rows={2} />
        <input className="w-full rounded-lg border px-3 py-2" placeholder="Từ khóa" value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} />
        <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Lỗi sai thường gặp / điểm trừ khi chấm" value={form.commonMistakes} onChange={(event) => setForm({ ...form, commonMistakes: event.target.value })} rows={2} />
        <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Rubric / ghi chú AI khi chấm điểm. Có thể nhập văn bản hoặc JSON." value={form.scoringRubric} onChange={(event) => setForm({ ...form, scoringRubric: event.target.value })} rows={3} />
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
            {editId ? "Cập nhật" : "Tạo câu hỏi"}
          </button>
          {editId ? <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); setShowForm(false); }} className="rounded-lg border px-4 py-2 hover:bg-slate-50">Hủy</button> : null}
        </div>
      </form>
    );
  }

  function renderAudioPanel() {
    if (!audioQuestion) return null;

    return (
      <section className="mt-4 rounded-lg border border-sky-100 bg-sky-50/40 p-5">
        <div className="flex flex-col justify-between gap-3 border-b border-sky-100 pb-4 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-bold text-sky-700">Audio câu hỏi</p>
            <h2 className="mt-1 text-lg font-bold">{audioQuestion.questionText}</h2>
          </div>
          <button type="button" onClick={() => { setAudioQuestion(null); setAudios([]); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-bold hover:bg-slate-50">
            <X size={16} />Đóng
          </button>
        </div>

        <form onSubmit={handleAudioSubmit} className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Link audio TTS hoặc bản ghi thật"
              value={audioForm.fileUrl}
              onChange={(event) => setAudioForm({ ...audioForm, audioFileBase64: "", fileName: "", fileUrl: event.target.value, mimeType: "" })}
            />
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-sm font-bold hover:bg-slate-50">
              <Upload size={16} />Tải file audio lên
              <input type="file" accept="audio/*" className="hidden" onChange={handleAudioFile} />
            </label>
            {audioForm.fileName ? <p className="text-xs font-semibold text-slate-500">Đã chọn: {audioForm.fileName}</p> : null}
            <div className="grid gap-3 md:grid-cols-3">
              <select className="rounded-lg border px-3 py-2" value={audioForm.source} onChange={(event) => setAudioForm({ ...audioForm, source: event.target.value as AudioSource })}>
                {audioSources.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
              <select className="rounded-lg border px-3 py-2" value={audioForm.language} onChange={(event) => setAudioForm({ ...audioForm, language: event.target.value })}>
                <option value="VI">VI</option>
                <option value="ZH">ZH</option>
                <option value="EN">EN</option>
              </select>
              <input className="rounded-lg border px-3 py-2" type="number" min="0" step="0.1" placeholder="Giây" value={audioForm.durationSeconds} onChange={(event) => setAudioForm({ ...audioForm, durationSeconds: event.target.value })} />
            </div>
          </div>
          <div className="space-y-3">
            <input className="w-full rounded-lg border px-3 py-2" placeholder="Tên giọng đọc" value={audioForm.voiceName} onChange={(event) => setAudioForm({ ...audioForm, voiceName: event.target.value })} />
            <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Bản ghi lời thoại" value={audioForm.transcript} onChange={(event) => setAudioForm({ ...audioForm, transcript: event.target.value })} rows={4} />
            <button type="submit" disabled={audioSaving || (!audioForm.fileUrl && !audioForm.audioFileBase64)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-700 px-4 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50">
              <Volume2 size={16} />Lưu audio
            </button>
          </div>
        </form>

        <div className="mt-5">
          {audioLoading ? (
            <ListSkeleton rows={3} />
          ) : audios.length ? (
            <div className="space-y-3">
              {audios.map((audio) => (
                <div key={audio.id} className="rounded-lg border bg-white p-3">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <p className="text-sm font-bold">{audio.source} - {audio.language}</p>
                      <p className="mt-1 text-xs text-slate-500">{audio.voice_name || "Chưa có giọng"} - {formatAudioDuration(audio.duration_seconds)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={resolveAudioUrl(audio.file_url)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold hover:bg-slate-50">
                        <LinkIcon size={14} />Mở link
                      </a>
                      <button type="button" onClick={() => void handleAudioDelete(audio)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50">
                        <Trash2 size={14} />Xóa
                      </button>
                    </div>
                  </div>
                  <audio className="mt-3 w-full" controls src={resolveAudioUrl(audio.file_url)}>
                    <track kind="captions" />
                  </audio>
                  {audio.transcript ? <p className="mt-2 text-sm text-slate-600">{audio.transcript}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có audio" description="Thêm link TTS hoặc tải file ghi âm thật cho câu hỏi này." />
          )}
        </div>
      </section>
    );
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
              Sửa
            </button>
            <button type="button" onClick={() => void handleDelete(question.id)} className="text-xs font-bold text-red-600 hover:underline">
              Xóa
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
          {question.language ? <span className="rounded bg-slate-100 px-2 py-0.5">{languageLabel[question.language] ?? question.language}</span> : null}
          {question.school ? <span className="rounded bg-purple-50 px-2 py-0.5 text-purple-700">{question.school.name}</span> : null}
          {question.major ? <span className="rounded bg-teal-50 px-2 py-0.5 text-teal-700">{question.major.name}</span> : null}
          {question.scholarship ? <span className="rounded bg-orange-50 px-2 py-0.5 text-orange-700">{question.scholarship.name}</span> : null}
          {hasScoringRubric(question.scoringRubric) ? <span className="rounded bg-sky-50 px-2 py-0.5 text-sky-700">Rubric AI</span> : null}
          <span className={`rounded-full px-2 py-0.5 ${question.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {question.isActive ? "Hoạt động" : "Tắt"}
          </span>
        </div>
        {editId === question.id && showForm ? renderQuestionForm("mt-4 border-indigo-200 bg-indigo-50/30") : null}
        {audioQuestion?.id === question.id ? renderAudioPanel() : null}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <div>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Quản lý câu hỏi</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} câu hỏi {loading ? "(đang cập nhật...)" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((current) => editId ? true : !current);
            setEditId(null);
            setForm(emptyForm);
            setAudioQuestion(null);
            setAudios([]);
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
        >
          {showForm ? "Đóng" : "+ Thêm câu hỏi"}
        </button>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <MasterSheetImporter token={token} onImported={load} />
      <QuestionsImporter token={token} onImported={load} />

      {showForm && !editId ? (
        <form onSubmit={handleSubmit} className="mb-8 space-y-3 rounded-lg border bg-white p-5">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
            <label className="block">
              <span className="text-sm font-bold text-indigo-900">1. Chọn trường áp dụng</span>
              <select className="mt-2 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2" value={form.schoolId} onChange={(event) => setForm({ ...form, schoolId: event.target.value })}>
                <option value="">Câu hỏi chung cho mọi trường</option>
                {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
            </label>
            <p className="mt-2 text-sm font-semibold text-indigo-800">
              Nếu chọn trường, câu hỏi và đáp án mẫu này sẽ ưu tiên xuất hiện khi ứng viên chọn đúng trường đó.
            </p>
          </div>
          <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Nội dung câu hỏi *" value={form.questionText} onChange={(event) => setForm({ ...form, questionText: event.target.value })} rows={3} required />
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded-lg border px-3 py-2" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="">-- Danh mục --</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}>
              {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{diffLabel[difficulty]}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>
              <option value="VI">Tiếng Việt</option>
              <option value="ZH">Tiếng Trung</option>
              <option value="EN">Tiếng Anh</option>
            </select>
            <select className="rounded-lg border px-3 py-2" value={form.degreeLevel} onChange={(event) => setForm({ ...form, degreeLevel: event.target.value })}>
              <option value="">-- Bậc học --</option>
              <option value="BACHELOR">Đại học</option>
              <option value="MASTER">Thạc sĩ</option>
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="rounded-lg border px-3 py-2" value={form.majorId} onChange={(event) => setForm({ ...form, majorId: event.target.value })}>
              <option value="">-- Ngành --</option>
              {majors.map((major) => <option key={major.id} value={major.id}>{major.name}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2" value={form.scholarshipId} onChange={(event) => setForm({ ...form, scholarshipId: event.target.value })}>
              <option value="">-- Học bổng --</option>
              {scholarships.map((scholarship) => <option key={scholarship.id} value={scholarship.id}>{scholarship.name}</option>)}
            </select>
          </div>
          <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Gợi ý logic trả lời" value={form.suggestedAnswerLogic} onChange={(event) => setForm({ ...form, suggestedAnswerLogic: event.target.value })} rows={2} />
          <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Câu trả lời mẫu" value={form.sampleAnswer} onChange={(event) => setForm({ ...form, sampleAnswer: event.target.value })} rows={2} />
          <input className="w-full rounded-lg border px-3 py-2" placeholder="Từ khóa" value={form.keywords} onChange={(event) => setForm({ ...form, keywords: event.target.value })} />
          <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Lỗi sai thường gặp / điểm trừ khi chấm" value={form.commonMistakes} onChange={(event) => setForm({ ...form, commonMistakes: event.target.value })} rows={2} />
          <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Rubric / ghi chú AI khi chấm điểm. Có thể nhập text hoặc JSON." value={form.scoringRubric} onChange={(event) => setForm({ ...form, scoringRubric: event.target.value })} rows={3} />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              {editId ? "Cập nhật" : "Tạo câu hỏi"}
            </button>
            {editId ? <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); }} className="rounded-lg border px-4 py-2 hover:bg-slate-50">Hủy</button> : null}
          </div>
        </form>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-3">
        <input className="min-w-[200px] flex-1 rounded-lg border px-3 py-2" placeholder="Tìm kiếm câu hỏi..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select className="rounded-lg border px-3 py-2" value={filterSchool} onChange={(event) => { setFilterSchool(event.target.value); setPage(1); }}>
          <option value="">Tất cả trường</option>
          {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
        </select>
        <select className="rounded-lg border px-3 py-2" value={filterCat} onChange={(event) => { setFilterCat(event.target.value); setPage(1); }}>
          <option value="">Tất cả danh mục</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select className="rounded-lg border px-3 py-2" value={filterLang} onChange={(event) => { setFilterLang(event.target.value); setPage(1); }}>
          <option value="">Tất cả ngôn ngữ</option>
          {questionLanguages.map((language) => <option key={language} value={language}>{languageLabel[language]}</option>)}
        </select>
        <select className="rounded-lg border px-3 py-2" value={filterDiff} onChange={(event) => { setFilterDiff(event.target.value); setPage(1); }}>
          <option value="">Tất cả độ khó</option>
          {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{diffLabel[difficulty]}</option>)}
        </select>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : questions.length > 12 && !editId && !audioQuestion ? (
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
        <EmptyState title="Chưa có câu hỏi" description="Ngân hàng câu hỏi hiện tại đang trống." />
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30">&larr; Trước</button>
          <span className="text-sm text-slate-500">Trang {page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30">Sau &rarr;</button>
        </div>
      ) : null}

      {false && audioQuestion ? (
        <section className="mt-8 rounded-lg border bg-white p-5">
          <div className="flex flex-col justify-between gap-3 border-b pb-4 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-bold text-sky-700">Audio câu hỏi</p>
              <h2 className="mt-1 text-lg font-bold">{audioQuestion?.questionText ?? ""}</h2>
            </div>
            <button type="button" onClick={() => { setAudioQuestion(null); setAudios([]); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-bold hover:bg-slate-50">
              <X size={16} />Đóng
            </button>
          </div>

          <form onSubmit={handleAudioSubmit} className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Link audio TTS hoặc bản ghi thật"
                value={audioForm.fileUrl}
                onChange={(event) => setAudioForm({ ...audioForm, audioFileBase64: "", fileName: "", fileUrl: event.target.value, mimeType: "" })}
              />
              <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-bold hover:bg-slate-50">
                <Upload size={16} />Tải file audio lên
                <input type="file" accept="audio/*" className="hidden" onChange={handleAudioFile} />
              </label>
              {audioForm.fileName ? <p className="text-xs font-semibold text-slate-500">Đã chọn: {audioForm.fileName}</p> : null}
              <div className="grid gap-3 md:grid-cols-3">
                <select className="rounded-lg border px-3 py-2" value={audioForm.source} onChange={(event) => setAudioForm({ ...audioForm, source: event.target.value as AudioSource })}>
                  {audioSources.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
                <select className="rounded-lg border px-3 py-2" value={audioForm.language} onChange={(event) => setAudioForm({ ...audioForm, language: event.target.value })}>
                  <option value="VI">VI</option>
                  <option value="ZH">ZH</option>
                  <option value="EN">EN</option>
                </select>
                <input className="rounded-lg border px-3 py-2" type="number" min="0" step="0.1" placeholder="Giây" value={audioForm.durationSeconds} onChange={(event) => setAudioForm({ ...audioForm, durationSeconds: event.target.value })} />
              </div>
            </div>
            <div className="space-y-3">
              <input className="w-full rounded-lg border px-3 py-2" placeholder="Tên giọng đọc" value={audioForm.voiceName} onChange={(event) => setAudioForm({ ...audioForm, voiceName: event.target.value })} />
              <textarea className="w-full rounded-lg border px-3 py-2" placeholder="Bản ghi lời thoại" value={audioForm.transcript} onChange={(event) => setAudioForm({ ...audioForm, transcript: event.target.value })} rows={4} />
              <button type="submit" disabled={audioSaving || (!audioForm.fileUrl && !audioForm.audioFileBase64)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-700 px-4 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50">
                <Volume2 size={16} />Lưu audio
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
                        <p className="mt-1 text-xs text-slate-500">{audio.voice_name || "Chưa có giọng"} - {formatAudioDuration(audio.duration_seconds)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a href={resolveAudioUrl(audio.file_url)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold hover:bg-slate-50">
                          <LinkIcon size={14} />Mở link
                        </a>
                        <button type="button" onClick={() => void handleAudioDelete(audio)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50">
                          <Trash2 size={14} />Xóa
                        </button>
                      </div>
                    </div>
                    <audio className="mt-3 w-full" controls src={resolveAudioUrl(audio.file_url)}>
                      <track kind="captions" />
                    </audio>
                    {audio.transcript ? <p className="mt-2 text-sm text-slate-600">{audio.transcript}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có audio" description="Thêm link TTS hoặc tải file ghi âm thật cho câu hỏi này." />
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function parseScoringRubricForm(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { notes: trimmed };
  }
}

function formatScoringRubric(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "notes" in value && typeof (value as { notes?: unknown }).notes === "string") {
    return String((value as { notes: string }).notes);
  }
  return JSON.stringify(value, null, 2);
}

function hasScoringRubric(value: unknown) {
  return Boolean(formatScoringRubric(value).trim());
}

function resolveAudioUrl(fileUrl: string) {
  if (/^(https?:|blob:|data:)/i.test(fileUrl)) return fileUrl;
  return buildApiUrl(fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`);
}

function formatAudioDuration(value?: number | string | null) {
  if (value == null) return "Chưa có duration";
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "Chưa có duration";
  return `${seconds.toFixed(1)}s`;
}
