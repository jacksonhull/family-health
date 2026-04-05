import { auth } from "@/src/auth";
import { redirect } from "next/navigation";
import Header from "@/src/components/Header";
import SettingsNav from "./SettingsNav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const username = session.user?.name ?? "admin";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header username={username} />
      <div className="flex flex-1 w-full max-w-3xl mx-auto px-4 py-10 gap-8">
        <SettingsNav />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
