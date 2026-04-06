import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/src/lib/db";
import { hashToken } from "@/src/lib/token";
import { hashPassword } from "@/src/lib/password";
import AcceptInviteForm from "./AcceptInviteForm";

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const invite = await db.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  const isValid = invite && invite.expiresAt > new Date();

  async function acceptInvite(formData: FormData) {
    "use server";
    const { token } = await params;
    const password = formData.get("password") as string;
    const confirm = formData.get("confirmPassword") as string;

    if (password !== confirm) redirect(`/invite/${token}?error=mismatch`);
    if (password.length < 8) redirect(`/invite/${token}?error=tooshort`);

    const invite = await db.invite.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!invite || invite.expiresAt <= new Date()) {
      redirect(`/invite/${token}?error=expired`);
    }

    await db.$transaction([
      db.user.update({
        where: { id: invite.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      db.invite.delete({ where: { id: invite.id } }),
    ]);

    redirect("/login?success=account_created");
  }

  const ERRORS: Record<string, string> = {
    mismatch: "Passwords do not match.",
    tooshort: "Password must be at least 8 characters.",
    expired: "This invitation has expired.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-800 text-center mb-8">
          Family Health
        </h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {!isValid ? (
            <div className="space-y-3">
              <h2 className="text-base font-medium text-gray-800">
                Invalid invitation
              </h2>
              <p className="text-sm text-gray-500">
                This invitation link is invalid or has expired. Please ask an
                administrator to send you a new invite.
              </p>
              <Link
                href="/login"
                className="block text-sm text-blue-600 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-base font-medium text-gray-800 mb-5">
                Create your account
              </h2>
              {error && (
                <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {ERRORS[error] ?? "Something went wrong."}
                </p>
              )}
              <AcceptInviteForm
                name={invite.user.name ?? invite.user.email ?? ""}
                action={acceptInvite}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
