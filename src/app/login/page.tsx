import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signIn } from "@/src/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const { error, success } = await searchParams;

  async function handleLogin(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: "/dashboard",
      });
    } catch (err: unknown) {
      // NextAuth throws a redirect on success — only real errors land here
      const message = (err as Error)?.message ?? "";
      if (message.includes("NEXT_REDIRECT")) throw err;
      redirect("/login?error=invalid");
    }
  }

  const SUCCESS_MESSAGES: Record<string, string> = {
    account_created: "Your account is ready. Sign in to get started.",
    password_reset: "Password updated. Sign in with your new password.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-800 text-center mb-8">
          Family Health
        </h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {success && SUCCESS_MESSAGES[success] && (
            <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {SUCCESS_MESSAGES[success]}
            </p>
          )}
          {error === "invalid" && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Invalid email or password.
            </p>
          )}
          <LoginForm action={handleLogin} />
          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
