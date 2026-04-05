import { auth } from "@/src/auth";
import { redirect } from "next/navigation";
import Header from "@/src/components/Header";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const username = session.user?.name ?? "admin";

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={username} />
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-600 text-lg">
          Welcome,{" "}
          <span className="font-medium text-gray-800">{username}</span>.
        </p>
      </main>
    </div>
  );
}
