"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type ViewerFile = {
  url: string;
  mimeType: string | null;
  fileName: string | null;
};

// ── Mime helpers ───────────────────────────────────────────────────────────

function isImage(mimeType: string | null) {
  return !!mimeType?.startsWith("image/");
}
function isVideo(mimeType: string | null) {
  return !!mimeType?.startsWith("video/");
}
function isPdf(mimeType: string | null) {
  return mimeType === "application/pdf";
}
function isDocx(mimeType: string | null, fileName: string | null) {
  return (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName?.toLowerCase().endsWith(".docx") === true
  );
}

// ── File type icon (exported for reuse) ───────────────────────────────────

export function FileTypeIcon({
  mimeType,
  fileName,
  className = "w-3.5 h-3.5",
}: {
  mimeType: string | null;
  fileName?: string | null;
  className?: string;
}) {
  if (isImage(mimeType)) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (isVideo(mimeType)) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    );
  }
  if (isPdf(mimeType)) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  if (isDocx(mimeType, fileName ?? null)) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  // Generic attachment
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

// ── DOCX viewer (client-side conversion via mammoth) ───────────────────────

function DocxViewer({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function convert() {
      try {
        const [res, mammoth] = await Promise.all([
          fetch(url),
          import("mammoth"),
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setHtml(result.value);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to convert document.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    convert();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 p-12 text-gray-400">
        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="text-sm">Converting document…</p>
      </div>
    );
  }
  if (error || !html) {
    return (
      <div className="text-center p-8">
        <p className="text-sm text-red-500 mb-2">{error ?? "Preview unavailable."}</p>
      </div>
    );
  }
  return (
    <div
      className="w-full h-full overflow-y-auto p-8 prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────

export default function FileViewerModal({
  file,
  onClose,
}: {
  file: ViewerFile;
  onClose: () => void;
}) {
  const { url, mimeType, fileName } = file;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const image = isImage(mimeType);
  const video = isVideo(mimeType);
  const pdf   = isPdf(mimeType);
  const docx  = isDocx(mimeType, fileName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <FileTypeIcon mimeType={mimeType} fileName={fileName} className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-sm font-medium text-gray-700 truncate">
              {fileName ?? "File"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <a
              href={url}
              download={fileName ?? undefined}
              className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto bg-gray-50 flex items-center justify-center">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={fileName ?? "image"}
              className="max-w-full max-h-full object-contain p-4"
            />
          )}
          {video && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={url}
              controls
              className="max-w-full max-h-full"
              style={{ maxHeight: "calc(92vh - 56px)" }}
            />
          )}
          {pdf && (
            <iframe
              src={url}
              title={fileName ?? "PDF"}
              className="w-full border-0"
              style={{ height: "calc(92vh - 56px)" }}
            />
          )}
          {docx && <DocxViewer url={url} />}
          {!image && !video && !pdf && !docx && (
            <div className="text-center p-10">
              <FileTypeIcon mimeType={mimeType} fileName={fileName} className="w-10 h-10 text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-gray-500 mb-4">
                Preview not available for this file type.
              </p>
              <a
                href={url}
                download={fileName ?? undefined}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
              >
                Download {fileName}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
