"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

const ACCOUNT_ITEMS = [
  { label: "Account", href: "/settings/account" },
];

const ADMIN_ITEMS = [
  { label: "Family Members", href: "/settings/users" },
  { label: "AI Models", href: "/settings/ai" },
];

const ABOUT_ITEM = { label: "About", href: "/settings/about" };

export default function SettingsNav({ role }: { role: Role | undefined }) {
  const pathname = usePathname();
  const items = [
    ...ACCOUNT_ITEMS,
    ...(role === "ADMINISTRATOR" ? ADMIN_ITEMS : []),
    ABOUT_ITEM,
  ];

  return (
    <nav className="w-40 shrink-0">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-white hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
