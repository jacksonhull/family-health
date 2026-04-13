"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export type MemberOption = { id: string; name: string | null };

export default function MemberDropdown({
  members,
  selectedId,
  selectedName,
}: {
  members: MemberOption[];
  selectedId: string;
  selectedName: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(id: string) {
    setOpen(false);
    router.push(`${pathname}?memberId=${id}`);
  }

  const initial = selectedName.charAt(0).toUpperCase();
  const canSwitch = members.length > 1;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => canSwitch && setOpen((o) => !o)}
        className={`flex items-center gap-1.5 h-9 pl-2 pr-3 rounded-full text-sm font-medium transition-colors ${
          canSwitch
            ? "bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
            : "bg-blue-50 text-blue-600 cursor-default"
        }`}
        aria-label="Switch member"
      >
        <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
          {initial}
        </span>
        <span className="hidden sm:inline whitespace-nowrap">
          {selectedName}
        </span>
        {canSwitch && (
          <svg
            className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
          <p className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100">
            Switch member
          </p>
          {members.map((m) => {
            const active = m.id === selectedId;
            const name = m.name ?? "Unknown";
            return (
              <button
                key={m.id}
                onClick={() => select(m.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 truncate">{name}</span>
                {active && (
                  <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
