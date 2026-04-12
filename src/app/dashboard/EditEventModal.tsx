"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AddEventForm from "./AddEventForm";
import type { EditingEntry, EventDetailRow } from "./AddEventForm";

export default function EditEventModal({
  editing,
  editingDetails,
  selectedMemberId,
  cancelHref,
  addAction,
  updateAction,
  addTextDetailAction,
  addFileDetailAction,
  deleteDetailAction,
  deleteEventAction,
}: {
  editing: EditingEntry | null;
  editingDetails: EventDetailRow[];
  selectedMemberId: string;
  cancelHref: string;
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  addTextDetailAction: (formData: FormData) => Promise<void>;
  addFileDetailAction: (formData: FormData) => Promise<void>;
  deleteDetailAction: (formData: FormData) => Promise<void>;
  deleteEventAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && editing) router.push(cancelHref);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, cancelHref, router]);

  if (!editing) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => router.push(cancelHref)}
      />

      {/* Modal card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-gray-800">Edit event</h2>
          <button
            onClick={() => router.push(cancelHref)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form content */}
        <AddEventForm
          selectedMemberId={selectedMemberId}
          addAction={addAction}
          updateAction={updateAction}
          editing={editing}
          cancelHref={cancelHref}
          editingDetails={editingDetails}
          addTextDetailAction={addTextDetailAction}
          addFileDetailAction={addFileDetailAction}
          deleteDetailAction={deleteDetailAction}
          deleteEventAction={deleteEventAction}
          wideLayout
        />
      </div>
    </div>
  );
}
