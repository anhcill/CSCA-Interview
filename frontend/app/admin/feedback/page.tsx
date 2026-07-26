"use client";

import { Check, MessageSquareText, RefreshCw, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ListSkeleton } from "@/components/ui/skeleton";
import { apiGet, apiPut } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-client";

type TesterExperienceConfig = {
  feedbackEnabled: boolean;
  feedbackTitle: string;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  welcomeTitle: string;
};

type SystemSetting = {
  setting_key: string;
  setting_value: unknown;
};

type SiteFeedback = {
  admin_note?: string | null;
  category?: string | null;
  created_at: string;
  id: string;
  message: string;
  page_url?: string | null;
  rating?: number | null;
  status: "NEW" | "REVIEWED" | "RESOLVED";
  users?: { email: string; fullName: string; id: string } | null;
};

type FeedbackResponse = {
  data: SiteFeedback[];
  total: number;
};

const settingKey = "tester_experience";
const defaultConfig: TesterExperienceConfig = {
  feedbackEnabled: true,
  feedbackTitle: "Góp ý cho MOLY",
  welcomeEnabled: true,
  welcomeMessage: "Chúc bạn một ngày Chủ nhật vui vẻ, tràn đầy năng lượng và có buổi trải nghiệm thật hiệu quả!",
  welcomeTitle: "Chào mừng bạn đến với MOLY!"
};
const statuses = [
  { label: "Mới", value: "NEW" },
  { label: "Đã xem", value: "REVIEWED" },
  { label: "Đã xử lý", value: "RESOLVED" }
] as const;

export default function AdminFeedbackPage() {
  const token = getAuthToken();
  const [config, setConfig] = useState(defaultConfig);
  const [feedback, setFeedback] = useState<SiteFeedback[]>([]);
  const [filter, setFilter] = useState<"ALL" | SiteFeedback["status"]>("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsResponse, feedbackResponse] = await Promise.all([
        apiGet<{ data: SystemSetting[] }>("/api/admin/settings", { cacheMs: 0, token }),
        apiGet<FeedbackResponse>("/api/admin/site-feedback?limit=100", { cacheMs: 0, token })
      ]);
      const stored = settingsResponse.data.find((item) => item.setting_key === settingKey)?.setting_value;
      setConfig(readConfig(stored));
      setFeedback(feedbackResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu đợt test.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleFeedback = useMemo(
    () => filter === "ALL" ? feedback : feedback.filter((item) => item.status === filter),
    [feedback, filter]
  );
  const newCount = feedback.filter((item) => item.status === "NEW").length;

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiPut(`/api/admin/settings/${settingKey}`, {
        description: "Cấu hình lời chào và kênh góp ý cho các đợt trải nghiệm",
        settingValue: config
      }, { token });
      setNotice("Đã lưu. Thay đổi có hiệu lực cho người dùng ngay.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(item: SiteFeedback, status: SiteFeedback["status"]) {
    setError("");
    try {
      await apiPut(`/api/admin/site-feedback/${item.id}`, {
        adminNote: item.admin_note ?? null,
        status
      }, { token });
      setFeedback((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật góp ý.");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Đợt trải nghiệm</p>
          <h2 className="mt-1 text-2xl font-black">Lời chào & góp ý người dùng</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Bật khi có khách test, tắt khi kết thúc đợt trải nghiệm.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black dark:border-slate-700 dark:bg-slate-900">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      {notice ? <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notice}</p> : null}

      <form onSubmit={saveConfig} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <Toggle checked={config.welcomeEnabled} label="Thông báo chào mừng sau đăng nhập" onChange={(checked) => setConfig((current) => ({ ...current, welcomeEnabled: checked }))} />
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-black">Tiêu đề</span>
              <input value={config.welcomeTitle} maxLength={120} onChange={(event) => setConfig((current) => ({ ...current, welcomeTitle: event.target.value }))} className="focus-ring min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" required />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-black">Nội dung lời chào</span>
              <textarea value={config.welcomeMessage} maxLength={500} rows={4} onChange={(event) => setConfig((current) => ({ ...current, welcomeMessage: event.target.value }))} className="focus-ring min-h-28 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold leading-6 dark:border-slate-700 dark:bg-slate-950" required />
            </label>
          </section>

          <section>
            <Toggle checked={config.feedbackEnabled} label="Hiện tab góp ý cho người dùng" onChange={(checked) => setConfig((current) => ({ ...current, feedbackEnabled: checked }))} />
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-black">Tên tab góp ý</span>
              <input value={config.feedbackTitle} maxLength={100} onChange={(event) => setConfig((current) => ({ ...current, feedbackTitle: event.target.value }))} className="focus-ring min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" required />
            </label>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              Khi tắt, nút góp ý biến mất và API cũng từ chối góp ý mới. Các góp ý cũ vẫn được giữ nguyên trong hộp thư.
            </div>
          </section>
        </div>

        <button type="submit" disabled={saving} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white disabled:opacity-60">
          <Check size={17} />
          {saving ? "Đang lưu..." : "Lưu cấu hình đợt test"}
        </button>
      </form>

      <section className="mt-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black"><MessageSquareText size={21} />Hộp thư góp ý</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{newCount} góp ý mới · {feedback.length} góp ý gần nhất</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === "ALL"} label="Tất cả" onClick={() => setFilter("ALL")} />
            {statuses.map((status) => <FilterButton key={status.value} active={filter === status.value} label={status.label} onClick={() => setFilter(status.value)} />)}
          </div>
        </div>

        {loading ? <div className="mt-5"><ListSkeleton rows={5} /></div> : visibleFeedback.length ? (
          <div className="mt-5 grid gap-4">
            {visibleFeedback.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      {item.category ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.category}</span> : null}
                      {item.rating ? <span className="inline-flex items-center gap-1 text-xs font-black text-amber-600"><Star size={14} className="fill-amber-400 text-amber-400" />{item.rating}/5</span> : null}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800 dark:text-slate-100">{item.message}</p>
                    <p className="mt-3 text-xs font-bold text-slate-500">
                      {item.users?.fullName ?? "Người dùng"} · {item.users?.email ?? "Tài khoản đã xoá"} · {formatDate(item.created_at)}
                    </p>
                    {item.page_url ? <p className="mt-1 max-w-3xl truncate text-xs font-semibold text-slate-400" title={item.page_url}>{item.page_url}</p> : null}
                  </div>
                  <select value={item.status} onChange={(event) => void updateStatus(item, event.target.value as SiteFeedback["status"])} className="focus-ring min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black dark:border-slate-700 dark:bg-slate-950">
                    {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center dark:border-slate-700 dark:bg-slate-900">
            <Check className="mx-auto text-slate-400" size={30} />
            <p className="mt-3 font-black">Chưa có góp ý ở trạng thái này</p>
          </div>
        )}
      </section>
    </main>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <span className="text-sm font-black">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-red-600" />
    </label>
  );
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`focus-ring min-h-9 rounded-lg px-3 text-xs font-black ${active ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>{label}</button>;
}

function StatusBadge({ status }: { status: SiteFeedback["status"] }) {
  const styles = {
    NEW: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200",
    REVIEWED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    RESOLVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
  };
  const labels = { NEW: "Mới", REVIEWED: "Đã xem", RESOLVED: "Đã xử lý" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${styles[status]}`}>{labels[status]}</span>;
}

function readConfig(value: unknown): TesterExperienceConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultConfig;
  const input = value as Partial<TesterExperienceConfig>;
  return {
    feedbackEnabled: typeof input.feedbackEnabled === "boolean" ? input.feedbackEnabled : defaultConfig.feedbackEnabled,
    feedbackTitle: typeof input.feedbackTitle === "string" && input.feedbackTitle.trim() ? input.feedbackTitle : defaultConfig.feedbackTitle,
    welcomeEnabled: typeof input.welcomeEnabled === "boolean" ? input.welcomeEnabled : defaultConfig.welcomeEnabled,
    welcomeMessage: typeof input.welcomeMessage === "string" && input.welcomeMessage.trim() ? input.welcomeMessage : defaultConfig.welcomeMessage,
    welcomeTitle: typeof input.welcomeTitle === "string" && input.welcomeTitle.trim() ? input.welcomeTitle : defaultConfig.welcomeTitle
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
