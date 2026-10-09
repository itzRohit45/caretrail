"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, UserCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

// Items appear here only once their screen works end to end.
const items = [
  { href: "/home", label: "Home", Icon: House },
  { href: "/profile", label: "Profile", Icon: UserCircle },
] as const;

export function PatientNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-sheet pb-[env(safe-area-inset-bottom)] lg:static lg:border-t-0 lg:bg-transparent lg:pb-0">
      <ul className="mx-auto flex max-w-xl justify-around lg:flex-col lg:gap-1">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1 lg:flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-control text-meta font-semibold transition-colors duration-150 lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-body",
                  active ? "text-primary lg:bg-primary-soft" : "text-ink-2 hover:text-ink lg:hover:bg-sheet-sunk",
                )}
              >
                <Icon aria-hidden weight={active ? "fill" : "regular"} className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
