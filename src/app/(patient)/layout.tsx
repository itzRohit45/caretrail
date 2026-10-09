import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/ssr";
import { Wordmark } from "@/components/wordmark";
import { PatientNav } from "@/components/patient/nav";
import { logout } from "@/app/(auth)/actions";
import { buttonClass } from "@/components/ui/button";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-24 lg:pb-0">
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/home" className="rounded-control">
            <Wordmark />
          </Link>
          <form action={logout}>
            <button type="submit" className={buttonClass("quiet", "dense")}>
              <SignOut aria-hidden className="size-5" />
              Log out
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-5xl lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10 lg:px-4 lg:py-8">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <PatientNav />
        </aside>
        <main id="main" className="mx-auto w-full max-w-xl px-4 py-6 lg:mx-0 lg:px-0 lg:py-0">
          {children}
        </main>
      </div>
    </div>
  );
}
