"use client";

import Link from "next/link";
import type { EventCategory } from "@prisma/client";

export type TimelineEntryRow = {
  id: string;
  startTime: string; // ISO UTC
  endTime: string | null; // ISO UTC
  event: {
    id: string;
    title: string;
    description: string | null;
    category: EventCategory;
  };
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
  APPOINTMENT: {
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700",
    label: "Appointment",
  },
  DIAGNOSIS: {
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700",
    label: "Diagnosis",
  },
  MEDICATION: {
    dot: "bg-purple-500",
    badge: "bg-purple-100 text-purple-700",
    label: "Medication",
  },
  PROCEDURE: {
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700",
    label: "Procedure",
  },
  VACCINATION: {
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-700",
    label: "Vaccination",
  },
  MEASUREMENT: {
    dot: "bg-cyan-500",
    badge: "bg-cyan-100 text-cyan-700",
    label: "Measurement",
  },
  SYMPTOM: {
    dot: "bg-yellow-500",
    badge: "bg-yellow-100 text-yellow-700",
    label: "Symptom",
  },
  ALLERGY: {
    dot: "bg-pink-500",
    badge: "bg-pink-100 text-pink-700",
    label: "Allergy",
  },
  OTHER: {
    dot: "bg-gray-400",
    badge: "bg-gray-100 text-gray-600",
    label: "Other",
  },
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

export default function MemberTimeline({
  member,
  editingEntryId,
}: {
  member: MemberTimelineData;
  editingEntryId?: string | null;
}) {
  return (
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
              const isBeingEdited = entry.id === editingEntryId;

              return (
                <li
                  key={entry.id}
                  className={`relative pl-7 rounded-lg transition-colors ${
                    isBeingEdited ? "bg-blue-50 -mx-2 px-9 py-2" : ""
                  }`}
                >
                  {/* Dot */}
                  <div
                    className={`absolute left-0 top-1.5 w-3 h-3 rounded-full ring-2 ${
                      isBeingEdited ? "ring-blue-200" : "ring-white"
                    } ${cat.dot}`}
                    style={isBeingEdited ? { left: "8px" } : undefined}
                  />

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
                      {isBeingEdited && (
                        <span className="text-xs text-blue-600 font-medium">
                          editing…
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400">
                      {formatInTz(entry.startTime, member.timezone)}
                      {entry.endTime && (
                        <>
                          {" "}
                          &rarr;{" "}
                          {formatInTz(entry.endTime, member.timezone)}
                        </>
                      )}
                    </p>

                    {entry.event.description && (
                      <p className="mt-1 text-sm text-gray-500">
                        {entry.event.description}
                      </p>
                    )}

                    {!isBeingEdited && (
                      <Link
                        href={`/dashboard?memberId=${member.id}&edit=${entry.id}`}
                        className="mt-1 inline-block text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
