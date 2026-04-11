import { redirect } from "next/navigation";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import { localToUtc, utcToLocalInput } from "@/src/lib/timezone";
import { processEventDetail, isTextBasedFile } from "@/src/lib/ai/process";
import Header from "@/src/components/Header";
import MemberSelector from "./MemberSelector";
import AddEventForm from "./AddEventForm";
import MemberTimeline from "./MemberTimeline";
import type { MemberTimelineData } from "./MemberTimeline";
import type { EditingEntry, EventDetailRow } from "./AddEventForm";
import type { EventCategory } from "@prisma/client";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    memberId?: string;
    edit?: string;
    success?: string;
    error?: string;
  }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { memberId, edit, success } = await searchParams;
  const isAdmin = session.user.role === "ADMINISTRATOR";

  // Default to the logged-in user's own profile
  const selectedMemberId = memberId ?? session.user.id;

  // Non-admins can only view their own profile
  if (!isAdmin && selectedMemberId !== session.user.id) {
    redirect(`/dashboard?memberId=${session.user.id}`);
  }

  // ── All members (for the selector strip) ─────────────────────────────────
  const allMembers = isAdmin
    ? await db.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [{ id: session.user.id, name: session.user.name ?? null }];

  // ── Selected member + their timeline ─────────────────────────────────────
  const selectedMember = await db.user.findUnique({
    where: { id: selectedMemberId },
    select: {
      id: true,
      name: true,
      timezone: true,
      timelineEntries: {
        include: { event: true },
        orderBy: { startTime: "desc" },
      },
    },
  });

  if (!selectedMember) redirect(`/dashboard?memberId=${session.user.id}`);

  // ── Resolve editing entry ─────────────────────────────────────────────────
  let editingEntry: EditingEntry | null = null;
  if (edit) {
    const found = selectedMember.timelineEntries.find((e) => e.id === edit);
    if (found) {
      editingEntry = {
        entryId: found.id,
        eventId: found.event.id,
        title: found.event.title,
        summary: found.event.summary,
        description: found.event.description,
        category: found.event.category,
        startTimeInput: utcToLocalInput(
          found.startTime.toISOString(),
          selectedMember.timezone,
        ),
        endTimeInput: found.endTime
          ? utcToLocalInput(found.endTime.toISOString(), selectedMember.timezone)
          : null,
      };
    }
  }

  // ── Most recent medical history for the selected member ──────────────────
  const latestHistory = await db.medicalHistory.findFirst({
    where: { userId: selectedMemberId },
    orderBy: { createdAt: "desc" },
    select: { summary: true, createdAt: true },
  });

  // ── Fetch details for the editing event ──────────────────────────────────
  let editingDetails: EventDetailRow[] = [];
  if (editingEntry) {
    const rawDetails = await db.eventDetail.findMany({
      where: { eventId: editingEntry.eventId },
      orderBy: { createdAt: "desc" },
    });
    editingDetails = rawDetails.map((d) => ({
      id: d.id,
      sourceType: d.sourceType,
      originalText: d.originalText,
      fileName: d.fileName,
      filePath: d.filePath,
      mimeType: d.mimeType,
      documentType: d.documentType,
      processed: d.processed,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  // ── Server actions ────────────────────────────────────────────────────────

  async function addEvent(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const userId = formData.get("userId") as string;
    const title = (formData.get("title") as string).trim();
    const category = (formData.get("category") as string) as EventCategory;
    const startRaw = formData.get("startTime") as string;
    const endRaw = ((formData.get("endTime") as string) ?? "").trim() || null;
    const summary = ((formData.get("summary") as string) ?? "").trim() || null;
    const description = ((formData.get("description") as string) ?? "").trim() || null;

    if (!userId || !title || !startRaw)
      redirect(`/dashboard?memberId=${userId}&error=missing`);

    const member = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = member?.timezone ?? "UTC";

    await db.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: { title, summary, description, category },
      });
      await tx.timelineEntry.create({
        data: {
          userId,
          eventId: event.id,
          startTime: localToUtc(startRaw, tz),
          endTime: endRaw ? localToUtc(endRaw, tz) : null,
        },
      });
    });

    redirect(`/dashboard?memberId=${userId}&success=added`);
  }

  async function updateEvent(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const userId = formData.get("userId") as string;
    const entryId = formData.get("entryId") as string;
    const eventId = formData.get("eventId") as string;
    const title = (formData.get("title") as string).trim();
    const category = (formData.get("category") as string) as EventCategory;
    const startRaw = formData.get("startTime") as string;
    const endRaw = ((formData.get("endTime") as string) ?? "").trim() || null;
    const summary = ((formData.get("summary") as string) ?? "").trim() || null;
    const description = ((formData.get("description") as string) ?? "").trim() || null;

    if (!entryId || !eventId || !title || !startRaw)
      redirect(`/dashboard?memberId=${userId}&error=missing`);

    const member = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = member?.timezone ?? "UTC";

    await db.$transaction([
      db.event.update({
        where: { id: eventId },
        data: { title, summary, description, category },
      }),
      db.timelineEntry.update({
        where: { id: entryId },
        data: {
          startTime: localToUtc(startRaw, tz),
          endTime: endRaw ? localToUtc(endRaw, tz) : null,
        },
      }),
    ]);

    redirect(`/dashboard?memberId=${userId}&success=updated`);
  }

  async function addTextDetail(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const userId = formData.get("userId") as string;
    const entryId = formData.get("entryId") as string;
    const eventId = formData.get("eventId") as string;
    const text = ((formData.get("text") as string) ?? "").trim();

    if (!text)
      redirect(`/dashboard?memberId=${userId}&edit=${entryId}&error=empty`);

    const detail = await db.eventDetail.create({
      data: { eventId, sourceType: "text", originalText: text },
    });

    await processEventDetail(detail.id, eventId, text, null, null);
    redirect(`/dashboard?memberId=${userId}&edit=${entryId}&success=detail`);
  }

  async function addFileDetail(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const userId = formData.get("userId") as string;
    const entryId = formData.get("entryId") as string;
    const eventId = formData.get("eventId") as string;
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0)
      redirect(`/dashboard?memberId=${userId}&edit=${entryId}&error=nofile`);

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
    redirect(`/dashboard?memberId=${userId}&edit=${entryId}&success=detail`);
  }

  async function deleteDetail(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const userId = formData.get("userId") as string;
    const entryId = formData.get("entryId") as string;
    const detailId = formData.get("detailId") as string;
    const filePath = (formData.get("filePath") as string | null) || null;

    if (filePath) {
      const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
      await fs.unlink(path.join(uploadDir, filePath)).catch(() => {});
    }

    await db.eventDetail.delete({ where: { id: detailId } });
    redirect(`/dashboard?memberId=${userId}&edit=${entryId}`);
  }

  // ── Serialize for client ──────────────────────────────────────────────────

  const timeline: MemberTimelineData = {
    id: selectedMember.id,
    name: selectedMember.name,
    timezone: selectedMember.timezone,
    entries: selectedMember.timelineEntries.map((e) => ({
      id: e.id,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime?.toISOString() ?? null,
      event: {
        id: e.event.id,
        title: e.event.title,
        summary: e.event.summary,
        description: e.event.description,
        category: e.event.category,
      },
    })),
  };

  const username = session.user?.name ?? session.user?.email ?? "User";
  const cancelHref = `/dashboard?memberId=${selectedMemberId}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={username} />
      <MemberSelector members={allMembers} selectedId={selectedMemberId} />

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
            <p className="text-sm text-gray-500 mt-1">Family health timeline</p>
          </div>

          {success === "added" && (
            <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Event added.
            </p>
          )}
          {success === "updated" && (
            <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Event updated.
            </p>
          )}
          {success === "detail" && (
            <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              Detail added and processed.
            </p>
          )}

          <div className="flex gap-6 items-start">
            {/* ── Timeline + Medical history ── */}
            <div className="flex-1 min-w-0 space-y-5">
              <MemberTimeline member={timeline} editingEntryId={edit} />

              {/* Medical history card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Medical history
                  </h3>
                  {latestHistory && (
                    <span className="text-xs text-gray-400">
                      Updated{" "}
                      {new Date(latestHistory.createdAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </span>
                  )}
                </div>
                {latestHistory ? (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {latestHistory.summary}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No medical history recorded yet.
                  </p>
                )}
              </div>
            </div>

            {/* ── Add / Edit event form (with inline details) ── */}
            <div className="w-80 shrink-0 sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl">
              <AddEventForm
                selectedMemberId={selectedMemberId}
                addAction={addEvent}
                updateAction={updateEvent}
                editing={editingEntry}
                cancelHref={cancelHref}
                editingDetails={editingDetails}
                addTextDetailAction={editingEntry ? addTextDetail : undefined}
                addFileDetailAction={editingEntry ? addFileDetail : undefined}
                deleteDetailAction={editingEntry ? deleteDetail : undefined}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
