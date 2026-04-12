import fs from "fs/promises";
import path from "path";
import { db } from "@/src/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * A binary file attachment to send alongside the user prompt.
 * Supported natively by Anthropic (PDFs + images) and OpenAI/Ollama (images).
 * When a provider doesn't support the file type it falls back to text-only.
 */
export type FileAttachment = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

// ── Default system prompt (loaded once per process) ───────────────────────

let _systemPrompt: string | undefined;

async function getSystemPrompt(): Promise<string> {
  if (_systemPrompt !== undefined) return _systemPrompt;
  try {
    const p = path.join(process.cwd(), "prompts", "DEFAULT.md");
    _systemPrompt = (await fs.readFile(p, "utf-8")).trim();
    console.log("[AI] Loaded system prompt from prompts/DEFAULT.md");
  } catch {
    console.warn("[AI] prompts/DEFAULT.md not found — proceeding without system prompt");
    _systemPrompt = "";
  }
  return _systemPrompt;
}

// ── Main entry point ──────────────────────────────────────────────────────

/**
 * Sends a prompt to the configured default AI provider/model.
 *
 * @param userPrompt   The user-turn message.
 * @param systemPrompt Optional override (caller includes DEFAULT.md content).
 *                     When omitted DEFAULT.md is loaded automatically.
 * @param file         Optional file attachment. Sent natively when the provider
 *                     supports the MIME type; ignored otherwise.
 */
export async function generateText(
  userPrompt: string,
  systemPrompt?: string,
  file?: FileAttachment,
): Promise<string> {
  const [settings, resolvedSystem] = await Promise.all([
    db.appSetting.findMany({
      where: {
        key: {
          in: [
            "ai.defaultProvider",
            "ai.anthropic.model",
            "ai.openai.model",
            "ai.ollama.model",
          ],
        },
      },
    }),
    systemPrompt !== undefined ? Promise.resolve(systemPrompt) : getSystemPrompt(),
  ]);

  const sp = resolvedSystem;

  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const provider = map["ai.defaultProvider"];
  const model = map[`ai.${provider}.model`];

  if (!provider || !model) {
    throw new Error(
      "No AI provider configured. Visit Settings → AI Models to set one up.",
    );
  }

  console.log(`[AI] ── generateText ──────────────────────────────────────`);
  console.log(`[AI] provider=${provider}  model=${model}`);
  if (file) console.log(`[AI] file: ${file.fileName} (${file.mimeType}, ${file.buffer.length} bytes)`);
  console.log(`[AI] system prompt (${sp.length} chars), user prompt (${userPrompt.length} chars)`);
  console.log(`[AI] ─────────────────────────────────────────────────────`);

  if (provider === "anthropic") return callAnthropic(model, sp, userPrompt, file);
  if (provider === "openai")    return callOpenAI(model, sp, userPrompt, file);
  if (provider === "ollama")    return callOllama(model, sp, userPrompt, file);

  throw new Error(`Unknown AI provider: ${provider}`);
}

// ── File type helpers ─────────────────────────────────────────────────────

const ANTHROPIC_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);
const OPENAI_IMAGE_TYPES    = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);

// ── Anthropic ─────────────────────────────────────────────────────────────
// Supports: images (JPEG/PNG/GIF/WEBP) + PDFs (via beta document block)

async function callAnthropic(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  file?: FileAttachment,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };

  // Build the user-turn content
  let userContent: unknown;
  if (file) {
    const base64 = file.buffer.toString("base64");
    const parts: unknown[] = [];

    if (file.mimeType === "application/pdf") {
      // PDF support requires the beta header
      headers["anthropic-beta"] = "pdfs-2024-09-25";
      parts.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      });
      console.log(`[AI] Anthropic: sending PDF as document content block`);
    } else if (ANTHROPIC_IMAGE_TYPES.has(file.mimeType)) {
      parts.push({
        type: "image",
        source: { type: "base64", media_type: file.mimeType, data: base64 },
      });
      console.log(`[AI] Anthropic: sending image as image content block`);
    } else {
      // Unsupported binary type — fall back to text-only
      console.log(`[AI] Anthropic: unsupported file type ${file.mimeType}, falling back to text-only`);
    }

    // Always append the text prompt after the file block(s)
    parts.push({ type: "text", text: userPrompt });
    userContent = parts.length > 1 ? parts : userPrompt;
  } else {
    userContent = userPrompt;
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: 2048,
    messages: [{ role: "user", content: userContent }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    console.error(`[AI] Anthropic error body:`, JSON.stringify(data));
    throw new Error(data?.error?.message ?? `Anthropic HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  console.log(`[AI] ANTHROPIC RESPONSE:\n${text}`);
  console.log(`[AI] ─────────────────────────────────────────────────────`);
  return text;
}

// ── OpenAI ────────────────────────────────────────────────────────────────
// Supports: images (JPEG/PNG/GIF/WEBP) via image_url content blocks.
// PDFs are not natively supported — falls back to text-only.

async function callOpenAI(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  file?: FileAttachment,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const messages: unknown[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

  if (file && OPENAI_IMAGE_TYPES.has(file.mimeType)) {
    const base64 = file.buffer.toString("base64");
    console.log(`[AI] OpenAI: sending image as image_url content block`);
    messages.push({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:${file.mimeType};base64,${base64}` },
        },
        { type: "text", text: userPrompt },
      ],
    });
  } else {
    if (file) console.log(`[AI] OpenAI: file type ${file.mimeType} not natively supported, falling back to text-only`);
    messages.push({ role: "user", content: userPrompt });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 2048, messages }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    console.error(`[AI] OpenAI error body:`, JSON.stringify(data));
    throw new Error(data?.error?.message ?? `OpenAI HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  console.log(`[AI] OPENAI RESPONSE:\n${text}`);
  console.log(`[AI] ─────────────────────────────────────────────────────`);
  return text;
}

// ── Ollama ────────────────────────────────────────────────────────────────
// Supports: images for vision-capable models via `images` field in the chat API.
// Known vision model name fragments: llava, bakllava, moondream, minicpm-v,
// gemma3, gemma4, qwen2-vl, phi3-vision, mistral-small3.1, cogvlm, internvl.
// PDFs are not supported — falls back to text-only.

const OLLAMA_VISION_FRAGMENTS = [
  "llava", "bakllava", "moondream", "minicpm-v",
  "gemma3", "gemma4", "qwen2-vl", "phi3-vision",
  "mistral-small3.1", "cogvlm", "internvl",
];

function ollamaSupportsVision(model: string): boolean {
  const lower = model.toLowerCase();
  return OLLAMA_VISION_FRAGMENTS.some((f) => lower.includes(f));
}

async function callOllama(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  file?: FileAttachment,
): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_URL?.trim();
  if (!ollamaUrl) throw new Error("OLLAMA_URL is not set");

  const messages: unknown[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

  if (file && file.mimeType.startsWith("image/")) {
    if (ollamaSupportsVision(model)) {
      const base64 = file.buffer.toString("base64");
      console.log(`[AI] Ollama: sending image (${file.mimeType}, ${file.buffer.length}b) to vision model ${model}`);
      messages.push({ role: "user", content: userPrompt, images: [base64] });
    } else {
      console.warn(`[AI] Ollama: model "${model}" may not support vision — sending text-only prompt (image omitted)`);
      messages.push({ role: "user", content: userPrompt });
    }
  } else {
    if (file) console.log(`[AI] Ollama: file type ${file.mimeType} not natively supported, falling back to text-only`);
    messages.push({ role: "user", content: userPrompt });
  }

  const bodyPayload = { model, stream: false, messages, options: { num_predict: 2048 } };
  console.log(`[AI] Ollama: POST ${ollamaUrl}/api/chat  model=${model}  messages=${messages.length}`);

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(120_000),
  });

  const latencyMs = Date.now(); // approximate — just for logging
  console.log(`[AI] Ollama: response status ${res.status}`);

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    console.error(`[AI] Ollama error body:`, JSON.stringify(errBody));
    throw new Error(errBody?.error ?? `Ollama HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.message?.content ?? "";
  console.log(`[AI] Ollama response (${text.length} chars): ${text.slice(0, 1000)}${text.length > 1000 ? "…" : ""}`);
  console.log(`[AI] ─────────────────────────────────────────────────────`);
  return text;
}
