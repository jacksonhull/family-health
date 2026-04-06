import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/src/lib/db";
import { hashToken } from "@/src/lib/token";
import { hashPassword } from "@/src/lib/password";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  const isValid = record && record.expiresAt > new Date();

  async function resetPassword(formData: FormData) {
    "use server";
    const { token } = await params;
    const password = formData.get("password") as string;
    const confirm = formData.get("confirmPassword") as string;

    if (password !== confirm)
      redirect(`/reset-password/${token}?error=mismatch`);
    if (password.length < 8)
      redirect(`/reset-password/${token}?error=tooshort`);

    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record || record.expiresAt <= new Date()) {
      redirect(`/reset-password/${token}?error=expired`);
    }

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      db.passwordResetToken.delete({ where: { id: record.id } }),
    ]);

    redirect("/login?success=password_reset");
  }

  const ERRORS: Record<string, string> = {
    mismatch: "Passwords do not match.",
    tooshort: "Password must be at least 8 characters.",
    expired: "This reset link has expired.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-800 text-center mb-8">
          Family Health
        </h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-base font-medium text-gray-800 mb-5">
            Set new password
          </h2>
          {!isValid ? (
            <div className="space-y-4">
              <p className="text-sm text-red-600">
                This reset link is invalid or has expired.
              </p>
              <Link
                href="/forgot-password"
                className="block text-sm text-blue-600 hover:underline"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {ERRORS[error] ?? "Something went wrong."}
                </p>
              )}
              <ResetPasswordForm action={resetPassword} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
