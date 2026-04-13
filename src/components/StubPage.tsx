import Header from "./Header";
import SubNav from "./SubNav";

export default function StubPage({
  username,
  memberId,
  title,
  description,
  rightSlot,
  headerActions,
}: {
  username: string;
  memberId?: string;
  title: string;
  description: string;
  rightSlot?: React.ReactNode;
  headerActions?: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header username={username} actions={headerActions} />
      <SubNav memberId={memberId} rightSlot={rightSlot} />
      <main className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-3xl mb-3">🚧</p>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">{title}</h2>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </main>
    </div>
  );
}
