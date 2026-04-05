import ProfileMenu from "./ProfileMenu";

export default function Header({ username }: { username: string }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-gray-800">Family Health</h1>
      <ProfileMenu username={username} />
    </header>
  );
}
