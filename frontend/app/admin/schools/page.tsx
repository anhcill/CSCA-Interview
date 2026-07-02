"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

type School = {
  achievements?: string | null;
  admissionRequirements?: string | null;
  campusInfo?: string | null;
  city?: string | null;
  description?: string | null;
  id: string;
  interviewTips?: string | null;
  isActive: boolean;
  name: string;
  nameEn?: string | null;
  nameZh?: string | null;
  notableAlumni?: string | null;
  programLanguage?: string | null;
  province?: string | null;
  ranking?: number | null;
  rankingType?: string | null;
  researchAreas?: string | null;
  strongMajors?: string | null;
  websiteUrl?: string | null;
};

type SchoolForm = Omit<School, "id" | "isActive" | "ranking"> & { ranking: string };
type ListResponse = { data: School[]; total: number; totalPages: number };

const empty: SchoolForm = {
  achievements: "",
  admissionRequirements: "",
  campusInfo: "",
  city: "",
  description: "",
  interviewTips: "",
  name: "",
  nameEn: "",
  nameZh: "",
  notableAlumni: "",
  programLanguage: "",
  province: "",
  ranking: "",
  rankingType: "",
  researchAreas: "",
  strongMajors: "",
  websiteUrl: ""
};

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState<SchoolForm>(empty);
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
      const data = await apiGet<ListResponse>(`/api/schools?active=all&page=${page}&limit=50&search=${encodeURIComponent(debouncedSearch)}`, { token });
      setSchools(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải trường");
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
      const payload = { ...form, ranking: form.ranking ? Number(form.ranking) : null };
      if (editId) await apiPut(`/api/schools/${editId}`, payload, { token });
      else await apiPost("/api/schools", payload, { token });
      setForm(empty);
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu trường");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(school: School) {
    setEditId(school.id);
    setForm({
      achievements: school.achievements || "",
      admissionRequirements: school.admissionRequirements || "",
      campusInfo: school.campusInfo || "",
      city: school.city || "",
      description: school.description || "",
      interviewTips: school.interviewTips || "",
      name: school.name,
      nameEn: school.nameEn || "",
      nameZh: school.nameZh || "",
      notableAlumni: school.notableAlumni || "",
      programLanguage: school.programLanguage || "",
      province: school.province || "",
      ranking: school.ranking?.toString() || "",
      rankingType: school.rankingType || "",
      researchAreas: school.researchAreas || "",
      strongMajors: school.strongMajors || "",
      websiteUrl: school.websiteUrl || ""
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa trường này?")) return;
    try {
      await apiDelete(`/api/schools/${id}`, { token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa trường");
    }
  }

  async function handleToggle(school: School) {
    try {
      await apiPut(`/api/schools/${school.id}`, { isActive: !school.isActive }, { token });
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
          <h1 className="mt-1 text-2xl font-bold">Quản lý trường</h1>
          <p className="mt-1 text-sm text-slate-500">Dữ liệu này được dùng làm RAG context cho AI hỏi và chấm sát trường.</p>
        </div>
      </div>

      {error ? <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded border bg-white p-5 md:grid-cols-3">
        <TextField label="Tên trường *" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <TextField label="Tên tiếng Trung" value={form.nameZh || ""} onChange={(value) => setForm({ ...form, nameZh: value })} />
        <TextField label="Tên tiếng Anh" value={form.nameEn || ""} onChange={(value) => setForm({ ...form, nameEn: value })} />
        <TextField label="Thành phố" value={form.city || ""} onChange={(value) => setForm({ ...form, city: value })} />
        <TextField label="Tỉnh/Bang" value={form.province || ""} onChange={(value) => setForm({ ...form, province: value })} />
        <TextField label="Website" value={form.websiteUrl || ""} onChange={(value) => setForm({ ...form, websiteUrl: value })} />
        <TextField label="Ranking" value={form.ranking} onChange={(value) => setForm({ ...form, ranking: value })} type="number" />
        <TextField label="Loại ranking" value={form.rankingType || ""} onChange={(value) => setForm({ ...form, rankingType: value })} placeholder="QS 2026, China ranking..." />
        <TextField label="Ngôn ngữ chương trình" value={form.programLanguage || ""} onChange={(value) => setForm({ ...form, programLanguage: value })} placeholder="EN, ZH, mixed..." />
        <TextArea label="Mô tả" value={form.description || ""} onChange={(value) => setForm({ ...form, description: value })} />
        <TextArea label="Ngành mạnh" value={form.strongMajors || ""} onChange={(value) => setForm({ ...form, strongMajors: value })} />
        <TextArea label="Hướng nghiên cứu" value={form.researchAreas || ""} onChange={(value) => setForm({ ...form, researchAreas: value })} />
        <TextArea label="Yêu cầu đầu vào" value={form.admissionRequirements || ""} onChange={(value) => setForm({ ...form, admissionRequirements: value })} />
        <TextArea label="Tips phỏng vấn trường" value={form.interviewTips || ""} onChange={(value) => setForm({ ...form, interviewTips: value })} />
        <TextArea label="Campus info" value={form.campusInfo || ""} onChange={(value) => setForm({ ...form, campusInfo: value })} />
        <TextArea label="Cựu sinh viên nổi bật" value={form.notableAlumni || ""} onChange={(value) => setForm({ ...form, notableAlumni: value })} />
        <TextArea label="Thành tích/điểm nổi bật" value={form.achievements || ""} onChange={(value) => setForm({ ...form, achievements: value })} />

        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">
            {editId ? "Cập nhật" : "Thêm mới"}
          </button>
          {editId ? <button type="button" onClick={() => { setEditId(null); setForm(empty); }} className="rounded border px-4 py-2 hover:bg-slate-50">Hủy</button> : null}
        </div>
      </form>

      <input className="mb-4 w-full rounded border px-3 py-2" placeholder="Tìm kiếm trường..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Tên TQ</th>
              <th className="px-3 py-2">Thành phố</th>
              <th className="px-3 py-2">RAG</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((school) => (
              <tr key={school.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{school.name}</td>
                <td className="px-3 py-2 text-slate-500">{school.nameZh || "—"}</td>
                <td className="px-3 py-2">{school.city || "—"}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {school.ranking ? `#${school.ranking} ${school.rankingType || ""}` : school.strongMajors || school.researchAreas ? "Có context" : "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${school.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {school.isActive ? "Hoạt động" : "Tắt"}
                  </span>
                </td>
                <td className="flex gap-2 px-3 py-2">
                  <button type="button" onClick={() => void handleToggle(school)} className="text-xs text-emerald-700 hover:underline">{school.isActive ? "Tắt" : "Bật"}</button>
                  <button type="button" onClick={() => startEdit(school)} className="text-xs text-indigo-600 hover:underline">Sửa</button>
                  <button type="button" onClick={() => void handleDelete(school.id)} className="text-xs text-red-600 hover:underline">Xóa</button>
                </td>
              </tr>
            ))}
            {schools.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Chưa có trường nào</td></tr> : null}
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
  placeholder,
  required = false,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
      <input className="w-full rounded border px-3 py-2" placeholder={placeholder || label} required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
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
