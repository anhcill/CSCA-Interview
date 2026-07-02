"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

type Scholarship = {
  code?: string | null;
  commonInterviewQuestions?: unknown;
  coverage?: string | null;
  deadline?: string | null;
  description?: string | null;
  id: string;
  interviewFormat?: string | null;
  isActive: boolean;
  name: string;
  requirements?: string | null;
  studyPlanRequirements?: string | null;
  tips?: string | null;
};

type ScholarshipForm = Omit<Scholarship, "id" | "isActive" | "commonInterviewQuestions"> & {
  commonInterviewQuestions: string;
};
type ListResponse = { data: Scholarship[]; total: number; totalPages: number };

const empty: ScholarshipForm = {
  code: "",
  commonInterviewQuestions: "",
  coverage: "",
  deadline: "",
  description: "",
  interviewFormat: "",
  name: "",
  requirements: "",
  studyPlanRequirements: "",
  tips: ""
};

export default function AdminScholarshipsPage() {
  const [items, setItems] = useState<Scholarship[]>([]);
  const [form, setForm] = useState<ScholarshipForm>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const token = getAuthToken();

  const load = useCallback(async () => {
    try {
      const data = await apiGet<ListResponse>(`/api/scholarships?active=all&page=${page}&limit=50&search=${encodeURIComponent(debouncedSearch)}`, { token });
      setItems(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải học bổng");
    }
  }, [debouncedSearch, page, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editId) await apiPut(`/api/scholarships/${editId}`, form, { token });
      else await apiPost("/api/scholarships", form, { token });
      setForm(empty);
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu học bổng");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(scholarship: Scholarship) {
    setEditId(scholarship.id);
    setForm({
      code: scholarship.code || "",
      commonInterviewQuestions: formatCommonQuestions(scholarship.commonInterviewQuestions),
      coverage: scholarship.coverage || "",
      deadline: scholarship.deadline || "",
      description: scholarship.description || "",
      interviewFormat: scholarship.interviewFormat || "",
      name: scholarship.name,
      requirements: scholarship.requirements || "",
      studyPlanRequirements: scholarship.studyPlanRequirements || "",
      tips: scholarship.tips || ""
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa học bổng này?")) return;
    try {
      await apiDelete(`/api/scholarships/${id}`, { token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa học bổng");
    }
  }

  async function handleToggle(scholarship: Scholarship) {
    try {
      await apiPut(`/api/scholarships/${scholarship.id}`, { isActive: !scholarship.isActive }, { token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <div>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">← Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Quản lý học bổng</h1>
          <p className="mt-1 text-sm text-slate-500">AI dùng dữ liệu này để hỏi/chấm sát yêu cầu học bổng.</p>
        </div>
      </div>

      {error ? <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded border bg-white p-5 md:grid-cols-3">
        <TextField label="Tên học bổng *" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <TextField label="Mã" value={form.code || ""} onChange={(value) => setForm({ ...form, code: value })} placeholder="CSC, ASEAN..." />
        <TextField label="Deadline" value={form.deadline || ""} onChange={(value) => setForm({ ...form, deadline: value })} placeholder="2026-03-31 hoặc varies by school" />
        <TextArea label="Mô tả" value={form.description || ""} onChange={(value) => setForm({ ...form, description: value })} />
        <TextArea label="Yêu cầu" value={form.requirements || ""} onChange={(value) => setForm({ ...form, requirements: value })} />
        <TextArea label="Coverage" value={form.coverage || ""} onChange={(value) => setForm({ ...form, coverage: value })} />
        <TextArea label="Yêu cầu study plan" value={form.studyPlanRequirements || ""} onChange={(value) => setForm({ ...form, studyPlanRequirements: value })} />
        <TextArea label="Hình thức phỏng vấn" value={form.interviewFormat || ""} onChange={(value) => setForm({ ...form, interviewFormat: value })} />
        <TextArea label="Câu hỏi thường gặp" value={form.commonInterviewQuestions} onChange={(value) => setForm({ ...form, commonInterviewQuestions: value })} placeholder="Mỗi dòng một câu hoặc JSON array" />
        <TextArea label="Tips học bổng" value={form.tips || ""} onChange={(value) => setForm({ ...form, tips: value })} />

        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">
            {editId ? "Cập nhật" : "Thêm mới"}
          </button>
          {editId ? <button type="button" onClick={() => { setEditId(null); setForm(empty); }} className="rounded border px-4 py-2 hover:bg-slate-50">Hủy</button> : null}
        </div>
      </form>

      <input className="mb-4 w-full rounded border px-3 py-2" placeholder="Tìm kiếm học bổng..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">RAG</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((scholarship) => (
              <tr key={scholarship.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{scholarship.name}</td>
                <td className="px-3 py-2 text-slate-500">{scholarship.code || "—"}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{scholarship.requirements || scholarship.coverage || scholarship.interviewFormat ? "Có context" : "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${scholarship.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {scholarship.isActive ? "Hoạt động" : "Tắt"}
                  </span>
                </td>
                <td className="flex gap-2 px-3 py-2">
                  <button type="button" onClick={() => void handleToggle(scholarship)} className="text-xs text-emerald-700 hover:underline">{scholarship.isActive ? "Tắt" : "Bật"}</button>
                  <button type="button" onClick={() => startEdit(scholarship)} className="text-xs text-indigo-600 hover:underline">Sửa</button>
                  <button type="button" onClick={() => void handleDelete(scholarship.id)} className="text-xs text-red-600 hover:underline">Xóa</button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Chưa có học bổng nào</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Trước</button>
        <span className="text-sm font-bold">{page}/{totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Sau</button>
      </div>
    </main>
  );
}

function formatCommonQuestions(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join("\n");
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function TextField({
  label,
  onChange,
  placeholder,
  required = false,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
      <input className="w-full rounded border px-3 py-2" placeholder={placeholder || label} required={required} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
      <textarea className="w-full rounded border px-3 py-2" placeholder={placeholder || label} rows={2} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
