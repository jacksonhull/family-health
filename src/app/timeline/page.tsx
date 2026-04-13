import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import { utcToLocalInput } from "@/src/lib/timezone";
import Header from "@/src/components/Header";
import SubNav from "@/src/components/SubNav";
import MemberDropdown from "@/src/components/MemberDropdown";
import AddEventModal from "@/src/app/dashboard/AddEventModal";
import MemberTimeline from "@/src/app/dashboard/MemberTimeline";
import EditEventModal from "@/src/app/dashboard/EditEventModal";
import {
  updateEvent,
  addTextDetail,
  addFileDetail,
  deleteDetail,
  deleteEvent,
  uploadAndCreateEvent,
  addEventWithFile,
} from "@/src/app/actions/eventActions";
import type { MemberTimelineData } from "@/src/app/dashboard/MemberTimeline";
import type { EditingEntry, EventDetailRow } from "@/src/app/dashboard/AddEventForm";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string; edit?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { memberId, edit } = await searchParams;
  const isAdmin = session.user.role === "ADMINISTRATOR";
  const selectedMemberId = memberId ?? session.user.id;

  if (!isAdmin && selectedMemberId !== session.user.id) {
    redirect(`/timeline?memberId=${session.user.id}`);
  }

  // All members for the dropdown
  const allMembers = isAdmin
    ? await db.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [{ id: session.user.id, name: session.user.name ?? null }];

  // Selected member + full timeline
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

  if (!selectedMember) redirect(`/timeline?memberId=${session.user.id}`);

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
  const cancelHref = `/timeline?memberId=${selectedMemberId}`;

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
      <SubNav
        memberId={selectedMemberId}
        rightSlot={
          <MemberDropdown
            members={allMembers}
            selectedId={selectedMemberId}
            selectedName={selectedMember.name ?? "Unknown"}
          />
        }
      />
      <main className="flex-1 overflow-y-auto bg-gray-50 py-6">
        <div className="max-w-3xl mx-auto px-6">
          <MemberTimeline member={timeline} mode="page" />
        </div>
      </main>

      <EditEventModal
        editing={editingEntry}
        editingDetails={editingDetails}
        selectedMemberId={selectedMemberId}
        cancelHref={cancelHref}
        returnPath="/timeline"
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
