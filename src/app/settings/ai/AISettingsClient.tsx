"use client";

import { useState, useTransition } from "react";
import type { Provider, TestResult, ModelOption } from "@/src/lib/ai/providers";

type ProviderState = {
  model: string;                // selected model ID
  models: ModelOption[] | null; // null = never fetched; 1-item = from saved setting; full list = after Test Connection
  testing: boolean;             // Test Connection in progress
  prompting: boolean;           // Test Model in progress
  result: { ok: boolean; message: string; latencyMs: number } | null;
};

const PROVIDER_META: Record<
  Provider,
  { label: string; color: string; initial: string }
> = {
  anthropic: { label: "Anthropic", color: "bg-orange-100 text-orange-700", initial: "A" },
  openai:    { label: "OpenAI",    color: "bg-green-100 text-green-700",   initial: "O" },
  ollama:    { label: "Ollama",    color: "bg-purple-100 text-purple-700", initial: "O" },
};

export default function AISettingsClient({
  availableProviders,
  initialDefaultProvider,
  initialModels,
  testAnthropicAction,
  testOpenAIAction,
  testOllamaAction,
  promptAnthropicAction,
  promptOpenAIAction,
  promptOllamaAction,
  saveSettingsAction,
}: {
  availableProviders: Provider[];
  initialDefaultProvider: string;
  initialModels: Record<string, string>;
  testAnthropicAction:   () => Promise<TestResult>;
  testOpenAIAction:      () => Promise<TestResult>;
  testOllamaAction:      () => Promise<TestResult>;
  promptAnthropicAction: (model: string) => Promise<TestResult>;
  promptOpenAIAction:    (model: string) => Promise<TestResult>;
  promptOllamaAction:    (model: string) => Promise<TestResult>;
  saveSettingsAction: (
    defaultProvider: string,
    models: Record<string, string>,
  ) => Promise<void>;
}) {
  const [defaultProvider, setDefaultProvider] = useState(
    initialDefaultProvider || availableProviders[0] || "",
  );

  const [providerState, setProviderState] = useState<Record<string, ProviderState>>(
    () => {
      const s: Record<string, ProviderState> = {};
      for (const p of availableProviders) {
        const saved = initialModels[p];
        s[p] = {
          model: saved ?? "",
          // Pre-populate with the saved model so the select shows it immediately.
          // After "Test Connection" this is replaced with the full model list.
          models: saved ? [{ value: saved, label: saved }] : null,
          testing: false,
          prompting: false,
          result: null,
        };
      }
      return s;
    },
  );

  const [savePending, startSaveTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Always fetches the full model list from the provider.
  async function handleTest(provider: Provider) {
    setProviderState((s) => ({
      ...s,
      [provider]: { ...s[provider], testing: true, result: null },
    }));

    let result: TestResult;
    if (provider === "anthropic") result = await testAnthropicAction();
    else if (provider === "openai") result = await testOpenAIAction();
    else result = await testOllamaAction();

    setProviderState((s) => {
      const prev = s[provider];
      // Keep current selection if it's in the new list; otherwise pick first.
      const autoModel =
        result.models.find((m) => m.value === prev.model)?.value ??
        result.models[0]?.value ??
        prev.model;
      return {
        ...s,
        [provider]: {
          ...prev,
          model: result.ok ? autoModel : prev.model,
          models: result.ok ? result.models : prev.models,
          testing: false,
          result: { ok: result.ok, message: result.message, latencyMs: result.latencyMs },
        },
      };
    });
  }

  // Sends a real prompt to the currently selected model.
  async function handlePrompt(provider: Provider) {
    const model = providerState[provider].model;
    if (!model) return;

    setProviderState((s) => ({
      ...s,
      [provider]: { ...s[provider], prompting: true, result: null },
    }));

    let result: TestResult;
    if (provider === "anthropic") result = await promptAnthropicAction(model);
    else if (provider === "openai") result = await promptOpenAIAction(model);
    else result = await promptOllamaAction(model);

    setProviderState((s) => ({
      ...s,
      [provider]: {
        ...s[provider],
        prompting: false,
        result: { ok: result.ok, message: result.message, latencyMs: result.latencyMs },
      },
    }));
  }

  function handleSave() {
    setSaveSuccess(false);
    startSaveTransition(async () => {
      const models: Record<string, string> = {};
      for (const p of availableProviders) {
        if (providerState[p]?.model) models[p] = providerState[p].model;
      }
      await saveSettingsAction(defaultProvider, models);
      setSaveSuccess(true);
    });
  }

  if (availableProviders.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm font-medium text-gray-600 mb-1">
          No AI providers configured
        </p>
        <p className="text-sm text-gray-400 mb-3">
          Set one or more environment variables to get started:
        </p>
        <ul className="space-y-1">
          {["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OLLAMA_URL"].map((v) => (
            <li key={v}>
              <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                {v}
              </code>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider cards */}
      {availableProviders.map((provider) => {
        const meta = PROVIDER_META[provider];
        const state = providerState[provider];
        const busy = state.testing || state.prompting;

        return (
          <div
            key={provider}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${meta.color}`}>
                {meta.initial}
              </span>
              <h3 className="text-sm font-semibold text-gray-800">{meta.label}</h3>
              <div className="ml-auto">
                {state.model && (
                  provider === defaultProvider ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Default
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setDefaultProvider(provider); setSaveSuccess(false); }}
                      className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      Set as default
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Model selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              {state.models !== null ? (
                <select
                  value={state.model}
                  onChange={(e) => {
                    setSaveSuccess(false);
                    setProviderState((s) => ({
                      ...s,
                      [provider]: { ...s[provider], model: e.target.value, result: null },
                    }));
                  }}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  {state.models.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  disabled
                  className="block w-full rounded-lg border-gray-300 shadow-sm bg-gray-50 text-gray-400 sm:text-sm cursor-not-allowed"
                >
                  <option>— Test connection to list available models —</option>
                </select>
              )}
            </div>

            {/* Buttons + result */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => handleTest(provider)}
                disabled={busy}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {state.testing ? "Connecting…" : "Test connection"}
              </button>

              <button
                type="button"
                onClick={() => handlePrompt(provider)}
                disabled={!state.model || busy}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {state.prompting ? "Testing…" : "Test model"}
              </button>

              {state.result && (
                <span className={`flex items-center gap-1.5 text-sm ${state.result.ok ? "text-green-600" : "text-red-600"}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${state.result.ok ? "bg-green-500" : "bg-red-500"}`} />
                  {state.result.ok
                    ? `${state.result.message} · ${state.result.latencyMs}ms`
                    : state.result.message}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={savePending}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {savePending ? "Saving…" : "Save settings"}
        </button>
        {saveSuccess && (
          <span className="text-sm text-green-600">Settings saved.</span>
        )}
      </div>
    </div>
  );
}
