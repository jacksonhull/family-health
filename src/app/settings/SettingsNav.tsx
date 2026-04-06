"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

const BASE_ITEMS = [
  { label: "Account", href: "/settings/account" },
  { label: "About", href: "/settings/about" },
];

const ADMIN_ITEMS = [{ label: "Users", href: "/settings/users" }];

export default function SettingsNav({ role }: { role: Role | undefined }) {
  const pathname = usePathname();
  const items = [
    ...BASE_ITEMS,
    ...(role === "ADMINISTRATOR" ? ADMIN_ITEMS : []),
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
