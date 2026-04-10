import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import { processEventDetail, isTextBasedFile } from "@/src/lib/ai/process";
import Header from "@/src/components/Header";
import AddDetailForm from "./AddDetailForm";
import type { EventCategory } from "@prisma/client";

// ── Category display config ───────────────────────────────────────────────

const CATEGORY: Record<EventCategory, { badge: string; label: string }> = {
  APPOINTMENT: { badge: "bg-blue-100 text-blue-700",    label: "Appointment" },
  DIAGNOSIS:   { badge: "bg-red-100 text-red-700",      label: "Diagnosis" },
  MEDICATION:  { badge: "bg-purple-100 text-purple-700", label: "Medication" },
  PROCEDURE:   { badge: "bg-orange-100 text-orange-700", label: "Procedure" },
  VACCINATION: { badge: "bg-green-100 text-green-700",  label: "Vaccination" },
  MEASUREMENT: { badge: "bg-cyan-100 text-cyan-700",    label: "Measurement" },
  SYMPTOM:     { badge: "bg-yellow-100 text-yellow-700", label: "Symptom" },
  ALLERGY:     { badge: "bg-pink-100 text-pink-700",    label: "Allergy" },
  OTHER:       { badge: "bg-gray-100 text-gray-600",    label: "Other" },
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

// ── Page ──────────────────────────────────────────────────────────────────

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { entryId } = await params;
  const { success, error } = await searchParams;

  const entry = await db.timelineEntry.findUnique({
    where: { id: entryId },
    include: {
      event: {
        include: { details: { orderBy: { createdAt: "desc" } } },
      },
      user: { select: { id: true, name: true, timezone: true } },
    },
  });

  if (!entry) notFound();

  const isAdmin = session.user.role === "ADMINISTRATOR";
  if (!isAdmin && entry.userId !== session.user.id) redirect("/dashboard");

  // ── Server actions ──────────────────────────────────────────────────────

  async function addTextDetail(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const entryId = formData.get("entryId") as string;
    const eventId = formData.get("eventId") as string;
    const text = ((formData.get("text") as string) ?? "").trim();

    if (!text) redirect(`/event/${entryId}?error=empty`);

    const detail = await db.eventDetail.create({
      data: { eventId, sourceType: "text", originalText: text },
    });

    await processEventDetail(detail.id, eventId, text, null, null);
    redirect(`/event/${entryId}?success=added`);
  }

  async function addFileDetail(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const entryId = formData.get("entryId") as string;
    const eventId = formData.get("eventId") as string;
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) redirect(`/event/${entryId}?error=nofile`);

    const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
    const eventDir = path.join(uploadDir, eventId);
    await fs.mkdir(eventDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}-${safeName}`;
    const absPath = path.join(eventDir, uniqueName);
    const relPath = `${eventId}/${uniqueName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absPath, buffer);

    const originalText = isTextBasedFile(file.name, file.type)
      ? new TextDecoder().decode(buffer)
      : null;

    const detail = await db.eventDetail.create({
      data: {
        eventId,
        sourceType: "file",
        originalText,
        fileName: file.name,
        filePath: relPath,
        mimeType: file.type || null,
      },
    });

    await processEventDetail(
      detail.id,
      eventId,
      originalText,
      file.name,
      file.type || null,
    );
    redirect(`/event/${entryId}?success=added`);
  }

  async function deleteDetail(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const detailId = formData.get("detailId") as string;
    const entryId = formData.get("entryId") as string;
    const filePath = (formData.get("filePath") as string | null) || null;

    if (filePath) {
      const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
      await fs.unlink(path.join(uploadDir, filePath)).catch(() => {});
    }

    await db.eventDetail.delete({ where: { id: detailId } });
    redirect(`/event/${entryId}`);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const { event, user } = entry;
  const cat = CATEGORY[event.category];
  const dashboardHref = `/dashboard?memberId=${user.id}`;
  const username = session.user?.name ?? session.user?.email ?? "User";

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={username} />

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-5">
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to {user.name ?? "timeline"}
            </Link>
          </div>

          {/* Feedback banners */}
          {success === "added" && (
            <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Detail added and processed successfully.
            </p>
          )}
          {error === "empty" && (
            <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Please enter some text before submitting.
            </p>
          )}
          {error === "nofile" && (
            <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Please select a file before uploading.
            </p>
          )}

          <div className="flex gap-6 items-start">
            {/* Left: event + details list */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Event header */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex flex-wrap items-start gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-semibold text-gray-800 leading-snug">
                      {event.title}
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatInTz(entry.startTime.toISOString(), user.timezone)}
                      {entry.endTime && (
                        <> &rarr; {formatInTz(entry.endTime.toISOString(), user.timezone)}</>
                      )}
                      {" · "}{user.name ?? "Unknown"}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cat.badge}`}>
                    {cat.label}
                  </span>
                </div>

                {event.summary ? (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                      Summary
                    </p>
                    <p className="text-sm text-gray-700">{event.summary}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No summary yet — add a detail to generate one.
                  </p>
                )}

                {event.description && (
                  <p className="mt-2 text-sm text-gray-500">{event.description}</p>
                )}
              </div>

              {/* Details list */}
              {event.details.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
                  <div className="px-5 py-3">
                    <h2 className="text-sm font-semibold text-gray-700">
                      Details{" "}
                      <span className="text-gray-400 font-normal">({event.details.length})</span>
                    </h2>
                  </div>

                  {event.details.map((detail) => (
                    <div key={detail.id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 mt-0.5">
                          {detail.sourceType === "file" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {detail.documentType && (
                              <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                {detail.documentType}
                              </span>
                            )}
                            {!detail.processed && (
                              <span className="text-xs text-gray-400 italic">Not yet processed</span>
                            )}
                            {detail.fileName && (
                              <span className="text-xs text-gray-500 truncate">{detail.fileName}</span>
                            )}
                            <span className="text-xs text-gray-300">
                              {new Date(detail.createdAt).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </span>
                          </div>

                          {detail.originalText && (
                            <p className="text-xs text-gray-500 font-mono leading-relaxed line-clamp-4 whitespace-pre-wrap break-words">
                              {detail.originalText.slice(0, 400)}
                              {detail.originalText.length > 400 && "…"}
                            </p>
                          )}
                          {detail.sourceType === "file" && !detail.originalText && (
                            <p className="text-xs text-gray-400 italic">Binary file — no text preview</p>
                          )}
                        </div>

                        <form action={deleteDetail}>
                          <input type="hidden" name="detailId" value={detail.id} />
                          <input type="hidden" name="entryId" value={entry.id} />
                          {detail.filePath && (
                            <input type="hidden" name="filePath" value={detail.filePath} />
                          )}
                          <button
                            type="submit"
                            className="shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                            title="Delete detail"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: add detail form */}
            <div className="w-72 shrink-0 sticky top-6">
              <AddDetailForm
                entryId={entry.id}
                eventId={event.id}
                addTextAction={addTextDetail}
                addFileAction={addFileDetail}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
