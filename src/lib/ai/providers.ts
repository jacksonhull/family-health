export type Provider = "anthropic" | "openai" | "ollama";

export type ModelOption = { value: string; label: string };

export type TestResult = {
  ok: boolean;
  message: string;
  latencyMs: number;
  /** Populated when listing models. Empty array means "keep existing list". */
  models: ModelOption[];
};

const TEST_PROMPT =
  'Reply with exactly the word "OK" and nothing else. No punctuation, no explanation.';

// ── Vision probing helpers ─────────────────────────────────────────────────
// Tiny 1×1 white PNG — minimal cost when probing models for image support.
const VISION_PROBE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/**
 * Probes a single OpenAI model by sending a 1×1 PNG.
 * Returns true if the model accepted the image (HTTP 200).
 */
async function probeOpenAIVision(apiKey: string, model: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${VISION_PROBE_PNG}` },
              },
              { type: "text", text: 'Reply "OK"' },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    console.log(`[AI] OpenAI vision probe ${model}: ${res.status}`);
    return res.ok;
  } catch {
    console.log(`[AI] OpenAI vision probe ${model}: timeout/error`);
    return false;
  }
}

/**
 * Calls Ollama's /api/show endpoint for a single model and returns true if
 * "vision" appears in the capabilities array (requires Ollama ≥ v0.6.4).
 */
async function fetchOllamaVision(ollamaUrl: string, model: string): Promise<boolean> {
  try {
    const res = await fetch(`${ollamaUrl}/api/show`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const caps: string[] = Array.isArray(data.capabilities) ? data.capabilities : [];
    console.log(`[AI] Ollama capabilities for ${model}:`, caps);
    return caps.includes("vision");
  } catch {
    console.log(`[AI] Ollama /api/show failed for ${model}`);
    return false;
  }
}

// ── Anthropic ──────────────────────────────────────────────────────────────
// The models list returns capabilities.image_input.supported per model.

type AnthropicModel = {
  id: string;
  display_name?: string;
  capabilities?: {
    image_input?: { supported?: boolean };
  };
};

export async function testAnthropic(): Promise<TestResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey)
    return { ok: false, message: "ANTHROPIC_API_KEY is not set", latencyMs: 0, models: [] };

  const start = Date.now();
  console.log("[AI] Anthropic: fetching available models");
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    const latencyMs = Date.now() - start;
    console.log(`[AI] Anthropic response — status: ${res.status} (${latencyMs}ms)`);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.log("[AI] Anthropic error body:", JSON.stringify(body));
      const msg = body?.error?.message ?? `HTTP ${res.status} ${res.statusText}`;
      return { ok: false, message: msg, latencyMs, models: [] };
    }

    const data = await res.json();
    const allModels: AnthropicModel[] = data.data ?? [];
    console.log(`[AI] Anthropic: ${allModels.length} total models`);

    const models: ModelOption[] = allModels
      .filter((m) => {
        // Use the capabilities flag when present; fall back to name pattern
        // (all claude-3 and newer families support image input).
        if (m.capabilities?.image_input !== undefined) {
          return m.capabilities.image_input.supported === true;
        }
        return /^claude-(3|opus|sonnet|haiku)/.test(m.id);
      })
      .map((m) => ({ value: m.id, label: m.display_name ?? m.id }));

    console.log(
      `[AI] Anthropic: ${models.length} image-capable models:`,
      models.map((m) => m.value),
    );

    return {
      ok: true,
      message: `${models.length} of ${allModels.length} models support images`,
      latencyMs,
      models,
    };
  } catch (e) {
    console.log("[AI] Anthropic exception:", e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
      latencyMs: Date.now() - start,
      models: [],
    };
  }
}

// ── OpenAI ─────────────────────────────────────────────────────────────────
// The models list has no capability metadata — probe each model with a tiny
// PNG image. All probes run in parallel so latency is bounded by the slowest
// responding model (typically < 5 s).

const OPENAI_CHAT_PREFIXES = ["gpt-", "o1", "o3", "chatgpt-"];

export async function testOpenAI(): Promise<TestResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey)
    return { ok: false, message: "OPENAI_API_KEY is not set", latencyMs: 0, models: [] };

  const start = Date.now();
  console.log("[AI] OpenAI: fetching available models");
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const latencyMs = Date.now() - start;
    console.log(`[AI] OpenAI response — status: ${res.status} (${latencyMs}ms)`);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.log("[AI] OpenAI error body:", JSON.stringify(body));
      const msg = body?.error?.message ?? `HTTP ${res.status} ${res.statusText}`;
      return { ok: false, message: msg, latencyMs, models: [] };
    }

    const data = await res.json();
    const chatModels: string[] = (data.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) =>
        OPENAI_CHAT_PREFIXES.some((prefix) => id.startsWith(prefix)),
      )
      .sort((a: string, b: string) => b.localeCompare(a));

    console.log(`[AI] OpenAI: ${chatModels.length} chat models, probing for vision support…`);

    // Probe all chat models in parallel
    const visionFlags = await Promise.all(
      chatModels.map((id) => probeOpenAIVision(apiKey, id)),
    );

    const models: ModelOption[] = chatModels
      .filter((_, i) => visionFlags[i])
      .map((id) => ({ value: id, label: id }));

    console.log(
      `[AI] OpenAI: ${models.length} image-capable models:`,
      models.map((m) => m.value),
    );

    return {
      ok: true,
      message: `${models.length} of ${chatModels.length} models support images`,
      latencyMs: Date.now() - start,
      models,
    };
  } catch (e) {
    console.log("[AI] OpenAI exception:", e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
      latencyMs: Date.now() - start,
      models: [],
    };
  }
}

// ── Ollama ─────────────────────────────────────────────────────────────────
// /api/tags lists installed models; /api/show returns capabilities per model
// (requires Ollama ≥ v0.6.4). All show-calls run in parallel.

export async function testOllama(): Promise<TestResult> {
  const ollamaUrl = process.env.OLLAMA_URL?.trim();
  if (!ollamaUrl)
    return { ok: false, message: "OLLAMA_URL is not set", latencyMs: 0, models: [] };

  const start = Date.now();
  console.log(`[AI] Ollama: fetching models from ${ollamaUrl}`);
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(10_000),
    });
    const latencyMs = Date.now() - start;
    console.log(`[AI] Ollama response — status: ${res.status} (${latencyMs}ms)`);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.log("[AI] Ollama error body:", JSON.stringify(body));
      const msg = body?.error ?? `HTTP ${res.status} ${res.statusText}`;
      return { ok: false, message: msg, latencyMs, models: [] };
    }

    const data = await res.json();
    const allModels: ModelOption[] = (data.models ?? [])
      .map((m: { name: string }) => ({ value: m.name, label: m.name }))
      .sort((a: ModelOption, b: ModelOption) => a.label.localeCompare(b.label));

    console.log(`[AI] Ollama: ${allModels.length} installed models, checking vision capabilities…`);

    // Fetch capabilities for all models in parallel via /api/show
    const visionFlags = await Promise.all(
      allModels.map((m) => fetchOllamaVision(ollamaUrl, m.value)),
    );

    const models = allModels.filter((_, i) => visionFlags[i]);

    console.log(
      `[AI] Ollama: ${models.length} image-capable models:`,
      models.map((m) => m.value),
    );

    return {
      ok: true,
      message: `${models.length} of ${allModels.length} models support images`,
      latencyMs: Date.now() - start,
      models,
    };
  } catch (e) {
    console.log("[AI] Ollama exception:", e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
      latencyMs: Date.now() - start,
      models: [],
    };
  }
}

// ── Prompt tests (used after a model is selected) ──────────────────────────
// Returns models: [] so the client keeps the existing loaded list intact.

export async function promptAnthropic(model: string): Promise<TestResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey)
    return { ok: false, message: "ANTHROPIC_API_KEY is not set", latencyMs: 0, models: [] };

  const start = Date.now();
  console.log(`[AI] Anthropic: prompting model ${model}`);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: "user", content: TEST_PROMPT }],
      }),
    });
    const latencyMs = Date.now() - start;
    console.log(`[AI] Anthropic prompt response — status: ${res.status} (${latencyMs}ms)`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.log("[AI] Anthropic prompt error:", JSON.stringify(body));
      return { ok: false, message: body?.error?.message ?? `HTTP ${res.status}`, latencyMs, models: [] };
    }
    const data = await res.json();
    const text = (data.content?.[0]?.text ?? "(empty)").trim();
    return { ok: true, message: `"${text}"`, latencyMs, models: [] };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unknown error", latencyMs: Date.now() - start, models: [] };
  }
}

export async function promptOpenAI(model: string): Promise<TestResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey)
    return { ok: false, message: "OPENAI_API_KEY is not set", latencyMs: 0, models: [] };

  const start = Date.now();
  console.log(`[AI] OpenAI: prompting model ${model}`);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: "user", content: TEST_PROMPT }],
      }),
    });
    const latencyMs = Date.now() - start;
    console.log(`[AI] OpenAI prompt response — status: ${res.status} (${latencyMs}ms)`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.log("[AI] OpenAI prompt error:", JSON.stringify(body));
      return { ok: false, message: body?.error?.message ?? `HTTP ${res.status}`, latencyMs, models: [] };
    }
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content ?? "(empty)").trim();
    return { ok: true, message: `"${text}"`, latencyMs, models: [] };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unknown error", latencyMs: Date.now() - start, models: [] };
  }
}

export async function promptOllama(model: string): Promise<TestResult> {
  const ollamaUrl = process.env.OLLAMA_URL?.trim();
  if (!ollamaUrl)
    return { ok: false, message: "OLLAMA_URL is not set", latencyMs: 0, models: [] };

  const start = Date.now();
  console.log(`[AI] Ollama: prompting model ${model}`);
  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: TEST_PROMPT }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const latencyMs = Date.now() - start;
    console.log(`[AI] Ollama prompt response — status: ${res.status} (${latencyMs}ms)`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      console.log("[AI] Ollama prompt error:", JSON.stringify(body));
      return { ok: false, message: body?.error ?? `HTTP ${res.status}`, latencyMs, models: [] };
    }
    const data = await res.json();
    const text = (data.message?.content ?? "(empty)").trim();
    return { ok: true, message: `"${text}"`, latencyMs, models: [] };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unknown error", latencyMs: Date.now() - start, models: [] };
  }
}
