"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import Link from "next/link";

type Scholarship = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive: boolean;
};

const empty = { name: "", code: "", description: "" };
type ListResponse = { data: Scholarship[]; total: number; totalPages: number };

export default function AdminScholarshipsPage() {
  const [items, setItems] = useState<Scholarship[]>([]);
  const [form, setForm] = useState(empty);
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
      const data = await apiGet<ListResponse>(`/api/scholarships?active=all&page=${page}&limit=50&search=${encodeURIComponent(debouncedSearch)}`);
      setItems(data.data);
      setTotalPages(data.totalPages);
    } catch (e: any) { setError(e.message); }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      if (editId) {
        await apiPut(`/api/scholarships/${editId}`, form, { token });
      } else {
        await apiPost("/api/scholarships", form, { token });
      }
      setForm(empty); setEditId(null);
      await load();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  function startEdit(s: Scholarship) {
    setEditId(s.id);
    setForm({ name: s.name, code: s.code || "", description: s.description || "" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoá học bổng này?")) return;
    try {
      await apiDelete(`/api/scholarships/${id}`, { token });
      await load();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div>
          <Link href="/admin" className="text-sm text-indigo-600 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-bold mt-1">Quản lý học bổng</h1>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700 text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded border bg-white p-5 md:grid-cols-3">
        <input className="border rounded px-3 py-2" placeholder="Tên học bổng *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input className="border rounded px-3 py-2" placeholder="Mã (CSC, ASEAN...)" value={form.code || ""} onChange={e => setForm({ ...form, code: e.target.value })} />
        <textarea className="border rounded px-3 py-2" placeholder="Mô tả" value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
        <div className="flex items-end gap-2">
          <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">
            {editId ? "Cập nhật" : "Thêm mới"}
          </button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm(empty); }} className="rounded border px-4 py-2 hover:bg-slate-50">Huỷ</button>}
        </div>
      </form>

      <input className="mb-4 w-full border rounded px-3 py-2" placeholder="Tìm kiếm học bổng..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Mô tả</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-slate-500">{s.code || "—"}</td>
                <td className="px-3 py-2 max-w-xs truncate">{s.description || "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {s.isActive ? "Hoạt động" : "Tắt"}
                  </span>
                </td>
                <td className="px-3 py-2 flex gap-2">
                  <button onClick={() => startEdit(s)} className="text-indigo-600 hover:underline text-xs">Sửa</button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:underline text-xs">Xoá</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Chưa có học bổng nào</td></tr>}
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
