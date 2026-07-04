"use client";

import { Bot, Settings } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AiModelRouterPanel } from "@/components/admin/ai-model-router-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";

type SystemSetting = {
  created_at: string;
  description?: string | null;
  id: string;
  setting_key: string;
  setting_value: unknown;
  updated_at: string;
  users?: { email: string; fullName: string; id: string } | null;
};

type PromptTemplate = {
  created_at: string;
  id: string;
  is_active: boolean;
  name: string;
  output_schema?: unknown;
  system_prompt: string;
  task_type: string;
  updated_at: string;
  user_prompt_template: string;
  version: number;
};

type SettingsResponse = { data: SystemSetting[] };
type PromptResponse = { data: PromptTemplate[]; taskTypes: string[] };

const emptySetting = { description: "", key: "", value: "{\n  \"enabled\": true\n}" };
const emptyPrompt = {
  isActive: true,
  name: "",
  outputSchema: "",
  systemPrompt: "",
  taskType: "SCORE_ANSWER",
  userPromptTemplate: "",
  version: 1
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [taskTypes, setTaskTypes] = useState<string[]>(["SCORE_ANSWER"]);
  const [settingForm, setSettingForm] = useState(emptySetting);
  const [promptForm, setPromptForm] = useState(emptyPrompt);
  const [editPromptId, setEditPromptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const token = getAuthToken();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSettings, nextPrompts] = await Promise.all([
        apiGet<SettingsResponse>("/api/admin/settings", { token }),
        apiGet<PromptResponse>("/api/admin/prompt-templates", { token })
      ]);
      setSettings(nextSettings.data);
      setTemplates(nextPrompts.data);
      setTaskTypes(nextPrompts.taskTypes);
      if (nextPrompts.taskTypes[0]) {
        setPromptForm((current) => nextPrompts.taskTypes.includes(current.taskType) ? current : { ...current, taskType: nextPrompts.taskTypes[0] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải settings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSetting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiPut(`/api/admin/settings/${encodeURIComponent(settingForm.key.trim())}`, {
        description: settingForm.description || null,
        settingValue: parseJsonValue(settingForm.value)
      }, { token });
      setSettingForm(emptySetting);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu setting");
    } finally {
      setSaving(false);
    }
  }

  async function savePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      isActive: promptForm.isActive,
      name: promptForm.name,
      outputSchema: promptForm.outputSchema ? parseJsonValue(promptForm.outputSchema) : null,
      systemPrompt: promptForm.systemPrompt,
      taskType: promptForm.taskType,
      userPromptTemplate: promptForm.userPromptTemplate,
      version: Number(promptForm.version) || 1
    };

    try {
      if (editPromptId) {
        await apiPut(`/api/admin/prompt-templates/${editPromptId}`, body, { token });
      } else {
        await apiPost("/api/admin/prompt-templates", body, { token });
      }
      setPromptForm(emptyPrompt);
      setEditPromptId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu prompt template");
    } finally {
      setSaving(false);
    }
  }

  function editSetting(setting: SystemSetting) {
    setSettingForm({
      description: setting.description ?? "",
      key: setting.setting_key,
      value: JSON.stringify(setting.setting_value, null, 2)
    });
  }

  function editPrompt(template: PromptTemplate) {
    setEditPromptId(template.id);
    setPromptForm({
      isActive: template.is_active,
      name: template.name,
      outputSchema: template.output_schema ? JSON.stringify(template.output_schema, null, 2) : "",
      systemPrompt: template.system_prompt,
      taskType: template.task_type,
      userPromptTemplate: template.user_prompt_template,
      version: template.version
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-indigo-600 hover:underline">&larr; Admin</Link>
          <h1 className="mt-1 text-2xl font-bold">Settings & AI</h1>
          <p className="mt-1 text-sm text-slate-500">System settings và AI prompt templates.</p>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <AiModelRouterPanel token={token} onSaved={load} />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Settings size={18} />System setting</h2>
          <form onSubmit={saveSetting} className="mt-4 space-y-3">
            <input className="min-h-10 w-full rounded-lg border px-3 text-sm" placeholder="setting_key" value={settingForm.key} onChange={(event) => setSettingForm({ ...settingForm, key: event.target.value })} required />
            <input className="min-h-10 w-full rounded-lg border px-3 text-sm" placeholder="Mô tả" value={settingForm.description} onChange={(event) => setSettingForm({ ...settingForm, description: event.target.value })} />
            <textarea className="min-h-40 w-full rounded-lg border px-3 py-2 font-mono text-xs" value={settingForm.value} onChange={(event) => setSettingForm({ ...settingForm, value: event.target.value })} />
            <button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">
              <Settings size={16} />
              Lưu setting
            </button>
          </form>
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-bold">Settings hiện có</h2>
          {loading ? <div className="mt-4"><ListSkeleton rows={4} /></div> : settings.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Updated</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.map((setting) => (
                    <tr key={setting.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs font-bold">{setting.setting_key}</td>
                      <td className="max-w-md truncate px-3 py-2 font-mono text-xs">{JSON.stringify(setting.setting_value)}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{formatDate(setting.updated_at)}</td>
                      <td className="px-3 py-2"><button type="button" onClick={() => editSetting(setting)} className="text-xs font-bold text-indigo-700 hover:underline">Sửa</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="mt-4"><EmptyState title="Chưa có setting" description="Tạo setting đầu tiên bên trái." /></div>}
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Bot size={18} />AI prompt template</h2>
        <form onSubmit={savePrompt} className="mt-4 grid gap-3 lg:grid-cols-2">
          <input className="min-h-10 rounded-lg border px-3 text-sm" placeholder="Name" value={promptForm.name} onChange={(event) => setPromptForm({ ...promptForm, name: event.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-[1fr_110px_120px]">
            <select className="min-h-10 rounded-lg border px-3 text-sm" value={promptForm.taskType} onChange={(event) => setPromptForm({ ...promptForm, taskType: event.target.value })}>
              {taskTypes.map((taskType) => <option key={taskType} value={taskType}>{taskType}</option>)}
            </select>
            <input className="min-h-10 rounded-lg border px-3 text-sm" min={1} type="number" value={promptForm.version} onChange={(event) => setPromptForm({ ...promptForm, version: Number(event.target.value) })} />
            <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm">
              <input checked={promptForm.isActive} type="checkbox" onChange={(event) => setPromptForm({ ...promptForm, isActive: event.target.checked })} />
              Active
            </label>
          </div>
          <textarea className="min-h-44 rounded-lg border px-3 py-2 text-sm" placeholder="System prompt" value={promptForm.systemPrompt} onChange={(event) => setPromptForm({ ...promptForm, systemPrompt: event.target.value })} required />
          <textarea className="min-h-44 rounded-lg border px-3 py-2 text-sm" placeholder="User prompt template" value={promptForm.userPromptTemplate} onChange={(event) => setPromptForm({ ...promptForm, userPromptTemplate: event.target.value })} required />
          <textarea className="min-h-28 rounded-lg border px-3 py-2 font-mono text-xs lg:col-span-2" placeholder="Output schema JSON" value={promptForm.outputSchema} onChange={(event) => setPromptForm({ ...promptForm, outputSchema: event.target.value })} />
          <div className="flex gap-2 lg:col-span-2">
            <button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">
              <Settings size={16} />
              {editPromptId ? "Cập nhật template" : "Thêm template"}
            </button>
            {editPromptId ? <button type="button" onClick={() => { setEditPromptId(null); setPromptForm(emptyPrompt); }} className="min-h-10 rounded-lg border px-4 text-sm font-bold">Hủy</button> : null}
          </div>
        </form>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border bg-white">
        {loading ? <div className="p-4"><ListSkeleton rows={6} /></div> : templates.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{template.task_type}</td>
                    <td className="px-4 py-3 font-bold">{template.name}</td>
                    <td className="px-4 py-3">{template.version}</td>
                    <td className="px-4 py-3">{template.is_active ? "Active" : "Off"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(template.updated_at)}</td>
                    <td className="px-4 py-3"><button type="button" onClick={() => editPrompt(template)} className="text-xs font-bold text-indigo-700 hover:underline">Sửa</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-6"><EmptyState title="Chưa có prompt template" description="Tạo template đầu tiên ở form bên trên." /></div>}
      </section>
    </main>
  );
}

function parseJsonValue(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
