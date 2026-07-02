"use client";

import { BookOpen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";

type QuestionTag = {
  _count: { question_tag_links: number };
  created_at: string;
  description?: string | null;
  id: string;
  name: string;
};

type TagsResponse = { data: QuestionTag[] };

const emptyForm = { description: "", name: "" };

export default function AdminTagsPage() {
  const [tags, setTags] = useState<QuestionTag[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const token = getAuthToken();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<TagsResponse>("/api/admin/question-tags", { token });
      setTags(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải tags");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { description: form.description || null, name: form.name };
      if (editId) {
        await apiPut(`/api/admin/question-tags/${editId}`, body, { token });
      } else {
        await apiPost("/api/admin/question-tags", body, { token });
      }
      setForm(emptyForm);
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu tag");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tag: QuestionTag) {
    if (!confirm(`Xóa tag ${tag.name}?`)) return;
    setError("");
    try {
      await apiDelete(`/api/admin/question-tags/${tag.id}`, { token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa tag");
    }
  }

  function startEdit(tag: QuestionTag) {
    setEditId(tag.id);
    setForm({ description: tag.description ?? "", name: tag.name });
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Tag câu hỏi</h1>
          <p className="mt-1 text-sm text-slate-500">{tags.length} tag</p>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-lg border bg-white p-5 md:grid-cols-[240px_1fr_auto]">
        <input className="min-h-10 rounded-lg border px-3 text-sm" placeholder="Tag name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <input className="min-h-10 rounded-lg border px-3 text-sm" placeholder="Dễscription" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">
            <BookOpen size={15} />
            {editId ? "Cập nhật" : "Thêm"}
          </button>
          {editId ? <button type="button" onClick={() => { setEditId(null); setForm(emptyForm); }} className="min-h-10 rounded-lg border px-4 text-sm font-bold">Hủy</button> : null}
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border bg-white">
        {loading ? (
          <div className="p-4"><ListSkeleton rows={6} /></div>
        ) : tags.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Dễscription</th>
                  <th className="px-4 py-3">Questions</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold">{tag.name}</td>
                    <td className="px-4 py-3 text-slate-600">{tag.description || "-"}</td>
                    <td className="px-4 py-3">{tag._count.question_tag_links}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(tag.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button type="button" onClick={() => startEdit(tag)} className="text-xs font-bold text-indigo-700 hover:underline">Sửa</button>
                        <button type="button" onClick={() => void handleDelete(tag)} className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:underline">
                          <Trash2 size={13} />
                          X?a
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6"><EmptyState title="Chưa có tag" description="Thêm tag dau tien bang form ben tren." /></div>
        )}
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
