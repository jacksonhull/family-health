import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import type { Provider } from "@/src/lib/ai/providers";
import {
  testAnthropicAction,
  testOpenAIAction,
  testOllamaAction,
  promptAnthropicAction,
  promptOpenAIAction,
  promptOllamaAction,
  saveAISettings,
} from "./actions";
import AISettingsClient from "./AISettingsClient";

export default async function AIModelsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

  // ── Detect configured providers ───────────────────────────────────────────
  const availableProviders: Provider[] = [];
  if (process.env.ANTHROPIC_API_KEY) availableProviders.push("anthropic");
  if (process.env.OPENAI_API_KEY) availableProviders.push("openai");
  if (process.env.OLLAMA_URL) availableProviders.push("ollama");

  // ── Load previously saved settings ───────────────────────────────────────
  const settings = await db.appSetting.findMany({
    where: { key: { startsWith: "ai." } },
  });
  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const initialDefaultProvider =
    settingMap["ai.defaultProvider"] ?? availableProviders[0] ?? "";

  const initialModels: Record<string, string> = {};
  for (const p of availableProviders) {
    if (settingMap[`ai.${p}.model`]) {
      initialModels[p] = settingMap[`ai.${p}.model`];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">AI Models</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure AI providers. Test the connection to load available models,
          then save your selection.
        </p>
      </div>

      <AISettingsClient
        availableProviders={availableProviders}
        initialDefaultProvider={initialDefaultProvider}
        initialModels={initialModels}
        testAnthropicAction={testAnthropicAction}
        testOpenAIAction={testOpenAIAction}
        testOllamaAction={testOllamaAction}
        promptAnthropicAction={promptAnthropicAction}
        promptOpenAIAction={promptOpenAIAction}
        promptOllamaAction={promptOllamaAction}
        saveSettingsAction={saveAISettings}
      />
    </div>
  );
}
