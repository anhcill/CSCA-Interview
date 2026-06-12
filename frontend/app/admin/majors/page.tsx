"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import Link from "next/link";

type Major = {
  id: string;
  name: string;
  nameZh?: string | null;
  nameEn?: string | null;
  degreeLevel: "BACHELOR" | "MASTER";
  description?: string | null;
  isActive: boolean;
};

const empty = { name: "", nameZh: "", nameEn: "", degreeLevel: "BACHELOR" as "BACHELOR" | "MASTER", description: "" };
type ListResponse = { data: Major[]; total: number; totalPages: number };

export default function AdminMajorsPage() {
  const [majors, setMajors] = useState<Major[]>([]);
  const [form, setForm] = useState(empty);
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
      const data = await apiGet<ListResponse>(url);
      setMajors(data.data);
      setTotalPages(data.totalPages);
    } catch (e: any) { setError(e.message); }
  }, [debouncedSearch, filterDegree, page]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      if (editId) {
        await apiPut(`/api/majors/${editId}`, form, { token });
      } else {
        await apiPost("/api/majors", form, { token });
      }
      setForm(empty); setEditId(null);
      await load();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  function startEdit(m: Major) {
    setEditId(m.id);
    setForm({ name: m.name, nameZh: m.nameZh || "", nameEn: m.nameEn || "", degreeLevel: m.degreeLevel, description: m.description || "" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá ngành này?")) return;
    try {
      await apiDelete(`/api/majors/${id}`, { token });
      await load();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold mt-1">Quản lý ngành</h1>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700 text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded border bg-white p-5 md:grid-cols-3">
        <input className="border rounded px-3 py-2" placeholder="Tên ngành *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input className="border rounded px-3 py-2" placeholder="Tên tiếng Trung" value={form.nameZh || ""} onChange={e => setForm({ ...form, nameZh: e.target.value })} />
        <input className="border rounded px-3 py-2" placeholder="Tên tiếng Anh" value={form.nameEn || ""} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
        <select className="border rounded px-3 py-2" value={form.degreeLevel} onChange={e => setForm({ ...form, degreeLevel: e.target.value as any })}>
          <option value="BACHELOR">Đại học</option>
          <option value="MASTER">Thạc sĩ</option>
        </select>
        <textarea className="border rounded px-3 py-2" placeholder="Mô tả" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">
            {editId ? "Cập nhật" : "Thêm mới"}
          </button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm(empty); }} className="rounded border px-4 py-2 hover:bg-slate-50">Huỷ</button>}
        </div>
      </form>

      <div className="mb-4 flex gap-3">
        <input className="flex-1 border rounded px-3 py-2" placeholder="Tìm kiếm ngành..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="border rounded px-3 py-2" value={filterDegree} onChange={e => { setFilterDegree(e.target.value); setPage(1); }}>
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
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {majors.map(m => (
              <tr key={m.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2 text-slate-500">{m.nameZh || "—"}</td>
                <td className="px-3 py-2">{m.degreeLevel === "BACHELOR" ? "Đại học" : "Thạc sĩ"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${m.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {m.isActive ? "Hoạt động" : "Tắt"}
                  </span>
                </td>
                <td className="px-3 py-2 flex gap-2">
                  <button onClick={() => startEdit(m)} className="text-indigo-600 hover:underline text-xs">Sửa</button>
                  <button onClick={() => handleDelete(m.id)} className="text-red-600 hover:underline text-xs">Xoá</button>
                </td>
              </tr>
            ))}
            {majors.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Chưa có ngành nào</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Prev</button>
        <span className="text-sm font-bold">{page}/{totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Next</button>
      </div>
    </main>
  );
}
