import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/auth";
import fs from "fs/promises";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { path: pathParts } = await params;
  const relPath = pathParts.join("/");

  const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
  const absPath = path.resolve(path.join(uploadDir, relPath));

  // Prevent path traversal
  if (!absPath.startsWith(path.resolve(uploadDir))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const buffer = await fs.readFile(absPath);
    const ext = path.extname(relPath).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";

    const fileName = path.basename(relPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}

const MIME_MAP: Record<string, string> = {
  // Images
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  // Video
  ".mp4":  "video/mp4",
  ".mov":  "video/quicktime",
  ".webm": "video/webm",
  ".avi":  "video/x-msvideo",
  // Documents
  ".pdf":  "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc":  "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Text
  ".txt":  "text/plain; charset=utf-8",
  ".csv":  "text/csv; charset=utf-8",
  ".json": "application/json",
};
