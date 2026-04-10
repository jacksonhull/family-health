import fs from "fs/promises";
import path from "path";
import { db } from "@/src/lib/db";
import { generateText, type FileAttachment } from "./chat";

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

type TableRow = string[];

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

function parseAiResponse(raw: string): AiResponse {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found");
    const parsed = JSON.parse(match[0]);
    return {
      documentType: String(parsed.documentType ?? "Document").slice(0, 100),
      summary: String(parsed.summary ?? "").slice(0, 2000),
      tableData: Array.isArray(parsed.tableData) ? parsed.tableData : undefined,
    };
  } catch {
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
        t.rows.forEach((row) => lines.push(row.join(" | ")));
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
  }
}
