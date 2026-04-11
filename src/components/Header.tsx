import Link from "next/link";
import ProfileMenu from "./ProfileMenu";

export default function Header({ username }: { username: string }) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link href="/dashboard">
        <h1 className="text-lg font-semibold text-gray-800 hover:text-blue-600 transition-colors">
          Family Health
        </h1>
      </Link>
      <ProfileMenu username={username} />
    </header>
  );
}
