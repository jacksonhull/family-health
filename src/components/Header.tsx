import Link from "next/link";
import ProfileMenu from "./ProfileMenu";

export default function Header({
  username,
  actions,
}: {
  username: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-1 flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Family Health" className="w-12 h-12 shrink-0" />
        <h1 className="text-lg font-semibold text-gray-800 hover:text-blue-600 transition-colors">
          Family Health
        </h1>
      </Link>
      <div className="flex items-center gap-2">
        {actions}
        <ProfileMenu username={username} />
      </div>
    </header>
  );
}
