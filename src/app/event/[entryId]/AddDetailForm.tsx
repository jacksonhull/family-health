"use client";

import { useState } from "react";

type Tab = "text" | "file";

export default function AddDetailForm({
  entryId,
  eventId,
  addTextAction,
  addFileAction,
}: {
  entryId: string;
  eventId: string;
  addTextAction: (formData: FormData) => Promise<void>;
  addFileAction: (formData: FormData) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("text");

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-700 mb-4">Add detail</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(["text", "file"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "text" ? "Paste text" : "Upload file"}
          </button>
        ))}
      </div>

      {tab === "text" ? (
        <form action={addTextAction} className="space-y-4">
          <input type="hidden" name="entryId" value={entryId} />
          <input type="hidden" name="eventId" value={eventId} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Text
            </label>
            <textarea
              name="text"
              rows={8}
              required
              placeholder="Paste a medical document, lab results, appointment notes…"
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono text-xs"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add &amp; process
          </button>
        </form>
      ) : (
        <form action={addFileAction} className="space-y-4">
          <input type="hidden" name="entryId" value={entryId} />
          <input type="hidden" name="eventId" value={eventId} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File
            </label>
            <input
              type="file"
              name="file"
              required
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-400">
              Text files will be extracted and sent to the AI for analysis. All
              file types are stored.
            </p>
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Upload &amp; process
          </button>
        </form>
      )}
    </div>
  );
}
