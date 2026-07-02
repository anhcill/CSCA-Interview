"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

type DegreeLevel = "BACHELOR" | "MASTER";

type Major = {
  careerOutcomes?: string | null;
  degreeLevel: DegreeLevel;
  description?: string | null;
  id: string;
  interviewFocus?: string | null;
  isActive: boolean;
  name: string;
  nameEn?: string | null;
  nameZh?: string | null;
  requirements?: string | null;
  researchAreas?: string | null;
  researchLabs?: string | null;
};

type MajorForm = Omit<Major, "id" | "isActive">;
type ListResponse = { data: Major[]; total: number; totalPages: number };

const empty: MajorForm = {
  careerOutcomes: "",
  degreeLevel: "BACHELOR",
  description: "",
  interviewFocus: "",
  name: "",
  nameEn: "",
  nameZh: "",
  requirements: "",
  researchAreas: "",
  researchLabs: ""
};

export default function AdminMajorsPage() {
  const [majors, setMajors] = useState<Major[]>([]);
  const [form, setForm] = useState<MajorForm>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterDegree, setFilterDegree] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const token = getAuthToken();

  const load = useCallback(async () => {
    try {
      let url = `/api/majors?active=all&page=${page}&limit=50&search=${encodeURIComponent(debouncedSearch)}`;
      if (filterDegree) url += `&degreeLevel=${filterDegree}`;
      const data = await apiGet<ListResponse>(url, { token });
      setMajors(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải ngành");
    }
  }, [debouncedSearch, filterDegree, page, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editId) await apiPut(`/api/majors/${editId}`, form, { token });
      else await apiPost("/api/majors", form, { token });
      setForm(empty);
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu ngành");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(major: Major) {
    setEditId(major.id);
    setForm({
      careerOutcomes: major.careerOutcomes || "",
      degreeLevel: major.degreeLevel,
      description: major.description || "",
      interviewFocus: major.interviewFocus || "",
      name: major.name,
      nameEn: major.nameEn || "",
      nameZh: major.nameZh || "",
      requirements: major.requirements || "",
      researchAreas: major.researchAreas || "",
      researchLabs: major.researchLabs || ""
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa ngành này?")) return;
    try {
      await apiDelete(`/api/majors/${id}`, { token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa ngành");
    }
  }

  async function handleToggle(major: Major) {
    try {
      await apiPut(`/api/majors/${major.id}`, { isActive: !major.isActive }, { token });
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
          <h1 className="mt-1 text-2xl font-bold">Quản lý ngành</h1>
          <p className="mt-1 text-sm text-slate-500">Context ngành giúp AI hỏi sâu hơn về research, nền tảng và kế hoạch học.</p>
        </div>
      </div>

      {error ? <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded border bg-white p-5 md:grid-cols-3">
        <TextField label="Tên ngành *" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <TextField label="Tên tiếng Trung" value={form.nameZh || ""} onChange={(value) => setForm({ ...form, nameZh: value })} />
        <TextField label="Tên tiếng Anh" value={form.nameEn || ""} onChange={(value) => setForm({ ...form, nameEn: value })} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-600">Bậc học</span>
          <select className="w-full rounded border px-3 py-2" value={form.degreeLevel} onChange={(event) => setForm({ ...form, degreeLevel: event.target.value as DegreeLevel })}>
            <option value="BACHELOR">Đại học</option>
            <option value="MASTER">Thạc sĩ</option>
          </select>
        </label>
        <TextArea label="Mô tả" value={form.description || ""} onChange={(value) => setForm({ ...form, description: value })} />
        <TextArea label="Yêu cầu nền tảng" value={form.requirements || ""} onChange={(value) => setForm({ ...form, requirements: value })} />
        <TextArea label="Hướng nghiên cứu" value={form.researchAreas || ""} onChange={(value) => setForm({ ...form, researchAreas: value })} />
        <TextArea label="Lab/viện nghiên cứu" value={form.researchLabs || ""} onChange={(value) => setForm({ ...form, researchLabs: value })} />
        <TextArea label="Đầu ra nghề nghiệp" value={form.careerOutcomes || ""} onChange={(value) => setForm({ ...form, careerOutcomes: value })} />
        <TextArea label="Trọng tâm phỏng vấn" value={form.interviewFocus || ""} onChange={(value) => setForm({ ...form, interviewFocus: value })} />
        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">
            {editId ? "Cập nhật" : "Thêm mới"}
          </button>
          {editId ? <button type="button" onClick={() => { setEditId(null); setForm(empty); }} className="rounded border px-4 py-2 hover:bg-slate-50">Hủy</button> : null}
        </div>
      </form>

      <div className="mb-4 flex gap-3">
        <input className="flex-1 rounded border px-3 py-2" placeholder="Tìm kiếm ngành..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select className="rounded border px-3 py-2" value={filterDegree} onChange={(event) => { setFilterDegree(event.target.value); setPage(1); }}>
          <option value="">Tất cả bậc</option>
          <option value="BACHELOR">Đại học</option>
          <option value="MASTER">Thạc sĩ</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Tên TQ</th>
              <th className="px-3 py-2">Bậc</th>
              <th className="px-3 py-2">RAG</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {majors.map((major) => (
              <tr key={major.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{major.name}</td>
                <td className="px-3 py-2 text-slate-500">{major.nameZh || "—"}</td>
                <td className="px-3 py-2">{major.degreeLevel === "BACHELOR" ? "Đại học" : "Thạc sĩ"}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{major.researchAreas || major.researchLabs || major.interviewFocus ? "Có context" : "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${major.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {major.isActive ? "Hoạt động" : "Tắt"}
                  </span>
                </td>
                <td className="flex gap-2 px-3 py-2">
                  <button type="button" onClick={() => void handleToggle(major)} className="text-xs text-emerald-700 hover:underline">{major.isActive ? "Tắt" : "Bật"}</button>
                  <button type="button" onClick={() => startEdit(major)} className="text-xs text-indigo-600 hover:underline">Sửa</button>
                  <button type="button" onClick={() => void handleDelete(major.id)} className="text-xs text-red-600 hover:underline">Xóa</button>
                </td>
              </tr>
            ))}
            {majors.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Chưa có ngành nào</td></tr> : null}
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

function TextField({
  label,
  onChange,
  required = false,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
      <input className="w-full rounded border px-3 py-2" placeholder={label} required={required} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
      <textarea className="w-full rounded border px-3 py-2" placeholder={label} rows={2} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
