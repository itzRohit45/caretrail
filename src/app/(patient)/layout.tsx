import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/ssr";
import { Wordmark } from "@/components/wordmark";
import { HeaderTabs, BottomTabs } from "@/components/patient/nav";
import { logout } from "@/app/(auth)/actions";
import { LiveViewerPill } from "@/components/sharing/live-viewer-pill";
import { AlertsBell } from "@/components/alerts/alerts-bell";
import { buttonClass } from "@/components/ui/button";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-control focus:bg-sheet focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/home" className="rounded-control" aria-label="CareTrail home">
            <Wordmark />
          </Link>
          <HeaderTabs />
          <div className="flex items-center gap-1 sm:gap-2">
            <LiveViewerPill />
            <AlertsBell />
            <form action={logout}>
              <button type="submit" className={buttonClass("quiet", "dense")}>
                <SignOut aria-hidden className="size-5" />
                <span className="hidden sm:inline">Log out</span>
                <span className="sr-only sm:hidden">Log out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <BottomTabs />
    </div>
  );
}
