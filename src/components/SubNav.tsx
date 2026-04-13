"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard",   href: "/dashboard"   },
  { label: "Timeline",    href: "/timeline"    },
  { label: "Metrics",     href: "/metrics"     },
  { label: "Medications", href: "/medications" },
  { label: "Treatments",  href: "/treatments"  },
];

export default function SubNav({
  memberId,
  rightSlot,
}: {
  memberId?: string;
  rightSlot?: React.ReactNode;
}) {
  const pathname = usePathname();

  function href(base: string) {
    return memberId ? `${base}?memberId=${memberId}` : base;
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6">
      <div className="flex items-center justify-between -mb-px">
        <nav className="flex items-center">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={href(item.href)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {rightSlot && (
          <div className="flex items-center py-1 mb-px">
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  );
}
