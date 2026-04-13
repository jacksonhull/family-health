import fs from "fs/promises";
import path from "path";
import { db } from "@/src/lib/db";
import { localToUtc } from "@/src/lib/timezone";
import { generateText, type FileAttachment } from "./chat";
import type { EventCategory } from "@prisma/client";

// ── File type detection ───────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  "txt", "csv", "tsv", "json", "xml", "md", "log",
  "html", "htm", "rtf", "yaml", "yml", "ini", "cfg",
]);

export function isTextBasedFile(name: string, type: string): boolean {
  if (type.startsWith("text/") || type === "application/json") return true;
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

// ── Prompt loading ────────────────────────────────────────────────────────

const DEFAULT_HISTORY =
  "The patient has no known history of illness or other medical conditions.";

async function loadPromptFile(name: string): Promise<string> {
  try {
    const p = path.join(process.cwd(), "prompts", `${name}.md`);
    return (await fs.readFile(p, "utf-8")).trim();
  } catch {
    console.warn(`[AI] prompts/${name}.md not found`);
    return "";
  }
}

async function getPatientHistory(userId: string): Promise<string> {
  const record = await db.medicalHistory.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { summary: true },
  });
  return record?.summary ?? DEFAULT_HISTORY;
}

async function buildSystemPrompt(userId: string, isFile: boolean): Promise<string> {
  const [defaultPrompt, historyTemplate, filePrompt, patientHistory] =
    await Promise.all([
      loadPromptFile("DEFAULT"),
      loadPromptFile("HISTORY"),
      isFile ? loadPromptFile("FILE") : Promise.resolve(""),
      getPatientHistory(userId),
    ]);

  const historyPrompt = historyTemplate.replace("<patientHistory/>", patientHistory);

  return [defaultPrompt, historyPrompt, isFile ? filePrompt : ""]
    .filter(Boolean)
    .join("\n\n");
}

// ── Response parsing ──────────────────────────────────────────────────────

type TableRow = string[] | Record<string, unknown>;

interface TableData {
  name?: string;
  headers?: string[];
  rows?: TableRow[];
}

interface AiResponse {
  documentType: string;
  summary: string;
  tableData?: TableData[];
}

// Extended response for auto-creating events from a file upload
interface AiEventResponse extends AiResponse {
  title: string;
  category: EventCategory;
  eventDate: string | null;  // YYYY-MM-DD
  eventTime: string | null;  // HH:MM (24h)
}

const VALID_CATEGORIES = new Set<EventCategory>([
  "APPOINTMENT", "DIAGNOSIS", "MEDICATION", "PROCEDURE",
  "VACCINATION", "MEASUREMENT", "SYMPTOM", "ALLERGY", "OTHER",
]);

function stripFences(raw: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

/** Extract a single string field value from raw JSON-like text using regex.
 *  Works even when the JSON is truncated, as long as the field itself is complete. */
function extractStringField(raw: string, key: string): string | null {
  const match = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!match) return null;
  // Unescape basic JSON escape sequences
  return match[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function extractJson(raw: string): unknown {
  const cleaned = stripFences(raw);
  // Try direct parse first (handles well-formed responses)
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  // Try extracting the first {...} block (handles leading/trailing text)
  const block = cleaned.match(/\{[\s\S]*\}/);
  if (block) {
    try { return JSON.parse(block[0]); } catch { /* fall through */ }
  }
  // JSON is truncated — extract individual string fields via regex
  // and return a partial object (tableData will be missing but that's ok)
  const partial: Record<string, string | null> = {};
  for (const key of ["documentType", "title", "category", "eventDate", "eventTime", "summary"]) {
    partial[key] = extractStringField(cleaned, key);
  }
  if (!partial.summary && !partial.title) throw new Error("No usable fields found in truncated response");
  return partial;
}

function parseAiResponse(raw: string): AiResponse {
  try {
    const parsed = extractJson(raw) as Record<string, unknown>;
    return {
      documentType: String(parsed.documentType ?? "Document").slice(0, 100),
      summary: String(parsed.summary ?? "").slice(0, 2000),
      tableData: Array.isArray(parsed.tableData) ? parsed.tableData : undefined,
    };
  } catch (e) {
    console.warn("[AI] parseAiResponse failed:", String(e), "| raw:", raw.slice(0, 300));
    return { documentType: "Document", summary: raw.trim().slice(0, 2000) };
  }
}

/**
 * Formats extracted tables as readable plain text for storage and display.
 * e.g.
 *   ## CBC Results
 *   Test Name | Result | Reference Range | Unit
 *   Hemoglobin | 12.5 | 13.0–17.0 | g/dL
 */
function formatTables(tables: TableData[]): string {
  return tables
    .map((t) => {
      const lines: string[] = [];
      if (t.name) lines.push(`## ${t.name}`);
      if (t.headers?.length) lines.push(t.headers.join(" | "));
      if (t.rows?.length) {
        t.rows.forEach((row) => {
          // Row can be an array of strings/values, or an object (LLM returned keyed rows)
          if (Array.isArray(row)) {
            lines.push(row.join(" | "));
          } else if (row && typeof row === "object") {
            lines.push(Object.values(row as Record<string, unknown>).join(" | "));
          }
        });
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

// ── Main processing function ──────────────────────────────────────────────

export async function processEventDetail(
  detailId: string,
  eventId: string,
  text: string | null,
  fileName: string | null,
  mimeType: string | null,
): Promise<void> {
  const isFile = fileName !== null;
  const hasText = Boolean(text && text.trim().length > 0);

  const entry = await db.timelineEntry.findFirst({
    where: { eventId },
    select: { userId: true },
  });

  const systemPrompt = entry?.userId
    ? await buildSystemPrompt(entry.userId, isFile)
    : await loadPromptFile("DEFAULT");

  // ── Build user prompt + optional file attachment ──────────────────────

  let userPrompt: string;
  let fileAttachment: FileAttachment | undefined;

  if (hasText) {
    userPrompt = `Analyze the following medical document. Respond with a JSON object only — no markdown fences, no explanation:
{
  "documentType": "brief label (e.g. lab results, prescription, discharge summary, appointment notes, imaging report, vaccination record)",
  "summary": "1–3 sentence summary of the key medical information",
  "tableData": [
    {
      "name": "table name or description",
      "headers": ["column1", "column2"],
      "rows": [["value1", "value2"]]
    }
  ]
}

Use an empty array for tableData if no tables are present.

Document:
${text!.slice(0, 8000)}`;

  } else if (isFile) {
    // Load the binary file from disk for native LLM processing
    const detail = await db.eventDetail.findUnique({
      where: { id: detailId },
      select: { filePath: true },
    });

    if (detail?.filePath) {
      try {
        const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
        const absPath = path.join(uploadDir, detail.filePath);
        const buffer = await fs.readFile(absPath);
        fileAttachment = {
          buffer,
          mimeType: mimeType ?? "application/octet-stream",
          fileName: fileName!,
        };
        console.log(`[AI] Loaded file for native processing: ${absPath} (${buffer.length} bytes)`);
      } catch (e) {
        console.error(`[AI] Could not read file ${detail.filePath}:`, e);
      }
    }

    userPrompt = `Please analyze this medical file${fileAttachment ? "" : ` named "${fileName}"`}. Extract all text, tabular data, and any medically relevant content. Respond with a JSON object only — no markdown fences, no explanation:
{
  "documentType": "brief label (e.g. lab results, prescription, discharge summary, appointment notes, imaging report, vaccination record)",
  "summary": "200 words or less — describe the file contents and your analysis in context of the patient history",
  "tableData": [
    {
      "name": "table name or description",
      "headers": ["column1", "column2"],
      "rows": [["value1", "value2"]]
    }
  ]
}

Use an empty array for tableData if no tables are present.`;

  } else {
    userPrompt = `Respond with a JSON object: { "documentType": "Unknown", "summary": "No content provided.", "tableData": [] }`;
  }

  // ── Send to LLM ───────────────────────────────────────────────────────

  try {
    const raw = await generateText(userPrompt, systemPrompt, fileAttachment);
    const { documentType, summary, tableData } = parseAiResponse(raw);

    // For binary files where originalText was null, backfill it with the
    // formatted table data so it appears in the detail card preview.
    const extractedText =
      !hasText && tableData && tableData.length > 0
        ? formatTables(tableData)
        : undefined;

    if (tableData && tableData.length > 0) {
      console.log(`[AI] Extracted ${tableData.length} table(s):`);
      tableData.forEach((t, i) =>
        console.log(`[AI]   Table ${i + 1}: "${t.name ?? "unnamed"}" — ${t.rows?.length ?? 0} rows`),
      );
    } else {
      console.log(`[AI] No tabular data extracted`);
    }

    await db.$transaction([
      db.eventDetail.update({
        where: { id: detailId },
        data: {
          documentType,
          processed: true,
          ...(extractedText !== undefined ? { originalText: extractedText } : {}),
        },
      }),
      db.event.update({
        where: { id: eventId },
        data: { summary },
      }),
    ]);

    console.log(`[AI] Processed detail ${detailId}: type="${documentType}"`);
  } catch (e) {
    console.error(`[AI] Failed to process detail ${detailId}:`, e);
    return;
  }

  if (entry?.userId) {
    await refreshMedicalSummary(entry.userId);
  }
}

// ── Auto-create event from file ────────────────────────────────────────────
// Used by the "Upload file" flow where no event exists yet.
// Runs the LLM with an extended schema that also extracts title, category,
// and event date/time, then updates the placeholder event + entry created
// by the server action before calling this function.

function parseAiEventResponse(raw: string): AiEventResponse {
  try {
    const parsed = extractJson(raw) as Record<string, unknown>;
    const category = VALID_CATEGORIES.has(parsed.category as EventCategory)
      ? (parsed.category as EventCategory)
      : "OTHER";
    return {
      documentType: String(parsed.documentType ?? "Document").slice(0, 100),
      title: String(parsed.title ?? "Uploaded document").slice(0, 200),
      category,
      eventDate: typeof parsed.eventDate === "string" ? parsed.eventDate : null,
      eventTime: typeof parsed.eventTime === "string" ? parsed.eventTime : null,
      summary: String(parsed.summary ?? "").slice(0, 2000),
      tableData: Array.isArray(parsed.tableData) ? parsed.tableData : undefined,
    };
  } catch (e) {
    console.warn("[AI] parseAiEventResponse failed:", String(e), "| raw:", raw.slice(0, 300));
    return {
      documentType: "Document",
      title: "Uploaded document",
      category: "OTHER",
      eventDate: null,
      eventTime: null,
      summary: raw.trim().slice(0, 2000),
    };
  }
}

/**
 * Process a file upload that auto-creates an event.
 * The server action creates a placeholder Event + TimelineEntry first,
 * then calls this to populate them with AI-extracted data.
 */
export async function processNewEventFromFile(
  detailId: string,
  eventId: string,
  entryId: string,
  fileName: string,
  mimeType: string | null,
  userId: string,
  memberTz: string,
): Promise<void> {
  const systemPrompt = await buildSystemPrompt(userId, true);

  // Load file from disk
  const detail = await db.eventDetail.findUnique({
    where: { id: detailId },
    select: { filePath: true, originalText: true },
  });

  let fileAttachment: FileAttachment | undefined;
  let hasText = Boolean(detail?.originalText?.trim());

  if (detail?.filePath && !hasText) {
    try {
      const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
      const absPath = path.join(uploadDir, detail.filePath);
      const buffer = await fs.readFile(absPath);
      fileAttachment = { buffer, mimeType: mimeType ?? "application/octet-stream", fileName };
      console.log(`[AI] processNewEventFromFile: loaded ${absPath} (${buffer.length} bytes)`);
    } catch (e) {
      console.error(`[AI] processNewEventFromFile: could not read file:`, e);
    }
  }

  const textContent = hasText ? detail!.originalText!.slice(0, 8000) : null;

  const userPrompt = `Analyze this medical document${fileAttachment ? "" : ` named "${fileName}"`}. Extract all content and infer the event details. Respond with JSON only — no markdown fences:
{
  "documentType": "brief label (e.g. lab results, prescription, discharge summary, imaging report, vaccination record)",
  "title": "short event title, 8 words max (e.g. 'Annual Blood Test', 'GP Appointment', 'MMR Vaccination')",
  "category": "APPOINTMENT|DIAGNOSIS|MEDICATION|PROCEDURE|VACCINATION|MEASUREMENT|SYMPTOM|ALLERGY|OTHER",
  "eventDate": "YYYY-MM-DD — the date the event occurred as stated in the document, or null if not found",
  "eventTime": "HH:MM in 24-hour format — time the event occurred, or null if not found",
  "summary": "200 words or less — describe the contents and your analysis in context of the patient history",
  "tableData": [
    {
      "name": "table name",
      "headers": ["col1", "col2"],
      "rows": [["val1", "val2"]]
    }
  ]
}

Use an empty array for tableData if no tables are present.${textContent ? `\n\nDocument:\n${textContent}` : ""}`;

  try {
    const raw = await generateText(userPrompt, systemPrompt, fileAttachment);
    const { documentType, title, category, eventDate, eventTime, summary, tableData } =
      parseAiEventResponse(raw);

    // Determine startTime from extracted date, fall back to now
    let startTime: Date | undefined;
    if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      const localStr = `${eventDate}T${eventTime && /^\d{2}:\d{2}$/.test(eventTime) ? eventTime : "00:00"}`;
      try {
        startTime = localToUtc(localStr, memberTz);
        console.log(`[AI] processNewEventFromFile: extracted date ${localStr} → ${startTime.toISOString()}`);
      } catch {
        console.warn(`[AI] processNewEventFromFile: could not parse date "${localStr}"`);
      }
    }

    const extractedText =
      !hasText && tableData && tableData.length > 0 ? formatTables(tableData) : undefined;

    if (tableData?.length) {
      console.log(`[AI] processNewEventFromFile: ${tableData.length} table(s) extracted`);
    }

    await db.$transaction([
      db.event.update({
        where: { id: eventId },
        data: { title, category, summary },
      }),
      db.eventDetail.update({
        where: { id: detailId },
        data: {
          documentType,
          processed: true,
          ...(extractedText !== undefined ? { originalText: extractedText } : {}),
        },
      }),
      ...(startTime
        ? [db.timelineEntry.update({ where: { id: entryId }, data: { startTime } })]
        : []),
    ]);

    console.log(`[AI] processNewEventFromFile: event updated — title="${title}" category=${category}`);
  } catch (e) {
    console.error(`[AI] processNewEventFromFile failed:`, e);
    return;
  }

  await refreshMedicalSummary(userId);
}

// ── Medical summary refresh ────────────────────────────────────────────────
// Called after any event is processed. Merges the new event data into the
// patient's running medical summary using a second AI pass.

export async function refreshMedicalSummary(userId: string): Promise<void> {
  try {
    // Load prompt template + current summary + 10 most recent events in parallel
    const [promptTemplate, currentSummary, entries] = await Promise.all([
      loadPromptFile("MEDICAL_SUMMARY"),
      getPatientHistory(userId),
      db.timelineEntry.findMany({
        where: { userId },
        orderBy: { startTime: "desc" },
        take: 10,
        select: {
          startTime: true,
          event: { select: { title: true, category: true, summary: true } },
        },
      }),
    ]);

    if (!promptTemplate) {
      console.warn("[AI] MEDICAL_SUMMARY.md not found — skipping summary refresh");
      return;
    }
    if (entries.length === 0) return;

    const eventLines = entries
      .map((e) => {
        const date = e.startTime.toISOString().split("T")[0];
        const cat  = e.event.category.charAt(0) + e.event.category.slice(1).toLowerCase();
        const snip = e.event.summary?.trim().slice(0, 200) ?? "";
        return `• [${date}] ${cat}: ${e.event.title}${snip ? `\n  ${snip}` : ""}`;
      })
      .join("\n");

    const userPrompt = promptTemplate
      .replace("<currentMedicalSummary/>", currentSummary)
      .replace("<previous10MedicalSummaries/>", eventLines);

    const systemPrompt = await loadPromptFile("DEFAULT");

    console.log(`[AI] refreshMedicalSummary prompt:\n${"─".repeat(60)}\n${userPrompt}\n${"─".repeat(60)}`);
    const updated = (await generateText(userPrompt, systemPrompt)).trim();
    if (!updated) return;

    await db.medicalHistory.create({ data: { userId, summary: updated } });
    console.log(`[AI] Medical summary refreshed for user ${userId}`);
  } catch (e) {
    console.error(`[AI] refreshMedicalSummary failed:`, e);
  }
}
