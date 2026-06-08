"use client";

import { useState, useEffect, useCallback } from "react";
import type { Provider } from "@/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProviderConfig = {
  id: Provider;
  name: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  gradient: string;
  icon: React.ReactNode;
  keyPrefix: string;
  keyLink: string;
  keyLinkShort: string;
  defaultModel: string;
  models: { id: string; name: string; tag: string; tagColor: string }[];
  canFetch: boolean;
};

const PROVIDERS: ProviderConfig[] = [
  {
    id: "groq",
    name: "Groq",
    tagline: "Blazing fast inference",
    badge: "FREE",
    badgeColor: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    gradient: "from-orange-500 to-amber-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      </svg>
    ),
    keyPrefix: "gsk_",
    keyLink: "https://console.groq.com/keys",
    keyLinkShort: "console.groq.com/keys",
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    models: [
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", tag: "⚡ Vision", tagColor: "text-orange-400 bg-orange-400/10" },
    ],
    canFetch: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "100+ models, free tier",
    badge: "FREE",
    badgeColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    gradient: "from-emerald-500 to-teal-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/>
      </svg>
    ),
    keyPrefix: "sk-or-",
    keyLink: "https://openrouter.ai/keys",
    keyLinkShort: "openrouter.ai/keys",
    defaultModel: "nvidia/nemotron-nano-12b-v2-vl:free",
    models: [
      { id: "nvidia/nemotron-nano-12b-v2-vl:free", name: "Nemotron Nano VL", tag: "Free", tagColor: "text-emerald-400 bg-emerald-400/10" },
      { id: "moonshotai/kimi-k2.6:free", name: "Kimi K2.6", tag: "Free", tagColor: "text-emerald-400 bg-emerald-400/10" },
      { id: "openrouter/free", name: "OpenRouter Auto", tag: "Free", tagColor: "text-emerald-400 bg-emerald-400/10" },
    ],
    canFetch: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    tagline: "Google DeepMind models",
    badge: "PAID",
    badgeColor: "text-violet-400 bg-violet-400/10 border-violet-400/20",
    gradient: "from-violet-500 to-indigo-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 1.5L9.5 9.5L1.5 12L9.5 14.5L12 22.5L14.5 14.5L22.5 12L14.5 9.5L12 1.5Z"/>
      </svg>
    ),
    keyPrefix: "AIzaSy",
    keyLink: "https://aistudio.google.com/apikey",
    keyLinkShort: "aistudio.google.com/apikey",
    defaultModel: "gemini-2.0-flash",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", tag: "Latest", tagColor: "text-violet-400 bg-violet-400/10" },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", tag: "Fast", tagColor: "text-blue-400 bg-blue-400/10" },
      { id: "gemini-1.5-pro-001", name: "Gemini 1.5 Pro", tag: "Pro", tagColor: "text-yellow-400 bg-yellow-400/10" },
    ],
    canFetch: true,
  },
];

type FetchedModel = { name: string; displayName?: string; supportedGenerationMethods?: string[] };

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [provider, setProvider] = useState<Provider>("groq");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("meta-llama/llama-4-scout-17b-16e-instruct");
  const [language, setLanguage] = useState("Bangla");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const cfg = PROVIDERS.find((p) => p.id === provider)!;

  useEffect(() => {
    if (!isOpen) return;
    const storedProvider = (localStorage.getItem("aipose_provider") ?? "groq") as Provider;
    const storedKey = localStorage.getItem("aipose_api_key") ?? "";
    const storedModel = localStorage.getItem("aipose_model") ??
      PROVIDERS.find((p) => p.id === storedProvider)?.defaultModel ?? "";
    const storedLang = localStorage.getItem("aipose_language") ?? "Bangla";
    setProvider(storedProvider);
    setApiKey(storedKey);
    setModelId(storedModel);
    setLanguage(storedLang);
    setSaved(false);
    setFetchedModels([]);
    setFetchError("");
  }, [isOpen]);

  const switchProvider = (p: Provider) => {
    const next = PROVIDERS.find((x) => x.id === p)!;
    setProvider(p);
    setModelId(next.defaultModel);
    setApiKey("");
    setFetchedModels([]);
    setFetchError("");
    setSaved(false);
  };

  const fetchModels = useCallback(async () => {
    if (!apiKey.trim()) return;
    setFetching(true);
    setFetchError("");
    try {
      if (provider === "groq") {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey.trim()}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const filtered: FetchedModel[] = (data.data ?? []).map((m: any) => ({ name: m.id }));
        setFetchedModels(filtered);
        if (filtered.length > 0) {
          setModelId(filtered[0].name);
        }
      } else if (provider === "openrouter") {
        const res = await fetch("https://openrouter.ai/api/v1/models");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const filtered: FetchedModel[] = (data.data ?? [])
          .filter((m: any) => m.id.endsWith(":free") && m.architecture?.modality?.includes("image"))
          .map((m: any) => ({ name: m.id }));
        setFetchedModels(filtered);
        if (filtered.length > 0) setModelId(filtered[0].name);
      } else {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        const filtered: FetchedModel[] = (data.models ?? []).filter(
          (m: FetchedModel) => m.supportedGenerationMethods?.includes("generateContent") && m.name.includes("gemini")
        );
        setFetchedModels(filtered);
        if (filtered.length > 0) {
          const best = filtered.find((m) => m.name.includes("flash")) ?? filtered[0];
          setModelId(best.name.replace("models/", ""));
        }
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to fetch models");
    } finally {
      setFetching(false);
    }
  }, [apiKey, provider]);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem("aipose_api_key", apiKey.trim());
    localStorage.setItem("aipose_model", modelId.trim() || cfg.defaultModel);
    localStorage.setItem("aipose_provider", provider);
    localStorage.setItem("aipose_language", language);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1000);
  };

  const handleClear = () => {
    localStorage.removeItem("aipose_api_key");
    localStorage.removeItem("aipose_model");
    localStorage.removeItem("aipose_provider");
    localStorage.removeItem("aipose_language");
    setApiKey("");
    setModelId(cfg.defaultModel);
    setLanguage("Bangla");
    setFetchedModels([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
      {/* Backdrop (Desktop only) */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md hidden sm:block"
        onClick={onClose}
      />

      {/* Main Container: Full screen on mobile, Modal on desktop */}
      <div className="relative flex flex-col w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-[440px] bg-[#0A0A0F] sm:rounded-3xl shadow-2xl overflow-hidden border-0 sm:border sm:border-white/10">
        
        {/* Sticky Header */}
        <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0A0A0F]/90 backdrop-blur-md z-10">
          <h2 className="text-xl font-semibold text-white tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Provider Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-2xl">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => switchProvider(p.id)}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 text-center transition-all duration-200 ${
                    provider === p.id
                      ? "bg-white/10 shadow-lg"
                      : "hover:bg-white/5"
                  }`}
                >
                  <span className={`transition-colors ${provider === p.id ? "text-white" : "text-gray-500"}`}>
                    {p.icon}
                  </span>
                  <span className={`text-[11px] font-semibold tracking-wide transition-colors ${provider === p.id ? "text-white" : "text-gray-500"}`}>
                    {p.name}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${p.badgeColor}`}>
                    {p.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Info strip */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] px-4 py-3 flex items-center gap-3">
            <div className={`h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white`}>
              {cfg.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{cfg.name}</p>
              <p className="text-xs text-gray-400">{cfg.tagline} · <a href={cfg.keyLink} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white underline underline-offset-2">{cfg.keyLinkShort}</a></p>
            </div>
            <div className="ml-auto shrink-0">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${cfg.badgeColor}`}>
                {cfg.badge}
              </span>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder={cfg.keyPrefix + "…"}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 pr-12 font-mono text-sm text-white placeholder-gray-600 outline-none transition focus:border-white/20 focus:bg-white/[0.08]"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition hover:bg-white/10 hover:text-gray-300"
              >
                {showKey ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <svg className="h-3 w-3 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-[11px] text-gray-600">Stored locally in your browser only. Never sent to our servers.</p>
            </div>
          </div>

          {/* Language selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">
              Language
            </label>
            <div className="flex gap-2 rounded-2xl bg-white/5 p-1">
              <button
                onClick={() => setLanguage("Bangla")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
                  language === "Bangla"
                    ? "bg-white/10 shadow-lg text-white font-medium"
                    : "hover:bg-white/5 text-gray-500 text-sm"
                }`}
              >
                Bangla
              </button>
              <button
                onClick={() => setLanguage("English")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 ${
                  language === "English"
                    ? "bg-white/10 shadow-lg text-white font-medium"
                    : "hover:bg-white/5 text-gray-500 text-sm"
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Model selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Model</label>
              {cfg.canFetch && (
                <button
                  onClick={fetchModels}
                  disabled={!apiKey.trim() || fetching}
                  className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <svg className={`h-3 w-3 ${fetching ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {fetching ? "Loading…" : "Fetch Live"}
                </button>
              )}
            </div>

            {fetchError && (
              <div className="mb-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                {fetchError}
              </div>
            )}

            {/* Fetched model dropdown for Gemini */}
            {fetchedModels.length > 0 ? (
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#16161f] px-4 py-3.5 text-sm text-white outline-none transition focus:border-white/20"
              >
                {fetchedModels.map((m) => (
                  <option key={m.name} value={m.name.replace("models/", "")}>
                    {m.name.replace("models/", "")}
                  </option>
                ))}
              </select>
            ) : (
              /* Model chips */
              <div className="grid grid-cols-1 gap-2">
                {cfg.models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModelId(m.id)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all ${
                      modelId === m.id
                        ? "border-white/20 bg-white/10"
                        : "border-white/[0.06] bg-white/[0.03] hover:border-white/12 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${cfg.gradient} ${modelId === m.id ? "opacity-100" : "opacity-30"}`} />
                      <span className={`text-sm font-medium ${modelId === m.id ? "text-white" : "text-gray-400"}`}>{m.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.tagColor}`}>{m.tag}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Custom model input */}
            <div className="mt-2">
              <input
                type="text"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="Or type a custom model ID…"
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 font-mono text-xs text-gray-400 placeholder-gray-700 outline-none transition focus:border-white/15 focus:text-gray-300"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3 pt-2 pb-6">
            <button
              onClick={handleClear}
              className="col-span-1 rounded-2xl border border-white/[0.06] bg-white/[0.03] py-3 text-sm text-gray-500 transition hover:border-red-500/20 hover:bg-red-500/8 hover:text-red-400"
            >
              Clear
            </button>
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className={`col-span-2 rounded-2xl py-3 text-sm font-bold text-white transition-all bg-gradient-to-r ${cfg.gradient} shadow-lg disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]`}
            >
              {saved ? "✓ Saved!" : "Save & Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
