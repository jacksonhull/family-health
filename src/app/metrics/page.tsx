import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import StubPage from "@/src/components/StubPage";
import MemberDropdown from "@/src/components/MemberDropdown";
import AddEventModal from "@/src/app/dashboard/AddEventModal";
import { uploadAndCreateEvent, addEventWithFile } from "@/src/app/actions/eventActions";

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { memberId } = await searchParams;
  const isAdmin = session.user.role === "ADMINISTRATOR";
  const selectedMemberId = memberId ?? session.user.id;

  if (!isAdmin && selectedMemberId !== session.user.id) {
    redirect(`/metrics?memberId=${session.user.id}`);
  }

  const allMembers = isAdmin
    ? await db.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [{ id: session.user.id, name: session.user.name ?? null }];

  const selectedMember = await db.user.findUnique({
    where: { id: selectedMemberId },
    select: { name: true },
  });

  const username = session.user?.name ?? session.user?.email ?? "User";

  return (
    <StubPage
      username={username}
      memberId={selectedMemberId}
      title="Metrics"
      description="Coming soon — this section is under construction."
      headerActions={
        <AddEventModal
          selectedMemberId={selectedMemberId}
          uploadAndCreateAction={uploadAndCreateEvent}
          addEventWithFileAction={addEventWithFile}
        />
      }
      rightSlot={
        <MemberDropdown
          members={allMembers}
          selectedId={selectedMemberId}
          selectedName={selectedMember?.name ?? "Unknown"}
        />
      }
    />
  );
}
