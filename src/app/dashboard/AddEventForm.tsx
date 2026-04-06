"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { EventCategory } from "@prisma/client";

export type EditingEntry = {
  entryId: string;
  eventId: string;
  title: string;
  description: string | null;
  category: EventCategory;
  startTimeInput: string; // "YYYY-MM-DDTHH:MM" in member's tz
  endTimeInput: string | null;
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
}: {
  selectedMemberId: string;
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  editing: EditingEntry | null;
  cancelHref: string;
}) {
  const isEditing = editing !== null;
  const now = localNow();

  // Track end-time toggle — on when editing a duration event, off otherwise
  const [hasDuration, setHasDuration] = useState(
    isEditing && editing.endTimeInput !== null,
  );

  // Re-sync when the editing entry changes (e.g. user clicks a different Edit)
  useEffect(() => {
    setHasDuration(isEditing && editing?.endTimeInput !== null);
  }, [isEditing, editing?.entryId, editing?.endTimeInput]);

  return (
    <form action={isEditing ? updateAction : addAction} className="space-y-4">
      {/* Hidden fields */}
      <input type="hidden" name="userId" value={selectedMemberId} />
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

      {/* Category */}
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

      {/* Start time */}
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

      {/* Notes */}
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
  );
}
