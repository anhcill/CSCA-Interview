"use client";

import { Bot, CheckCircle2, Copy, RefreshCw, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api";

type AiProviderId = "9router" | "deepseek" | "openai" | "openrouter";

type AiAgentOption = {
  description: string;
  key: string;
  label: string;
};

type AiProviderOption = {
  id: AiProviderId;
  label: string;
};

type AiPresetOption = {
  label: string;
  model: string;
  provider: AiProviderId;
  tier: string;
};

type AiRouteConfig = {
  model: string;
  provider: AiProviderId;
};

type AiRouterSettingValue = {
  agents?: Record<string, Partial<AiRouteConfig>>;
  default?: Partial<AiRouteConfig>;
  providers?: Record<string, { baseUrl?: string | null }>;
};

type AiRouterOptionsResponse = {
  agents: AiAgentOption[];
  currentSetting: unknown;
  presets: AiPresetOption[];
  providers: AiProviderOption[];
  settingKey: string;
  updatedAt?: string | null;
};

type AiTestResponse = {
  content?: string;
  latencyMs?: number;
  message: string;
  model: string;
  ok: boolean;
  provider: AiProviderId;
};

type Props = {
  onSaved?: () => Promise<void> | void;
  token: string | null;
};

const defaultAgentRoutes: Record<string, AiRouteConfig> = {
  adaptive_follow_up_generator: { provider: "9router", model: "cx/gpt-5.4-mini" },
  answer_scoring_evaluator: { provider: "9router", model: "ag/claude-opus-4-6-thinking" },
  interview_question_generator: { provider: "9router", model: "cx/gpt-5.5" },
  study_plan_analyzer: { provider: "9router", model: "ag/claude-sonnet-4-6" }
};

const defaultRoute: AiRouteConfig = { provider: "9router", model: "cx/gpt-5.5" };
const defaultNineRouterBaseUrl = "https://9router-production-d1ef.up.railway.app/v1";

const quickModelProfiles: Array<{
  description: string;
  id: string;
  label: string;
  routes: Record<string, AiRouteConfig>;
}> = [
  {
    id: "strong",
    label: "Mạnh",
    description: "Ưu tiên chấm và phân tích kỹ.",
    routes: defaultAgentRoutes
  },
  {
    id: "balanced",
    label: "Cân bằng",
    description: "Ổn cho vận hành hằng ngày.",
    routes: {
      default: { provider: "9router", model: "cx/gpt-5.4" },
      adaptive_follow_up_generator: { provider: "9router", model: "cx/gpt-5.4-mini" },
      answer_scoring_evaluator: { provider: "9router", model: "ag/claude-sonnet-4-6" },
      interview_question_generator: { provider: "9router", model: "cx/gpt-5.4" },
      study_plan_analyzer: { provider: "9router", model: "ag/claude-sonnet-4-6" }
    }
  },
  {
    id: "fast",
    label: "Nhanh",
    description: "Giảm độ trễ khi đông người dùng.",
    routes: {
      default: { provider: "9router", model: "cx/gpt-5.4-mini" },
      adaptive_follow_up_generator: { provider: "9router", model: "cx/gpt-5.4-mini" },
      answer_scoring_evaluator: { provider: "9router", model: "cx/gpt-5.4-mini-review" },
      interview_question_generator: { provider: "9router", model: "cx/gpt-5.4-mini" },
      study_plan_analyzer: { provider: "9router", model: "cx/gpt-5.4-mini-review" }
    }
  },
  {
    id: "review",
    label: "Review kỹ",
    description: "Dùng model review cho các tác vụ cần soi sâu.",
    routes: {
      default: { provider: "9router", model: "cx/gpt-5.5-review" },
      adaptive_follow_up_generator: { provider: "9router", model: "cx/gpt-5.4-mini" },
      answer_scoring_evaluator: { provider: "9router", model: "cx/gpt-5.5-review" },
      interview_question_generator: { provider: "9router", model: "cx/gpt-5.5" },
      study_plan_analyzer: { provider: "9router", model: "cx/gpt-5.5-review" }
    }
  }
];

export function AiModelRouterPanel({ onSaved, token }: Props) {
  const [agents, setAgents] = useState<AiAgentOption[]>([]);
  const [providers, setProviders] = useState<AiProviderOption[]>([]);
  const [presets, setPresets] = useState<AiPresetOption[]>([]);
  const [settingKey, setSettingKey] = useState("ai_model_router");
  const [routes, setRoutes] = useState<Record<string, AiRouteConfig>>({ default: defaultRoute });
  const [bulkProvider, setBulkProvider] = useState<AiProviderId>(defaultRoute.provider);
  const [bulkModel, setBulkModel] = useState(defaultRoute.model);
  const [nineRouterBaseUrl, setNineRouterBaseUrl] = useState(defaultNineRouterBaseUrl);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testResults, setTestResults] = useState<Record<string, AiTestResponse | { message: string; ok: false }>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<AiRouterOptionsResponse>("/api/admin/ai-model-router/options", { cacheMs: 0, token });
      const setting = normalizeSetting(response.currentSetting);
      const nextAgents = response.agents;
      const nextRoutes: Record<string, AiRouteConfig> = {
        default: normalizeRoute(setting?.default, defaultRoute)
      };

      nextAgents.forEach((agent) => {
        nextRoutes[agent.key] = normalizeRoute(setting?.agents?.[agent.key], defaultAgentRoutes[agent.key] ?? nextRoutes.default);
      });

      setAgents(nextAgents);
      setProviders(response.providers);
      setPresets(response.presets);
      setRoutes(nextRoutes);
      setBulkProvider(nextRoutes.default.provider);
      setBulkModel(nextRoutes.default.model);
      setSettingKey(response.settingKey);
      setNineRouterBaseUrl(setting?.providers?.["9router"]?.baseUrl || setting?.providers?.ninerouter?.baseUrl || defaultNineRouterBaseUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải cấu hình model AI");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const presetsByProvider = useMemo(() => {
    return presets.reduce<Record<string, AiPresetOption[]>>((groups, preset) => {
      groups[preset.provider] = [...(groups[preset.provider] ?? []), preset];
      return groups;
    }, {});
  }, [presets]);

  function firstModelForProvider(provider: AiProviderId) {
    return presetsByProvider[provider]?.[0]?.model ?? "";
  }

  function changeBulkProvider(provider: AiProviderId) {
    setBulkProvider(provider);
    setBulkModel(firstModelForProvider(provider));
  }

  function updateRoute(routeKey: string, patch: Partial<AiRouteConfig>) {
    setRoutes((current) => {
      const previous = current[routeKey] ?? defaultRoute;
      const provider = patch.provider ?? previous.provider;
      const providerPresets = presetsByProvider[provider] ?? [];
      const model = patch.model ?? (provider === previous.provider ? previous.model : providerPresets[0]?.model ?? "");
      return {
        ...current,
        [routeKey]: { provider, model }
      };
    });
  }

  function applyRouteToAll(route: AiRouteConfig) {
    setRoutes((current) => {
      const next: Record<string, AiRouteConfig> = {
        ...current,
        default: { ...route }
      };

      agents.forEach((agent) => {
        next[agent.key] = { ...route };
      });

      return next;
    });
  }

  function applyBulkRoute() {
    const model = bulkModel.trim();
    if (!model) return;
    applyRouteToAll({ provider: bulkProvider, model });
  }

  function applyQuickProfile(profile: (typeof quickModelProfiles)[number]) {
    const profileDefault = profile.routes.default ?? defaultRoute;
    setRoutes((current) => {
      const next: Record<string, AiRouteConfig> = {
        ...current,
        default: { ...profileDefault }
      };

      agents.forEach((agent) => {
        next[agent.key] = { ...(profile.routes[agent.key] ?? profileDefault) };
      });

      return next;
    });
    setBulkProvider(profileDefault.provider);
    setBulkModel(profileDefault.model);
  }

  function copyDefaultToAgents() {
    setRoutes((current) => {
      const defaultConfig = current.default ?? defaultRoute;
      const next: Record<string, AiRouteConfig> = { ...current, default: { ...defaultConfig } };
      agents.forEach((agent) => {
        next[agent.key] = { ...defaultConfig };
      });
      return next;
    });
  }

  function resetRoutesToDefault() {
    const next: Record<string, AiRouteConfig> = {
      default: { ...defaultRoute }
    };
    agents.forEach((agent) => {
      next[agent.key] = { ...(defaultAgentRoutes[agent.key] ?? defaultRoute) };
    });
    setRoutes(next);
    setBulkProvider(defaultRoute.provider);
    setBulkModel(defaultRoute.model);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const settingValue: AiRouterSettingValue = {
        default: routes.default,
        agents: Object.fromEntries(agents.map((agent) => [agent.key, routes[agent.key] ?? routes.default])),
        providers: {
          "9router": { baseUrl: nineRouterBaseUrl.trim() || null }
        }
      };

      await apiPut(`/api/admin/settings/${encodeURIComponent(settingKey)}`, {
        description: "Cấu hình router model AI theo từng agent. Audio vẫn dùng OpenAI STT/TTS.",
        settingValue
      }, { token });
      await onSaved?.();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu cấu hình model AI");
    } finally {
      setSaving(false);
    }
  }

  async function testRoute(routeKey: string) {
    const route = routes[routeKey] ?? defaultRoute;
    setTestingKey(routeKey);
    setTestResults((current) => ({ ...current, [routeKey]: { ok: false, message: "Đang kiểm tra model..." } }));
    try {
      const result = await apiPost<AiTestResponse>("/api/admin/ai-model-router/test", {
        baseUrl: route.provider === "9router" ? nineRouterBaseUrl.trim() || null : null,
        model: route.model,
        provider: route.provider
      }, { timeoutMs: 60_000, token });
      setTestResults((current) => ({ ...current, [routeKey]: result }));
    } catch (err) {
      setTestResults((current) => ({
        ...current,
        [routeKey]: { ok: false, message: err instanceof Error ? err.message : "Test model thất bại" }
      }));
    } finally {
      setTestingKey(null);
    }
  }

  return (
    <section id="ai-model-router" className="mb-6 rounded-lg border bg-white p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Bot size={18} />Cài đặt model AI theo chức năng</h2>
          <p className="mt-1 text-sm text-slate-500">Đổi provider/model cho từng AI văn bản. STT/TTS vẫn giữ OpenAI để phần audio ổn định.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-700">AI văn bản đổi linh hoạt</span>
            <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">Audio OpenAI</span>
          </div>
        </div>
        <button type="button" onClick={() => void load()} className="min-h-10 rounded-lg border px-4 text-sm font-bold" disabled={loading}>
          Tải lại
        </button>
      </div>

      {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={save} className="mt-4 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <label className="block text-sm font-semibold">
            9Router base URL
            <input
              className="mt-1 min-h-10 w-full rounded-lg border px-3 text-sm"
              value={nineRouterBaseUrl}
              onChange={(event) => setNineRouterBaseUrl(event.target.value)}
              placeholder={defaultNineRouterBaseUrl}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" onClick={copyDefaultToAgents} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold hover:bg-slate-50">
              <Copy size={16} />Copy mặc định
            </button>
            <button type="button" onClick={resetRoutesToDefault} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold hover:bg-slate-50">
              <RefreshCw size={16} />Mặc định hệ thống
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-bold text-indigo-900">Chuyển nhanh theo cấu hình</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickModelProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => applyQuickProfile(profile)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-800 hover:bg-indigo-50"
                    title={profile.description}
                  >
                    <Settings size={14} />{profile.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[150px_minmax(220px,1fr)_auto]">
              <select
                className="min-h-10 rounded-lg border bg-white px-3 text-sm"
                value={bulkProvider}
                onChange={(event) => changeBulkProvider(event.target.value as AiProviderId)}
              >
                {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
              </select>
              <BulkModelPicker
                model={bulkModel}
                presets={presetsByProvider[bulkProvider] ?? []}
                onChange={setBulkModel}
              />
              <button type="button" onClick={applyBulkRoute} disabled={!bulkModel.trim()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                <CheckCircle2 size={16} />Áp cho tất cả
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <ModelRouteCard
            description="Route mặc định nếu agent chưa có cấu hình riêng."
            label="Mặc định"
            presetsByProvider={presetsByProvider}
            providers={providers}
            result={testResults.default}
            route={routes.default ?? defaultRoute}
            routeKey="default"
            testing={testingKey === "default"}
            onChange={updateRoute}
            onTest={testRoute}
          />
          {agents.map((agent) => (
            <ModelRouteCard
              key={agent.key}
              description={agent.description}
              label={agent.label}
              presetsByProvider={presetsByProvider}
              providers={providers}
              result={testResults[agent.key]}
              route={routes[agent.key] ?? routes.default ?? defaultRoute}
              routeKey={agent.key}
              testing={testingKey === agent.key}
              onChange={updateRoute}
              onTest={testRoute}
            />
          ))}
        </div>

        <button type="submit" disabled={saving || loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">
          <Settings size={16} />
          Lưu cấu hình model
        </button>
      </form>
    </section>
  );
}

function BulkModelPicker(props: {
  model: string;
  onChange: (model: string) => void;
  presets: AiPresetOption[];
}) {
  const selectedPreset = props.presets.find((preset) => preset.model === props.model);

  return (
    <div>
      {props.presets.length ? (
        <select
          className="min-h-10 w-full rounded-lg border bg-white px-3 text-sm"
          value={props.model}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {props.presets.map((preset) => <option key={preset.model} value={preset.model}>{preset.label}</option>)}
          {props.model && !selectedPreset ? <option value={props.model}>{props.model}</option> : null}
        </select>
      ) : null}
      <input
        className={props.presets.length ? "mt-2 min-h-10 w-full rounded-lg border bg-white px-3 font-mono text-xs" : "min-h-10 w-full rounded-lg border bg-white px-3 font-mono text-xs"}
        value={props.model}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder="Nhập model ID"
      />
      {selectedPreset ? <p className="mt-1 text-xs font-semibold text-slate-500">{selectedPreset.tier}</p> : null}
    </div>
  );
}

function ModelRouteCard(props: {
  description: string;
  label: string;
  onChange: (routeKey: string, patch: Partial<AiRouteConfig>) => void;
  onTest: (routeKey: string) => void;
  presetsByProvider: Record<string, AiPresetOption[]>;
  providers: AiProviderOption[];
  result?: AiTestResponse | { message: string; ok: false };
  route: AiRouteConfig;
  routeKey: string;
  testing: boolean;
}) {
  const providerPresets = props.presetsByProvider[props.route.provider] ?? [];
  const selectedPreset = providerPresets.find((preset) => preset.model === props.route.model);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_minmax(260px,1.25fr)_auto_minmax(150px,0.7fr)] lg:items-start">
        <div>
          <p className="font-bold">{props.label}</p>
          <p className="mt-1 text-xs text-slate-500">{props.description}</p>
          <p className="mt-2 rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-500">{props.routeKey}</p>
        </div>
        <select
          className="min-h-10 w-full rounded-lg border px-3 text-sm"
          value={props.route.provider}
          onChange={(event) => props.onChange(props.routeKey, { provider: event.target.value as AiProviderId })}
        >
          {props.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
        </select>
        <BulkModelPicker
          model={props.route.model}
          presets={providerPresets}
          onChange={(model) => props.onChange(props.routeKey, { model })}
        />
        <div className="space-y-2">
          <button
            type="button"
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
            disabled={props.testing || !props.route.model}
            onClick={() => props.onTest(props.routeKey)}
          >
            <Bot size={14} />
            {props.testing ? "Đang kiểm tra" : "Kiểm tra"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold hover:bg-slate-50"
            onClick={() => props.onChange(props.routeKey, defaultAgentRoutes[props.routeKey] ?? defaultRoute)}
          >
            <RefreshCw size={14} />Reset dòng
          </button>
        </div>
        <div>
          {props.result ? (
            <p className={props.result.ok ? "rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-700" : "rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700"}>
              {props.result.ok ? `OK${props.result.latencyMs ? ` - ${props.result.latencyMs}ms` : ""}` : props.result.message}
            </p>
          ) : (
            <span className="inline-flex rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-400">Chưa kiểm tra</span>
          )}
          <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{selectedPreset?.label ?? props.route.model}</p>
        </div>
      </div>
    </div>
  );
}

function normalizeRoute(value: unknown, fallback: AiRouteConfig): AiRouteConfig {
  if (!isRecord(value)) return fallback;
  const provider = readProvider(value.provider) ?? fallback.provider;
  const model = typeof value.model === "string" && value.model.trim() ? value.model.trim() : fallback.model;
  return { provider, model };
}

function normalizeSetting(value: unknown): AiRouterSettingValue | null {
  return isRecord(value) ? value as AiRouterSettingValue : null;
}

function readProvider(value: unknown): AiProviderId | null {
  if (value === "9router" || value === "deepseek" || value === "openai" || value === "openrouter") return value;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
