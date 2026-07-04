"use client";

import { Bot, Settings } from "lucide-react";
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

export function AiModelRouterPanel({ onSaved, token }: Props) {
  const [agents, setAgents] = useState<AiAgentOption[]>([]);
  const [providers, setProviders] = useState<AiProviderOption[]>([]);
  const [presets, setPresets] = useState<AiPresetOption[]>([]);
  const [settingKey, setSettingKey] = useState("ai_model_router");
  const [routes, setRoutes] = useState<Record<string, AiRouteConfig>>({ default: defaultRoute });
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
    setTestResults((current) => ({ ...current, [routeKey]: { ok: false, message: "Đang test model..." } }));
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
    <section className="mb-6 rounded-lg border bg-white p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Bot size={18} />Router model AI</h2>
          <p className="mt-1 text-sm text-slate-500">Đổi model cho từng agent text. STT/TTS vẫn giữ OpenAI để phần audio ổn định.</p>
        </div>
        <button type="button" onClick={() => void load()} className="min-h-10 rounded-lg border px-4 text-sm font-bold" disabled={loading}>
          Tải lại
        </button>
      </div>

      {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form onSubmit={save} className="mt-4 space-y-4">
        <label className="block text-sm font-semibold">
          9Router base URL
          <input
            className="mt-1 min-h-10 w-full rounded-lg border px-3 text-sm"
            value={nineRouterBaseUrl}
            onChange={(event) => setNineRouterBaseUrl(event.target.value)}
            placeholder={defaultNineRouterBaseUrl}
          />
        </label>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              <ModelRouteRow
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
                <ModelRouteRow
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
            </tbody>
          </table>
        </div>

        <button type="submit" disabled={saving || loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">
          <Settings size={16} />
          Lưu router AI
        </button>
      </form>
    </section>
  );
}

function ModelRouteRow(props: {
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
    <tr className="border-t align-top">
      <td className="px-3 py-3">
        <p className="font-bold">{props.label}</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">{props.description}</p>
      </td>
      <td className="px-3 py-3">
        <select
          className="min-h-10 w-full rounded-lg border px-3 text-sm"
          value={props.route.provider}
          onChange={(event) => props.onChange(props.routeKey, { provider: event.target.value as AiProviderId })}
        >
          {props.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-3">
        {providerPresets.length ? (
          <select
            className="min-h-10 w-full rounded-lg border px-3 text-sm"
            value={props.route.model}
            onChange={(event) => props.onChange(props.routeKey, { model: event.target.value })}
          >
            {providerPresets.map((preset) => <option key={preset.model} value={preset.model}>{preset.label}</option>)}
            {props.route.model && !selectedPreset ? <option value={props.route.model}>{props.route.model}</option> : null}
          </select>
        ) : null}
        <input
          className={providerPresets.length ? "mt-2 min-h-10 w-full rounded-lg border px-3 font-mono text-xs" : "min-h-10 w-full rounded-lg border px-3 font-mono text-xs"}
          value={props.route.model}
          onChange={(event) => props.onChange(props.routeKey, { model: event.target.value })}
          placeholder="Nhập model ID"
        />
        <p className="mt-1 text-xs text-slate-500">{selectedPreset?.tier ?? props.route.model}</p>
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold disabled:opacity-50"
          disabled={props.testing || !props.route.model}
          onClick={() => props.onTest(props.routeKey)}
        >
          <Bot size={14} />
          {props.testing ? "Đang test" : "Test"}
        </button>
      </td>
      <td className="px-3 py-3">
        {props.result ? (
          <p className={props.result.ok ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-red-700"}>
            {props.result.ok ? `OK${props.result.latencyMs ? ` - ${props.result.latencyMs}ms` : ""}` : props.result.message}
          </p>
        ) : <span className="text-xs text-slate-400">Chưa test</span>}
      </td>
    </tr>
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
