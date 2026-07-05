"use client";

import { ClipboardList, Download, Upload } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { z } from "zod";
import { apiGetText, apiPost } from "@/lib/api";

type CsvImportResponse = { created: number; skipped: Array<{ line: number; reason: string }> };

type QuestionsImporterProps = {
  onImported: () => Promise<void> | void;
  token: string | null;
};

const rowSchema = z.object({
  category: z.string().optional(),
  degreelevel: z.string().optional(),
  difficulty: z.string().optional(),
  language: z.string().optional(),
  questiontext: z.string().trim().min(1, "Thiếu questionText")
});

const requiredHeaders = ["questiontext"];

export function QuestionsImporter({ onImported, token }: QuestionsImporterProps) {
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CsvImportResponse | null>(null);
  const [dragging, setDragging] = useState(false);

  const preview = useMemo(() => validateCsv(csvText), [csvText]);

  async function handleExportCsv() {
    setBusy(true);
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
      setError(err instanceof Error ? err.message : "Không thể export CSV");
    } finally {
      setBusy(false);
    }
  }

  async function handleImportCsv() {
    if (!csvText.trim()) {
      setError("CSV không được để trống");
      return;
    }
    if (!preview.valid) {
      setError(preview.errors[0] ?? "CSV chưa hợp lệ");
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);
    try {
      const nextResult = await apiPost<CsvImportResponse>("/api/admin/questions/import", { csv: csvText }, { token });
      setResult(nextResult);
      setCsvText("");
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể import CSV");
    } finally {
      setBusy(false);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void readCsvFile(file);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readCsvFile(file);
  }

  async function readCsvFile(file: File) {
    setError("");
    setResult(null);
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
        if (!firstSheet) {
          setError("File Excel không có sheet dữ liệu.");
          return;
        }
        setCsvText(XLSX.utils.sheet_to_csv(firstSheet));
      } catch {
        setError("Không thể đọc file Excel");
      }
      return;
    }
    if (!/\.(csv|tsv|txt)$/i.test(file.name) && !["text/csv", "text/tab-separated-values", "text/plain"].includes(file.type)) {
      setError("Chỉ hỗ trợ CSV/TSV trong lần cập nhật này.");
      return;
    }

    try {
      setCsvText(await file.text());
    } catch {
      setError("Không thể đọc file");
    }
  }

  return (
    <section className="mb-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 text-slate-950 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black">Nhập Excel/CSV</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Cột bắt buộc: questionText.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleExportCsv()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">
            <Download size={16} />Xuất CSV
          </button>
          <label
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-bold transition ${dragging ? "border-red-400 bg-red-50 text-red-700" : "hover:bg-slate-50"}`}
          >
            <Upload size={16} />Chọn file
            <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values" className="hidden" onChange={handleFileInput} />
          </label>
        </div>

        {preview.rows ? (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            {preview.valid ? `Sẵn sàng nhập ${preview.rows} dòng.` : preview.errors.slice(0, 3).join(" ")}
          </div>
        ) : null}
        {result ? (
          <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-bold text-green-700">
            Đã nhập {result.created} câu hỏi. Bỏ qua {result.skipped.length} dòng.
          </p>
        ) : null}
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      </div>

      <div className="space-y-3">
        <textarea
          className="min-h-36 w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Dán nội dung CSV vào đây..."
          value={csvText}
          onChange={(event) => {
            setCsvText(event.target.value);
            setResult(null);
          }}
        />
        <button type="button" onClick={() => void handleImportCsv()} disabled={busy || !csvText.trim() || !preview.valid} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50">
          <Upload size={16} />Nhập
        </button>
      </div>
    </section>
  );
}

function validateCsv(csvText: string) {
  const rows = parseCsv(csvText);
  if (!rows.length) return { errors: [], rows: 0, valid: false };
  const headers = Object.keys(rows[0] ?? {});
  const errors: string[] = [];

  requiredHeaders.forEach((header) => {
    if (!headers.includes(header)) errors.push(`Thiếu cột ${header}.`);
  });

  rows.slice(0, 20).forEach((row, index) => {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) errors.push(`Dòng ${index + 2}: ${parsed.error.issues[0]?.message ?? "không hợp lệ"}.`);
  });

  return { errors, rows: rows.length, valid: errors.length === 0 };
}

function parseCsv(csv: string) {
  const normalized = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = normalized.includes("\t") && !normalized.includes(",") ? "\t" : ",";
  const rawRows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") quoted = true;
    else if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rawRows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rawRows.push(row);
  }

  const [headerRow, ...dataRows] = rawRows.filter((entry) => entry.some(Boolean));
  if (!headerRow) return [];
  const headers = headerRow.map(normalizeHeader);

  return dataRows.map((dataRow) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = dataRow[index]?.trim() ?? "";
    });
    return record;
  });
}

function normalizeHeader(value: string) {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
