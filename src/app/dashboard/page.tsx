import { auth, signOut } from "@/src/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const username = session.user?.name ?? "admin";

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Family Health</h1>
        <form action={handleSignOut}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-600 text-lg">
          Welcome,{" "}
          <span className="font-medium text-gray-800">{username}</span>.
        </p>
      </main>
    </div>
  );
}
