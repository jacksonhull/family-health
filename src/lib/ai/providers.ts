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

// ── Anthropic ──────────────────────────────────────────────────────────────
// Uses GET /v1/models to both verify the key and list available models.

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
    console.log("[AI] Anthropic models:", JSON.stringify(data));
    const models: ModelOption[] = (data.data ?? []).map(
      (m: { id: string; display_name: string }) => ({
        value: m.id,
        label: m.display_name ?? m.id,
      }),
    );
    return {
      ok: true,
      message: `${models.length} model(s) available`,
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
// Uses GET /v1/models, filters to chat-capable models only.

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
    const models: ModelOption[] = (data.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) =>
        OPENAI_CHAT_PREFIXES.some((prefix) => id.startsWith(prefix)),
      )
      .sort((a: string, b: string) => b.localeCompare(a)) // newest first
      .map((id: string) => ({ value: id, label: id }));

    console.log(
      "[AI] OpenAI chat models:",
      models.map((m) => m.value),
    );
    return {
      ok: true,
      message: `${models.length} model(s) available`,
      latencyMs,
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
    console.log("[AI] Ollama models:", JSON.stringify(data));
    const models: ModelOption[] = (data.models ?? [])
      .map((m: { name: string }) => ({ value: m.name, label: m.name }))
      .sort((a: ModelOption, b: ModelOption) => a.label.localeCompare(b.label));

    return {
      ok: true,
      message: `${models.length} model(s) available`,
      latencyMs,
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
