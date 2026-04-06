"use client";

import { useRouter, usePathname } from "next/navigation";

export type MemberOption = { id: string; name: string | null };

export default function MemberSelector({
  members,
  selectedId,
}: {
  members: MemberOption[];
  selectedId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Only render if there's more than one member to choose from
  if (members.length <= 1) return null;

  function select(id: string) {
    // Switch member and clear any active edit
    router.push(`${pathname}?memberId=${id}`);
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-2">
      <div className="max-w-6xl mx-auto flex items-center gap-1 flex-wrap">
        <span className="text-xs text-gray-400 mr-2 shrink-0">Viewing:</span>
        {members.map((m) => {
          const active = m.id === selectedId;
          const initial = (m.name ?? "?")[0].toUpperCase();
          return (
            <button
              key={m.id}
              onClick={() => select(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  active ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                {initial}
              </span>
              {m.name ?? "Unknown"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
