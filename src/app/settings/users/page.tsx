import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import { generateToken, hashToken, makeExpiry } from "@/src/lib/token";
import { sendInviteEmail } from "@/src/lib/email";
import AddMemberForm from "./AddMemberForm";
import UserTable from "./UserTable";
import type { MemberRow } from "./UserTable";

const ERRORS: Record<string, string> = {
  already_exists: "A member with that email address already exists.",
  self_action: "You cannot perform this action on your own account.",
  no_email: "This member does not have an email address. Add one first.",
  missing_fields: "Display name and date of birth are required.",
};

export default async function FamilyMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

  const { error, success } = await searchParams;

  const users = await db.user.findMany({
    include: { invite: true },
    orderBy: { createdAt: "asc" },
  });

  // ── Server actions ────────────────────────────────────────────────────────

  async function addMember(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

    const name = (formData.get("name") as string).trim();
    const dateOfBirth = formData.get("dateOfBirth") as string;
    const email = (formData.get("email") as string).trim().toLowerCase() || null;
    const timezone = (formData.get("timezone") as string) || "UTC";

    if (email) {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) redirect("/settings/users?error=already_exists");
    }

    await db.user.create({
      data: {
        name,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        email,
        timezone,
        role: "USER",
        status: "ACTIVE",
      },
    });

    redirect("/settings/users?success=added");
  }

  async function sendInvite(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

    const userId = formData.get("userId") as string;
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.email) redirect("/settings/users?error=no_email");

    // Delete any existing invite (resend scenario)
    await db.invite.deleteMany({ where: { userId } });

    const raw = generateToken();
    await db.invite.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        invitedById: session.user.id,
        expiresAt: makeExpiry(48),
      },
    });

    await sendInviteEmail({
      to: user.email,
      token: raw,
      invitedByName: session.user.name,
    });

    redirect("/settings/users?success=invited");
  }

  async function disable(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

    const userId = formData.get("userId") as string;
    if (userId === session.user.id) redirect("/settings/users?error=self_action");

    await db.user.update({ where: { id: userId }, data: { status: "DISABLED" } });
    redirect("/settings/users");
  }

  async function enable(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

    const userId = formData.get("userId") as string;
    if (userId === session.user.id) redirect("/settings/users?error=self_action");

    await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    redirect("/settings/users");
  }

  async function updateMember(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

    const userId = formData.get("userId") as string;
    const name = (formData.get("name") as string).trim();
    const dateOfBirth = formData.get("dateOfBirth") as string;
    const email =
      (formData.get("email") as string).trim().toLowerCase() || null;
    const timezone = (formData.get("timezone") as string) || "UTC";

    if (!name || !dateOfBirth) redirect("/settings/users?error=missing_fields");

    if (email) {
      const existing = await db.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (existing) redirect("/settings/users?error=already_exists");
    }

    await db.user.update({
      where: { id: userId },
      data: { name, dateOfBirth: new Date(dateOfBirth), email, timezone },
    });

    redirect("/settings/users?success=updated");
  }

  async function deleteUser(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

    const userId = formData.get("userId") as string;
    if (userId === session.user.id) redirect("/settings/users?error=self_action");

    await db.user.delete({ where: { id: userId } });
    redirect("/settings/users");
  }

  // Serialize for client component
  const members: MemberRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    dateOfBirth: u.dateOfBirth?.toISOString() ?? null,
    timezone: u.timezone,
    role: u.role,
    status: u.status,
    hasPassword: u.passwordHash !== null,
    pendingInvite: u.invite
      ? { id: u.invite.id, expiresAt: u.invite.expiresAt.toISOString() }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Family Members</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add and manage family members. Invite them to create their own login.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {ERRORS[error] ?? "Something went wrong."}
        </p>
      )}
      {success === "added" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Family member added.
        </p>
      )}
      {success === "invited" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Invitation sent.
        </p>
      )}
      {success === "updated" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Member updated.
        </p>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-4">
          Add a family member
        </p>
        <AddMemberForm action={addMember} />
      </div>

      <UserTable
        members={members}
        currentUserId={session.user.id}
        inviteAction={sendInvite}
        updateAction={updateMember}
        disableAction={disable}
        enableAction={enable}
        deleteAction={deleteUser}
      />
    </div>
  );
}
