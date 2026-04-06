import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import { localToUtc, utcToLocalInput } from "@/src/lib/timezone";
import Header from "@/src/components/Header";
import MemberSelector from "./MemberSelector";
import AddEventForm from "./AddEventForm";
import MemberTimeline from "./MemberTimeline";
import type { MemberTimelineData } from "./MemberTimeline";
import type { EditingEntry } from "./AddEventForm";
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

  // Non-admins can only view their own profile (shared members: future work)
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
        orderBy: { startTime: "asc" },
      },
    },
  });

  // Guard: if the requested member doesn't exist, fall back to self
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
        description: found.event.description,
        category: found.event.category,
        startTimeInput: utcToLocalInput(
          found.startTime.toISOString(),
          selectedMember.timezone,
        ),
        endTimeInput: found.endTime
          ? utcToLocalInput(
              found.endTime.toISOString(),
              selectedMember.timezone,
            )
          : null,
      };
    }
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
    const endRaw =
      ((formData.get("endTime") as string) ?? "").trim() || null;
    const description =
      ((formData.get("description") as string) ?? "").trim() || null;

    if (!userId || !title || !startRaw)
      redirect(`/dashboard?memberId=${userId}&error=missing`);

    const member = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const tz = member?.timezone ?? "UTC";

    await db.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: { title, description, category },
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
    const endRaw =
      ((formData.get("endTime") as string) ?? "").trim() || null;
    const description =
      ((formData.get("description") as string) ?? "").trim() || null;

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
        data: { title, description, category },
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

          <div className="flex gap-6 items-start">
            {/* ── Timeline ── */}
            <div className="flex-1 min-w-0">
              <MemberTimeline member={timeline} editingEntryId={edit} />
            </div>

            {/* ── Add / Edit event form ── */}
            <div className="w-72 shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-6">
                <p className="text-sm font-medium text-gray-700 mb-4">
                  {editingEntry ? "Edit event" : "Add event"}
                </p>
                <AddEventForm
                  selectedMemberId={selectedMemberId}
                  addAction={addEvent}
                  updateAction={updateEvent}
                  editing={editingEntry}
                  cancelHref={cancelHref}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
