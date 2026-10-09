"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Files, UserCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

// Items appear here only once their screen works end to end.
const items = [
  { href: "/home", label: "Home", Icon: House },
  { href: "/records", label: "Records", Icon: Files },
  { href: "/profile", label: "Profile", Icon: UserCircle },
] as const;

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Desktop: pill tabs in the header. */
export function HeaderTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex gap-1 rounded-pill border border-rule bg-sheet p-1">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-pill px-4 font-semibold transition-colors duration-150",
                  active ? "bg-primary text-on-primary" : "text-ink-2 hover:bg-sheet-sunk hover:text-ink",
                )}
              >
                <Icon aria-hidden weight={active ? "fill" : "regular"} className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phones: a bottom tab bar within thumb reach. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-sheet pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-16 flex-col items-center justify-center gap-0.5 text-meta font-semibold", active ? "text-primary" : "text-ink-2")}
              >
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-pill transition-colors duration-150", active && "bg-primary-soft")}>
                  <Icon aria-hidden weight={active ? "fill" : "regular"} className="size-6" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
