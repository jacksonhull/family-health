import { redirect } from "next/navigation";
import fs from "fs/promises";
import path from "path";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import { localToUtc, utcToLocalInput } from "@/src/lib/timezone";
import { processEventDetail, processNewEventFromFile, isTextBasedFile } from "@/src/lib/ai/process";
import Header from "@/src/components/Header";
import MemberSelector from "./MemberSelector";
import AddEventModal from "./AddEventModal";
import EditEventModal from "./EditEventModal";
import DashboardShell from "./DashboardShell";
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

  const selectedMemberId = memberId ?? session.user.id;

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

  // ── Selected member + timeline (with file details) ────────────────────────
  const selectedMember = await db.user.findUnique({
    where: { id: selectedMemberId },
    select: {
      id: true,
      name: true,
      timezone: true,
      timelineEntries: {
        include: {
          event: {
            include: {
              details: {
                where: { sourceType: "file", filePath: { not: null } },
                select: { id: true, fileName: true, filePath: true, mimeType: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
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

  // ── Most recent medical history ───────────────────────────────────────────
  const latestHistory = await db.medicalHistory.findFirst({
    where: { userId: selectedMemberId },
    orderBy: { createdAt: "desc" },
    select: { summary: true, createdAt: true },
  });

  // ── Details for the editing event ─────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function saveFile(
    file: File,
    eventId: string,
  ): Promise<{ absPath: string; relPath: string; buffer: Buffer }> {
    const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
    const eventDir = path.join(uploadDir, eventId);
    await fs.mkdir(eventDir, { recursive: true });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}-${safeName}`;
    const absPath = path.join(eventDir, uniqueName);
    const relPath = `${eventId}/${uniqueName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absPath, buffer);
    return { absPath, relPath, buffer };
  }

  // ── Server actions ────────────────────────────────────────────────────────

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

    redirect(`/dashboard?memberId=${userId}&edit=${entryId}&success=updated`);
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

    await processEventDetail(detail.id, eventId, originalText, file.name, file.type || null);
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

  async function deleteEvent(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const userId = formData.get("userId") as string;
    const entryId = formData.get("entryId") as string;
    const eventId = formData.get("eventId") as string;

    // Delete all associated files from disk
    const details = await db.eventDetail.findMany({
      where: { eventId },
      select: { filePath: true },
    });
    const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
    await Promise.all(
      details
        .filter((d) => d.filePath)
        .map((d) => fs.unlink(path.join(uploadDir, d.filePath!)).catch(() => {})),
    );

    // Delete entry + details + event (entry and details cascade from event)
    await db.timelineEntry.delete({ where: { id: entryId } });
    await db.eventDetail.deleteMany({ where: { eventId } });
    await db.event.delete({ where: { id: eventId } });

    redirect(`/dashboard?memberId=${userId}`);
  }

  // ── Upload file → auto-create event ──────────────────────────────────────
  async function uploadAndCreateEvent(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session) redirect("/login");

    const userId = formData.get("userId") as string;
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0)
      redirect(`/dashboard?memberId=${userId}&error=nofile`);

    const member = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = member?.timezone ?? "UTC";

    // Create placeholder event + entry (AI will update these)
    const event = await db.event.create({
      data: { title: "Processing…", category: "OTHER" },
    });
    const entry = await db.timelineEntry.create({
      data: { userId, eventId: event.id, startTime: new Date() },
    });

    // Save file to disk
    const uploadDir = process.env.UPLOAD_DIR ?? "/app/uploads";
    const eventDir = path.join(uploadDir, event.id);
    await fs.mkdir(eventDir, { recursive: true });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}-${safeName}`;
    const absPath = path.join(eventDir, uniqueName);
    const relPath = `${event.id}/${uniqueName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absPath, buffer);

    const originalText = isTextBasedFile(file.name, file.type)
      ? new TextDecoder().decode(buffer)
      : null;

    const detail = await db.eventDetail.create({
      data: {
        eventId: event.id,
        sourceType: "file",
        originalText,
        fileName: file.name,
        filePath: relPath,
        mimeType: file.type || null,
      },
    });

    // Run AI — updates event title/category/summary + entry startTime
    await processNewEventFromFile(
      detail.id,
      event.id,
      entry.id,
      file.name,
      file.type || null,
      userId,
      tz,
    );

    redirect(`/dashboard?memberId=${userId}&edit=${entry.id}&success=added`);
  }

  // ── Create event + optional file (from modal "Create event" tab) ──────────
  async function addEventWithFile(formData: FormData) {
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
    const file = formData.get("file") as File | null;
    const hasFile = file && file.size > 0;

    if (!userId || !title || !startRaw)
      redirect(`/dashboard?memberId=${userId}&error=missing`);

    const member = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = member?.timezone ?? "UTC";

    const { eventId, entryId } = await db.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: { title, summary, description, category },
      });
      const entry = await tx.timelineEntry.create({
        data: {
          userId,
          eventId: event.id,
          startTime: localToUtc(startRaw, tz),
          endTime: endRaw ? localToUtc(endRaw, tz) : null,
        },
      });
      return { eventId: event.id, entryId: entry.id };
    });

    // If a file was attached, save + process it (updates summary)
    if (hasFile) {
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

      await processEventDetail(detail.id, eventId, originalText, file.name, file.type || null);
    }

    redirect(`/dashboard?memberId=${userId}&edit=${entryId}&success=added`);
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
      files: e.event.details.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        filePath: d.filePath,
        mimeType: d.mimeType,
      })),
    })),
  };

  const username = session.user?.name ?? session.user?.email ?? "User";
  const cancelHref = `/dashboard?memberId=${selectedMemberId}`;

  // ── Health sidebar content (column 3) ────────────────────────────────────
  const healthContent = (
    <>
      {/* Toast messages */}
      {success === "added" && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Event added.
        </p>
      )}
      {success === "updated" && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Event updated.
        </p>
      )}
      {success === "detail" && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Detail added and processed.
        </p>
      )}

      {/* Latest medical summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Latest Medical Summary
          </h3>
          {latestHistory && (
            <span className="text-xs text-gray-400">
              {new Date(latestHistory.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
        {latestHistory ? (
          <p className="text-xs text-gray-600 leading-relaxed">
            {latestHistory.summary}
          </p>
        ) : (
          <p className="text-xs text-gray-400 italic">
            No medical history recorded yet.
          </p>
        )}
      </div>

      {/* Timeline */}
      <MemberTimeline member={timeline} editingEntryId={edit} />
    </>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        username={username}
        actions={
          <AddEventModal
            selectedMemberId={selectedMemberId}
            uploadAndCreateAction={uploadAndCreateEvent}
            addEventWithFileAction={addEventWithFile}
          />
        }
      />
      <MemberSelector members={allMembers} selectedId={selectedMemberId} />

      <DashboardShell healthContent={healthContent} />

      {/* Edit event modal — fixed overlay, position unaffected by layout */}
      <EditEventModal
        editing={editingEntry}
        editingDetails={editingDetails}
        selectedMemberId={selectedMemberId}
        cancelHref={cancelHref}
        addAction={async () => { "use server"; }}
        updateAction={updateEvent}
        addTextDetailAction={addTextDetail}
        addFileDetailAction={addFileDetail}
        deleteDetailAction={deleteDetail}
        deleteEventAction={deleteEvent}
      />
    </div>
  );
}
