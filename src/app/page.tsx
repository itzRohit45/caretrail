import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { buttonClass } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-6">
      <header className="flex h-12 items-center">
        <Wordmark />
      </header>
      <main className="flex flex-1 flex-col justify-center py-12">
        <h1 className="max-w-[18ch] text-display font-extrabold md:text-emergency">
          Every report you own, on one timeline your doctor can trust.
        </h1>
        <p className="mt-5 max-w-[46ch] text-lead text-ink-2">
          CareTrail reads your prescriptions and lab reports, catches medicine mix-ups, and shares only what you choose.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/signup" className={buttonClass("primary")}>
            Create account
          </Link>
          <Link href="/login" className={buttonClass("secondary")}>
            Log in
          </Link>
        </div>
      </main>
      <footer className="border-t border-rule pt-4 text-dense text-ink-2">
        CareTrail is an information tool, not medical advice. All demo data is simulated.
      </footer>
    </div>
  );
}
