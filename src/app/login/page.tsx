import { redirect } from "next/navigation";
import { auth, signIn } from "@/src/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const { error } = await searchParams;

  async function handleLogin(formData: FormData) {
    "use server";
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      await signIn("credentials", {
        username,
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

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-800 text-center mb-8">
          Family Health
        </h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {error === "invalid" && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Invalid username or password.
            </p>
          )}
          <LoginForm action={handleLogin} />
        </div>
      </div>
    </div>
  );
}
