"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { EventCategory } from "@prisma/client";

// ── Shared constants ───────────────────────────────────────────────────────

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "APPOINTMENT",  label: "Appointment" },
  { value: "DIAGNOSIS",    label: "Diagnosis" },
  { value: "MEDICATION",   label: "Medication" },
  { value: "PROCEDURE",    label: "Procedure" },
  { value: "VACCINATION",  label: "Vaccination" },
  { value: "MEASUREMENT",  label: "Measurement" },
  { value: "SYMPTOM",      label: "Symptom" },
  { value: "ALLERGY",      label: "Allergy" },
  { value: "OTHER",        label: "Other" },
];

function localNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Submit button helpers ──────────────────────────────────────────────────

function CreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2 px-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Creating…" : "Create event"}
    </button>
  );
}

// ── Drop zone ──────────────────────────────────────────────────────────────

function DropZone({
  fileInputRef,
  selectedFile,
  onFileChange,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  selectedFile: File | null;
  onFileChange: (f: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files[0];
    if (!f) return;
    onFileChange(f);
    // Sync to hidden file input so the form submits it
    if (fileInputRef.current) {
      try {
        const dt = new DataTransfer();
        dt.items.add(f);
        fileInputRef.current.files = dt.files;
      } catch {
        // DataTransfer not supported — file is in state and submitted programmatically
      }
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    onFileChange(f);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-colors p-8 text-center ${
        dragging
          ? "border-blue-400 bg-blue-50"
          : selectedFile
          ? "border-green-400 bg-green-50"
          : "border-gray-300 hover:border-gray-400 bg-gray-50"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        name="file"
        className="hidden"
        onChange={handleInputChange}
      />

      {selectedFile ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-800 break-all max-w-xs">{selectedFile.name}</p>
          <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB · click to change</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">
            {dragging ? "Drop file here" : "Drag & drop a file, or click to browse"}
          </p>
          <p className="text-xs text-gray-400">PDF, images, CSV, text files</p>
        </div>
      )}
    </div>
  );
}

// ── Main modal component ───────────────────────────────────────────────────

export default function AddEventModal({
  selectedMemberId,
  uploadAndCreateAction,
  addEventWithFileAction,
}: {
  selectedMemberId: string;
  uploadAndCreateAction: (formData: FormData) => Promise<void>;
  addEventWithFileAction: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "create">("upload");

  // Upload tab state
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPending, startUploadTransition] = useTransition();

  // Create tab state
  const createFileRef = useRef<HTMLInputElement>(null);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [hasDuration, setHasDuration] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Reset state when modal opens
  function handleOpen() {
    setTab("upload");
    setUploadFile(null);
    setCreateFile(null);
    setHasDuration(false);
    setOpen(true);
  }

  // ── Upload tab submission ─────────────────────────────────────────────────
  function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;

    const formData = new FormData();
    formData.append("userId", selectedMemberId);
    formData.append("file", uploadFile);

    startUploadTransition(async () => {
      await uploadAndCreateAction(formData);
      // redirect() in the action navigates the page; modal closes naturally
    });
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        aria-label="Add event"
        className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* Button (stays visible, dimmed by backdrop) */}
      <button
        onClick={() => setOpen(false)}
        aria-label="Add event"
        className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center transition-colors shadow-sm z-50 relative"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modal overlay */}
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />

        {/* Modal card */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Add health event</h2>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-6">
            {(["upload", "create"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "upload" ? "Upload file" : "Create event"}
              </button>
            ))}
          </div>

          {/* ── Upload file tab ─────────────────────────────────────────── */}
          {tab === "upload" && (
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-5">
              <p className="text-sm text-gray-500">
                Upload a medical document and we&apos;ll automatically create an event with the date, title, and summary extracted from the file.
              </p>

              <DropZone
                fileInputRef={uploadFileRef}
                selectedFile={uploadFile}
                onFileChange={setUploadFile}
              />

              <button
                type="submit"
                disabled={!uploadFile || uploadPending}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadPending ? "Processing…" : "Upload & create event"}
              </button>

              {uploadPending && (
                <p className="text-xs text-gray-400 text-center">
                  Analysing file — this may take a moment…
                </p>
              )}
            </form>
          )}

          {/* ── Create event tab ────────────────────────────────────────── */}
          {tab === "create" && (
            <form action={addEventWithFileAction} className="p-6 space-y-4">
              <input type="hidden" name="userId" value={selectedMemberId} />

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Annual checkup"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              {/* Category + Date & time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    name="category"
                    defaultValue="OTHER"
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date &amp; time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="startTime"
                    required
                    defaultValue={localNow()}
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
                    type="datetime-local"
                    name="endTime"
                    defaultValue={localNow()}
                    className="mt-2 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                )}
              </div>

              {/* Summary + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Summary <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    name="summary"
                    rows={3}
                    placeholder="Brief overview of the event…"
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Any additional details…"
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Optional file */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Attach file <span className="text-gray-400 font-normal">(optional — AI will extract summary)</span>
                </p>
                <DropZone
                  fileInputRef={createFileRef}
                  selectedFile={createFile}
                  onFileChange={setCreateFile}
                />
              </div>

              <CreateSubmitButton />
            </form>
          )}
        </div>
      </div>
    </>
  );
}
