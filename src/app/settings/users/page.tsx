import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { db } from "@/src/lib/db";
import { generateToken, hashToken, makeExpiry } from "@/src/lib/token";
import { sendInviteEmail } from "@/src/lib/email";
import InviteForm from "./InviteForm";
import UserTable from "./UserTable";

const INVITE_ERRORS: Record<string, string> = {
  already_exists: "A user with that email already exists.",
  already_invited: "An invitation has already been sent to that address.",
  self_action: "You cannot perform this action on your own account.",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

  const { error, success } = await searchParams;

  const [users, invites] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" } }),
    db.invite.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  // ── Server actions ────────────────────────────────────────────────────────

  async function invite(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

    const email = (formData.get("email") as string).trim().toLowerCase();

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) redirect("/settings/users?error=already_exists");

    const existingInvite = await db.invite.findUnique({ where: { email } });
    if (existingInvite) {
      if (existingInvite.expiresAt > new Date()) {
        redirect("/settings/users?error=already_invited");
      }
      // Expired invite — delete it and re-invite
      await db.invite.delete({ where: { id: existingInvite.id } });
    }

    const raw = generateToken();
    await db.invite.create({
      data: {
        email,
        tokenHash: hashToken(raw),
        invitedById: session.user.id,
        expiresAt: makeExpiry(48),
      },
    });

    await sendInviteEmail({
      to: email,
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

  async function deleteUser(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

    const userId = formData.get("userId") as string;
    if (userId === session.user.id) redirect("/settings/users?error=self_action");

    await db.user.delete({ where: { id: userId } });
    redirect("/settings/users");
  }

  async function revokeInvite(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "ADMINISTRATOR") redirect("/settings/account");

    const inviteId = formData.get("inviteId") as string;
    await db.invite.delete({ where: { id: inviteId } });
    redirect("/settings/users");
  }

  // Serialize dates for client component
  const serializedUsers = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));
  const serializedInvites = invites.map((i) => ({
    ...i,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Users</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage user accounts and invitations.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {INVITE_ERRORS[error] ?? "Something went wrong."}
        </p>
      )}
      {success === "invited" && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Invitation sent.
        </p>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Invite a user</p>
        <InviteForm action={invite} />
      </div>

      <UserTable
        users={serializedUsers}
        invites={serializedInvites}
        currentUserId={session.user.id}
        disableAction={disable}
        enableAction={enable}
        deleteAction={deleteUser}
        revokeInviteAction={revokeInvite}
      />
    </div>
  );
}
