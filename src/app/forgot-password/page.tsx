import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/src/lib/db";
import { generateToken, hashToken, makeExpiry } from "@/src/lib/token";
import { sendPasswordResetEmail } from "@/src/lib/email";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  async function requestReset(formData: FormData) {
    "use server";
    const email = (formData.get("email") as string).trim().toLowerCase();

    const user = await db.user.findUnique({ where: { email } });

    if (user && user.status === "ACTIVE") {
      // Delete any existing reset tokens for this user before creating a new one
      await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

      const raw = generateToken();
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: makeExpiry(1),
        },
      });

      await sendPasswordResetEmail({ to: email, token: raw });
    }

    // Always redirect with success — never reveal whether the email exists
    redirect("/forgot-password?sent=1");
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-800 text-center mb-8">
          Family Health
        </h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-base font-medium text-gray-800 mb-1">
            Reset password
          </h2>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                If that email address is registered, you'll receive a reset link
                shortly.
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
              <p className="text-sm text-gray-500 mb-5">
                Enter your email and we'll send you a reset link.
              </p>
              <ForgotPasswordForm action={requestReset} />
              <Link
                href="/login"
                className="block text-sm text-gray-500 hover:text-gray-700 text-center mt-4"
              >
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
