"use client";

import { useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { EventCategory } from "@prisma/client";
import FileViewerModal, { FileTypeIcon } from "@/src/components/FileViewerModal";
import type { ViewerFile } from "@/src/components/FileViewerModal";

export type EditingEntry = {
  entryId: string;
  eventId: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: EventCategory;
  startTimeInput: string; // "YYYY-MM-DDTHH:MM" in member's tz
  endTimeInput: string | null;
};

export type EventDetailRow = {
  id: string;
  sourceType: string;
  originalText: string | null;
  fileName: string | null;
  filePath: string | null;
  mimeType: string | null;
  documentType: string | null;
  processed: boolean;
  createdAt: string; // ISO
};

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "DIAGNOSIS", label: "Diagnosis" },
  { value: "MEDICATION", label: "Medication" },
  { value: "PROCEDURE", label: "Procedure" },
  { value: "VACCINATION", label: "Vaccination" },
  { value: "MEASUREMENT", label: "Measurement" },
  { value: "SYMPTOM", label: "Symptom" },
  { value: "ALLERGY", label: "Allergy" },
  { value: "OTHER", label: "Other" },
];

function FileUploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-1.5 px-3 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Uploading…" : "Upload"}
    </button>
  );
}

function localNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AddEventForm({
  selectedMemberId,
  addAction,
  updateAction,
  editing,
  cancelHref,
  returnPath = "/dashboard",
  editingDetails,
  addTextDetailAction,
  addFileDetailAction,
  deleteDetailAction,
  deleteEventAction,
  wideLayout = false,
}: {
  selectedMemberId: string;
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  editing: EditingEntry | null;
  cancelHref: string;
  /** Base path the server actions redirect back to (e.g. /dashboard or /timeline) */
  returnPath?: string;
  editingDetails?: EventDetailRow[];
  addTextDetailAction?: (formData: FormData) => Promise<void>;
  addFileDetailAction?: (formData: FormData) => Promise<void>;
  deleteDetailAction?: (formData: FormData) => Promise<void>;
  deleteEventAction?: (formData: FormData) => Promise<void>;
  wideLayout?: boolean;
}) {
  const isEditing = editing !== null;
  const now = localNow();

  const [hasDuration, setHasDuration] = useState(
    isEditing && editing.endTimeInput !== null,
  );
  const [detailTab, setDetailTab] = useState<"text" | "file">("text");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewer, setViewer] = useState<ViewerFile | null>(null);

  useEffect(() => {
    setHasDuration(isEditing && editing?.endTimeInput !== null);
  }, [isEditing, editing?.entryId, editing?.endTimeInput]);

  // Reset tab when switching between entries
  useEffect(() => {
    setDetailTab("text");
  }, [editing?.entryId]);

  const showDetails =
    isEditing &&
    editingDetails !== undefined &&
    addTextDetailAction !== undefined &&
    addFileDetailAction !== undefined;

  const inner = (
    <>
      {/* ── Event form ─────────────────────────────────── */}
      <div className={wideLayout ? "px-6 pt-5 pb-4" : "p-5"}>
        {!wideLayout && (
          <p className="text-sm font-medium text-gray-700 mb-4">
            {isEditing ? "Edit event" : "Add event"}
          </p>
        )}

        <form action={isEditing ? updateAction : addAction} className="space-y-4">
          <input type="hidden" name="userId" value={selectedMemberId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          {isEditing && (
            <>
              <input type="hidden" name="entryId" value={editing.entryId} />
              <input type="hidden" name="eventId" value={editing.eventId} />
            </>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              key={editing?.entryId ?? "new"}
              type="text"
              name="title"
              required
              defaultValue={editing?.title ?? ""}
              placeholder="e.g. Annual checkup"
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          {/* Category + Date & time — side by side when wide */}
          <div className={wideLayout ? "grid grid-cols-2 gap-4" : "space-y-4"}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                key={editing?.entryId ?? "new"}
                name="category"
                defaultValue={editing?.category ?? "OTHER"}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date &amp; time <span className="text-red-500">*</span>
              </label>
              <input
                key={editing?.entryId ?? "new"}
                type="datetime-local"
                name="startTime"
                required
                defaultValue={editing?.startTimeInput ?? now}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Optional end time */}
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasDuration}
                onChange={(e) => setHasDuration(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Has end time (duration event)
            </label>
            {hasDuration && (
              <input
                key={editing?.entryId ?? "new"}
                type="datetime-local"
                name="endTime"
                defaultValue={editing?.endTimeInput ?? now}
                className="mt-2 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            )}
          </div>

          {/* Summary + Notes — side by side when wide */}
          <div className={wideLayout ? "grid grid-cols-2 gap-4" : "space-y-4"}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Summary{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                key={editing?.entryId ?? "new"}
                name="summary"
                rows={3}
                defaultValue={editing?.summary ?? ""}
                placeholder="Brief overview of the event…"
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                key={editing?.entryId ?? "new"}
                name="description"
                rows={3}
                defaultValue={editing?.description ?? ""}
                placeholder="Any additional details…"
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2 px-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isEditing ? "Save changes" : "Add event"}
            </button>
            {isEditing && (
              <Link
                href={cancelHref}
                className="py-2 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
            )}
          </div>
        </form>

        {/* ── Delete event ── */}
        {isEditing && deleteEventAction && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 px-4 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
              >
                Delete event
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-700 text-center">
                  Delete <span className="font-medium">{editing!.title}</span>? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <form action={deleteEventAction} className="flex-1">
                    <input type="hidden" name="userId" value={selectedMemberId} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <input type="hidden" name="entryId" value={editing!.entryId} />
                    <input type="hidden" name="eventId" value={editing!.eventId} />
                    <button
                      type="submit"
                      className="w-full py-2 px-4 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                      Yes, delete
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Inline details section (only when editing) ── */}
      {showDetails && (
        <div className="border-t border-gray-200">
          {/* Existing details */}
          {editingDetails!.length > 0 && (
            <div className="divide-y divide-gray-100">
              <p className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Details ({editingDetails!.length})
              </p>
              {editingDetails!.map((detail) => (
                <div key={detail.id} className="px-5 py-3 flex items-start gap-2">
                  {/* File icon — clickable if there's a file to view */}
                  {detail.sourceType === "file" && detail.filePath ? (
                    <button
                      type="button"
                      title={`View ${detail.fileName ?? "file"}`}
                      onClick={() =>
                        setViewer({
                          url: `/api/files/${detail.filePath}`,
                          mimeType: detail.mimeType,
                          fileName: detail.fileName,
                        })
                      }
                      className="shrink-0 mt-0.5 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <FileTypeIcon
                        mimeType={detail.mimeType}
                        fileName={detail.fileName}
                        className="w-3.5 h-3.5"
                      />
                    </button>
                  ) : (
                    <div className="shrink-0 mt-0.5 text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {detail.documentType && (
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {detail.documentType}
                      </p>
                    )}
                    {detail.filePath ? (
                      <button
                        type="button"
                        onClick={() =>
                          setViewer({
                            url: `/api/files/${detail.filePath}`,
                            mimeType: detail.mimeType,
                            fileName: detail.fileName,
                          })
                        }
                        className="text-xs text-blue-600 hover:underline truncate block max-w-full text-left"
                      >
                        {detail.fileName ?? "View file"}
                      </button>
                    ) : (
                      <>
                        {detail.fileName && (
                          <p className="text-xs text-gray-400 truncate">{detail.fileName}</p>
                        )}
                        {!detail.documentType && !detail.fileName && (
                          <p className="text-xs text-gray-400 italic">
                            {detail.processed ? "Text note" : "Processing…"}
                          </p>
                        )}
                      </>
                    )}
                    {detail.originalText && !detail.filePath && (
                      <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                        {detail.originalText.slice(0, 120)}
                        {detail.originalText.length > 120 && "…"}
                      </p>
                    )}
                  </div>

                  {/* Delete */}
                  {deleteDetailAction && (
                    <form action={deleteDetailAction} className="shrink-0">
                      <input type="hidden" name="userId" value={selectedMemberId} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <input type="hidden" name="entryId" value={editing!.entryId} />
                      <input type="hidden" name="detailId" value={detail.id} />
                      {detail.filePath && (
                        <input type="hidden" name="filePath" value={detail.filePath} />
                      )}
                      <button
                        type="submit"
                        className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                        title="Delete detail"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add detail */}
          <div className="px-5 py-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Add detail
            </p>

            {/* Tabs */}
            <div className="flex gap-1 mb-3 border-b border-gray-200">
              {(["text", "file"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDetailTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                    detailTab === t
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "text" ? "Paste text" : "Upload file"}
                </button>
              ))}
            </div>

            {detailTab === "text" ? (
              <form action={addTextDetailAction} className="space-y-2">
                <input type="hidden" name="userId" value={selectedMemberId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <input type="hidden" name="entryId" value={editing!.entryId} />
                <input type="hidden" name="eventId" value={editing!.eventId} />
                <textarea
                  name="text"
                  rows={5}
                  required
                  placeholder="Paste a lab result, appointment notes, prescription…"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs font-mono"
                />
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Add &amp; process
                </button>
              </form>
            ) : (
              <form action={addFileDetailAction} className="space-y-2">
                <input type="hidden" name="userId" value={selectedMemberId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <input type="hidden" name="entryId" value={editing!.entryId} />
                <input type="hidden" name="eventId" value={editing!.eventId} />
                <input
                  type="file"
                  name="file"
                  required
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-400">
                  Text files (.txt, .csv, etc.) will be read and sent for analysis.
                </p>
                <FileUploadButton />
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );

  const modal = viewer ? (
    <FileViewerModal file={viewer} onClose={() => setViewer(null)} />
  ) : null;

  if (wideLayout) return <>{inner}{modal}</>;
  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {inner}
      </div>
      {modal}
    </>
  );
}
