"use client";

import { AlertCircle, CheckCircle, ClipboardList, Download, RefreshCw, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { apiPost } from "@/lib/api";

type MasterSheetIssue = {
  code: string;
  message: string;
  preview?: string;
  questionCode?: string | null;
  severity: "error" | "warning";
  sourceColumn?: number;
  sourceColumnName?: string | null;
  sourceRow: number;
};

type MasterSheetSkippedRow = {
  questionCode?: string | null;
  reason: string;
  sourceRow: number;
  status?: string | null;
};

type MasterSheetSchoolPreview = {
  existingQuestions: number;
  matchedSchoolId: string | null;
  matchedSchoolName: string | null;
  missingMajors: string[];
  newQuestions: number;
  questionCount: number;
  schoolName: string;
  status: "existing" | "missing";
};

type MasterSheetPreview = {
  errors: MasterSheetIssue[];
  recordsPreview: Array<{
    degreeLevel: "BACHELOR" | "MASTER";
    language: "VI" | "ZH" | "EN";
    majorName: string | null;
    questionCode?: string | null;
    questionText: string;
    sampleAnswer?: string | null;
    schoolName: string;
    sourceColumn: number;
    sourceColumnName?: string | null;
    sourceRow: number;
  }>;
  schools: MasterSheetSchoolPreview[];
  skippedRows: MasterSheetSkippedRow[];
  source?: {
    csvHash: string;
    csvUrl: string | null;
    sourceFormat?: "legacy" | "normalized";
    sourceUrl: string | null;
  };
  stats: {
    duplicateQuestionsInSheet: number;
    errors: number;
    existingQuestions: number;
    generatedRecords?: number;
    matchedMajors: number;
    matchedSchools: number;
    missingMajors: number;
    missingSchools: number;
    newQuestions: number;
    questions: number;
    readyRows?: number | null;
    schools: number;
    skippedRows?: number;
    sourceRows?: number | null;
    totalMajors: number;
    warnings: number;
  };
  warnings: MasterSheetIssue[];
};

type MasterSheetImportResponse = {
  createdMajors: number;
  createdQuestions: number;
  createdSchools: number;
  duplicateQuestionsInSheet: number;
  linkedSchoolMajors: number;
  preview: MasterSheetPreview;
  skipped: Array<{ questionCode?: string | null; reason: string; sourceColumn?: number; sourceColumnName?: string | null; sourceRow: number }>;
  skippedQuestions: number;
  unchangedQuestions: number;
  updatedQuestions: number;
};

type MasterSheetImporterProps = {
  onImported: () => Promise<void> | void;
  token: string | null;
};

const defaultSheetUrl = "https://docs.google.com/spreadsheets/d/10xNUES4YGjjrvfFQFMer7zZcQElB2s8gmA557FRE_BE/edit?pli=1&gid=2018224967#gid=2018224967";
const templateUrl = "/templates/cau-hoi-phong-van-master-template.xlsx";

export function MasterSheetImporter({ onImported, token }: MasterSheetImporterProps) {
  const [sourceUrl, setSourceUrl] = useState(defaultSheetUrl);
  const [createMissingSchools, setCreateMissingSchools] = useState(true);
  const [createMissingMajors, setCreateMissingMajors] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<MasterSheetPreview | null>(null);
  const [result, setResult] = useState<MasterSheetImportResponse | null>(null);

  const visibleSchools = useMemo(() => {
    return [...(preview?.schools ?? [])]
      .sort((left, right) => {
        if (left.status !== right.status) return left.status === "missing" ? -1 : 1;
        return right.questionCount - left.questionCount;
      })
      .slice(0, 12);
  }, [preview]);

  const canImport = Boolean(preview) && !preview?.stats.errors && !busy;

  async function handlePreview() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const nextPreview = await apiPost<MasterSheetPreview>("/api/admin/questions/master-sheet/preview", {
        sourceUrl
      }, { timeoutMs: 90_000, token });
      setPreview(nextPreview);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Không thể kiểm tra Google Sheet");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!preview) {
      setError("Cần kiểm tra sheet trước khi import.");
      return;
    }
    if (preview.stats.errors > 0) {
      setError(`Sheet còn ${preview.stats.errors} lỗi dữ liệu. Vui lòng sửa lỗi rồi kiểm tra lại.`);
      return;
    }
    if (preview.stats.missingSchools && createMissingSchools) {
      const ok = confirm(`Sheet có ${preview.stats.missingSchools} trường chưa có trong hệ thống. Tạo mới các trường này và import câu hỏi?`);
      if (!ok) return;
    }

    setBusy(true);
    setError("");
    try {
      const nextResult = await apiPost<MasterSheetImportResponse>("/api/admin/questions/master-sheet/import", {
        createMissingMajors,
        createMissingSchools,
        sourceUrl,
        updateExisting
      }, { timeoutMs: 120_000, token });
      setResult(nextResult);
      setPreview(nextResult.preview);
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể import Google Sheet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-emerald-200 bg-white p-4 text-slate-950">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black">Import sheet câu hỏi chuẩn</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {preview
                ? `${preview.stats.questions} bản ghi phỏng vấn, ${preview.stats.schools} trường, ${preview.stats.totalMajors} ngành.`
                : "Kiểm tra lỗi dòng/cột trước, sau đó mới import vào ngân hàng câu hỏi."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={templateUrl} download className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold hover:bg-slate-50">
            <Download size={16} />Tải template
          </a>
          <button type="button" onClick={() => void handlePreview()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} />Kiểm tra sheet
          </button>
          <button type="button" onClick={() => void handleImport()} disabled={!canImport} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
            <Upload size={16} />Import vào DB
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <input
          className="min-h-10 rounded-lg border px-3 py-2 text-sm"
          value={sourceUrl}
          onChange={(event) => {
            setSourceUrl(event.target.value);
            setPreview(null);
            setResult(null);
          }}
        />
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3">
            <input type="checkbox" checked={createMissingSchools} onChange={(event) => setCreateMissingSchools(event.target.checked)} />
            Tạo trường thiếu
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3">
            <input type="checkbox" checked={createMissingMajors} onChange={(event) => setCreateMissingMajors(event.target.checked)} />
            Tạo ngành thiếu
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3">
            <input type="checkbox" checked={updateExisting} onChange={(event) => setUpdateExisting(event.target.checked)} />
            Cập nhật câu đã có
          </label>
        </div>
      </div>

      {preview ? (
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <StatBox label="Lỗi" tone={preview.stats.errors ? "danger" : "ok"} value={preview.stats.errors} />
          <StatBox label="Cảnh báo" tone={preview.stats.warnings ? "warn" : "ok"} value={preview.stats.warnings} />
          <StatBox label="Bỏ qua" tone={preview.stats.skippedRows ? "warn" : "neutral"} value={preview.stats.skippedRows ?? 0} />
          <StatBox label="Câu mới" value={preview.stats.newQuestions} />
          <StatBox label="Câu đã có" value={preview.stats.existingQuestions} />
          <StatBox label="Trường thiếu" tone={preview.stats.missingSchools ? "warn" : "ok"} value={preview.stats.missingSchools} />
        </div>
      ) : null}

      {preview?.errors.length ? <IssueList title="Lỗi cần sửa trước khi import" issues={preview.errors} tone="danger" /> : null}
      {preview?.warnings.length ? <IssueList title="Cảnh báo khi đọc sheet" issues={preview.warnings.slice(0, 12)} tone="warn" /> : null}
      {preview?.skippedRows.length ? <SkippedRows rows={preview.skippedRows.slice(0, 12)} /> : null}

      {visibleSchools.length ? (
        <div className="mt-4 overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] bg-slate-50 px-3 py-2 text-xs font-black uppercase text-slate-500">
            <span>Trường</span>
            <span>Câu hỏi</span>
            <span>Trạng thái</span>
          </div>
          {visibleSchools.map((school) => (
            <div key={school.schoolName} className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-2 border-t px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-bold">{school.schoolName}</p>
                {school.matchedSchoolName ? <p className="truncate text-xs text-slate-500">Khớp: {school.matchedSchoolName}</p> : null}
                {school.missingMajors.length ? <p className="truncate text-xs text-amber-700">Thiếu ngành: {school.missingMajors.slice(0, 3).join(", ")}</p> : null}
              </div>
              <span className="text-sm font-bold">{school.questionCount}</span>
              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${school.status === "existing" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                {school.status === "existing" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {school.status === "existing" ? "Đã có" : "Tạo mới"}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {result ? (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-bold text-green-700">
          Đã tạo {result.createdQuestions} câu hỏi, cập nhật {result.updatedQuestions} câu, giữ nguyên {result.unchangedQuestions} câu, bỏ qua {result.skippedQuestions} dòng/câu, tạo {result.createdSchools} trường và {result.createdMajors} ngành.
        </p>
      ) : null}
      {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
    </section>
  );
}

function IssueList({ issues, title, tone }: { issues: MasterSheetIssue[]; title: string; tone: "danger" | "warn" }) {
  const toneClass = tone === "danger" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className={`mt-4 rounded-lg border p-3 ${toneClass}`}>
      <p className="text-sm font-black">{title}</p>
      <div className="mt-2 divide-y divide-black/10">
        {issues.map((issue, index) => (
          <div key={`${issue.code}-${issue.sourceRow}-${issue.sourceColumn ?? index}`} className="py-2 text-sm">
            <p className="font-bold">
              Dòng {issue.sourceRow}{issue.sourceColumnName ? `, cột ${issue.sourceColumnName}` : issue.sourceColumn ? `, cột ${issue.sourceColumn}` : ""}: {issue.message}
            </p>
            {issue.preview ? <p className="mt-1 line-clamp-2 text-xs opacity-80">{issue.preview}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkippedRows({ rows }: { rows: MasterSheetSkippedRow[] }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-800">
      <p className="text-sm font-black">Dòng chưa import</p>
      <div className="mt-2 divide-y divide-slate-200">
        {rows.map((row) => (
          <p key={`${row.sourceRow}-${row.questionCode ?? ""}`} className="py-2 text-sm font-semibold">
            Dòng {row.sourceRow}{row.questionCode ? `, mã ${row.questionCode}` : ""}: {row.reason}
          </p>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "ok" | "warn" | "danger"; value: number }) {
  const toneClass = tone === "danger"
    ? "border-red-200 bg-red-50 text-red-800"
    : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "ok"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-xs font-black uppercase">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
