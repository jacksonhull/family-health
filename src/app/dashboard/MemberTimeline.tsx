"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EventCategory } from "@prisma/client";
import FileViewerModal, { FileTypeIcon } from "@/src/components/FileViewerModal";
import type { ViewerFile } from "@/src/components/FileViewerModal";

export type TimelineFileRow = {
  id: string;
  fileName: string | null;
  filePath: string | null;
  mimeType: string | null;
};

export type TimelineEntryRow = {
  id: string;
  startTime: string; // ISO UTC
  endTime: string | null;
  event: {
    id: string;
    title: string;
    summary: string | null;
    description: string | null;
    category: EventCategory;
  };
  files: TimelineFileRow[];
};

export type MemberTimelineData = {
  id: string;
  name: string | null;
  timezone: string;
  entries: TimelineEntryRow[];
};

const CATEGORY: Record<
  EventCategory,
  { dot: string; badge: string; label: string }
> = {
  APPOINTMENT: { dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-700",     label: "Appointment" },
  DIAGNOSIS:   { dot: "bg-red-500",    badge: "bg-red-100 text-red-700",       label: "Diagnosis" },
  MEDICATION:  { dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700", label: "Medication" },
  PROCEDURE:   { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700", label: "Procedure" },
  VACCINATION: { dot: "bg-green-500",  badge: "bg-green-100 text-green-700",   label: "Vaccination" },
  MEASUREMENT: { dot: "bg-cyan-500",   badge: "bg-cyan-100 text-cyan-700",     label: "Measurement" },
  SYMPTOM:     { dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700", label: "Symptom" },
  ALLERGY:     { dot: "bg-pink-500",   badge: "bg-pink-100 text-pink-700",     label: "Allergy" },
  OTHER:       { dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-600",     label: "Other" },
};

function formatInTz(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MemberTimeline({
  member,
  editingEntryId,
}: {
  member: MemberTimelineData;
  editingEntryId?: string | null;
}) {
  const router = useRouter();
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<ViewerFile | null>(null);

  function toggleExpand(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openFile(e: React.MouseEvent, file: TimelineFileRow) {
    e.stopPropagation();
    if (!file.filePath) return;
    setViewer({
      url: `/api/files/${file.filePath}`,
      mimeType: file.mimeType,
      fileName: file.fileName,
    });
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        {/* Member header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700 shrink-0">
            {(member.name ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {member.name ?? "Unknown"}
            </p>
            <p className="text-xs text-gray-400">{member.timezone}</p>
          </div>
        </div>

        {member.entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No events recorded yet.
          </p>
        ) : (
          <div className="relative">
            {/* Vertical rule */}
            <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-gray-100" />

            <ul className="space-y-6">
              {member.entries.map((entry) => {
                const cat = CATEGORY[entry.event.category];
                const isOpen     = entry.id === editingEntryId;
                const hasSummary = Boolean(entry.event.summary);
                const isExpanded = expandedEntries.has(entry.id);
                const isPulsing  = isOpen && !hasSummary;

                // Dot positioning — constant in both states:
                //   li always has py-1 (4px top padding)
                //   text-sm line-height ≈ 20px → centre at 10px from content top
                //   dot is 12px → top = 4 + 10 - 6 = 8px
                //   when open: -mx-2 extends bg 8px left; dotLeft shifts 8px to match
                const dotTop  = "8px";
                const dotLeft = isOpen ? "8px" : "0px";

                return (
                  <li
                    key={entry.id}
                    onClick={() => {
                      if (!isOpen) {
                        router.push(`/dashboard?memberId=${member.id}&edit=${entry.id}`);
                      }
                    }}
                    className={`relative py-1 rounded-lg transition-colors ${
                      isOpen
                        ? "bg-blue-50 -mx-2 pl-9 pr-2"
                        : "pl-7 cursor-pointer hover:bg-gray-50"
                    }`}
                  >
                    {/* Dot */}
                    <div
                      className="absolute"
                      style={{ top: dotTop, left: dotLeft, width: 12, height: 12 }}
                    >
                      {isPulsing && (
                        <span
                          className={`absolute inset-0 rounded-full opacity-60 ${cat.dot} animate-ping`}
                        />
                      )}
                      <span
                        className={`absolute inset-0 rounded-full ring-2 ${
                          isOpen ? "ring-blue-200" : "ring-white"
                        } ${cat.dot}`}
                      />
                    </div>

                    {/* Content */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-800">
                          {entry.event.title}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cat.badge}`}
                        >
                          {cat.label}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400">
                        {formatInTz(entry.startTime, member.timezone)}
                        {entry.endTime && (
                          <>
                            {" "}&rarr;{" "}
                            {formatInTz(entry.endTime, member.timezone)}
                          </>
                        )}
                      </p>

                      {entry.event.summary && (
                        <div className="mt-1">
                          <p
                            className={`text-sm text-gray-700 ${
                              isExpanded ? "" : "line-clamp-4"
                            }`}
                          >
                            {entry.event.summary}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => toggleExpand(e, entry.id)}
                            className="text-xs text-gray-400 hover:text-blue-600 transition-colors mt-0.5 float-right"
                          >
                            {isExpanded ? "see less" : "see more..."}
                          </button>
                          <div className="clear-both" />
                        </div>
                      )}

                      {entry.event.description && (
                        <p className="mt-1 text-sm text-gray-400">
                          {entry.event.description}
                        </p>
                      )}

                      {/* File icons */}
                      {entry.files.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {entry.files.map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              onClick={(e) => openFile(e, file)}
                              title={file.fileName ?? "View file"}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs text-gray-500 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200"
                            >
                              <FileTypeIcon mimeType={file.mimeType} fileName={file.fileName} />
                              <span className="max-w-[100px] truncate">
                                {file.fileName ?? "file"}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* File viewer modal */}
      {viewer && (
        <FileViewerModal file={viewer} onClose={() => setViewer(null)} />
      )}
    </>
  );
}
