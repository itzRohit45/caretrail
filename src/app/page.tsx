import Image from "next/image";
import Link from "next/link";
import { FileMagnifyingGlass, Pill, HandPalm } from "@phosphor-icons/react/ssr";
import { Wordmark } from "@/components/wordmark";
import { buttonClass } from "@/components/ui/button";
import { SampleBrief, SampleLabCard, SampleViewingPill, SampleWarningCard } from "@/components/marketing/samples";
import { DemoPanel } from "@/components/demo/demo-panel";
import { Alert } from "@/components/ui/alert";
import portrait from "../../public/images/patient-portrait.jpg";

const features = [
  {
    Icon: FileMagnifyingGlass,
    title: "Every fact shows its source",
    body: "A doctor taps any line of the summary and the original report opens, with the exact words highlighted.",
  },
  {
    Icon: Pill,
    title: "Medicines checked across all your doctors",
    body: "The same medicine under two brand names, risky combinations and allergy clashes are flagged, with who prescribed what.",
  },
  {
    Icon: HandPalm,
    title: "Sharing you can see and stop",
    body: "Links end on their own. You see who is viewing right now, and you can end access in one tap.",
  },
];

export default async function Landing({ searchParams }: PageProps<"/">) {
  const { demo } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-18 w-full max-w-6xl items-center justify-between px-5 sm:px-6">
        <Wordmark />
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link href="/login" className={buttonClass("quiet", "dense")}>
            Log in
          </Link>
          <span className="hidden sm:block">
            <Link href="/signup" className={buttonClass("primary", "dense")}>
              Create account
            </Link>
          </span>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-6 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-10 lg:pb-24">
          <div>
            <h1 className="max-w-[14ch] font-serif text-headline font-medium sm:text-hero">
              Your health history, <em className="italic">in the right hands.</em>
            </h1>
            <p className="mt-6 max-w-[42ch] text-lead text-ink-2">
              CareTrail reads your prescriptions and lab reports, catches medicine mix-ups across doctors, and shares only what you choose.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#demo" className={buttonClass("primary")}>
                Try the demo
              </a>
              <Link href="/signup" className={buttonClass("secondary")}>
                Create free account
              </Link>
            </div>
          </div>

          <figure className="relative mx-auto w-full max-w-lg lg:mr-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-media bg-sheet-sunk">
              <Image src={portrait} alt="An older man smiling at the camera" fill priority placeholder="blur" sizes="(min-width: 1024px) 32rem, 92vw" className="object-cover object-[50%_30%]" />
              <SampleViewingPill className="absolute top-4 left-4 shadow-float" />
            </div>
            <div className="relative -mt-28 space-y-3 px-4 sm:px-8 lg:absolute lg:inset-0 lg:mt-0 lg:px-0">
              <SampleLabCard className="shadow-float lg:absolute lg:top-[38%] lg:-left-14 lg:w-80" />
              <SampleWarningCard className="shadow-float lg:absolute lg:-right-8 lg:bottom-8 lg:w-80" />
            </div>
            <figcaption className="mt-4 text-meta text-ink-3 lg:mt-5">
              Sample record with simulated names. Photo by Wilfred Sequeira on Unsplash.
            </figcaption>
          </figure>
        </section>

        <section id="demo" aria-labelledby="demo-title" className="scroll-mt-6 border-t border-rule">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 lg:py-20">
            <h2 id="demo-title" className="font-serif text-display font-medium md:text-headline">
              Try it with a <em className="italic">sample patient</em>
            </h2>
            <p className="mt-3 max-w-[56ch] text-lead text-ink-2">Every record was read from simulated prescriptions and lab reports by the same pipeline you would use. No sign-up needed.</p>
            {demo ? (
              <Alert tone="info" title={demo === "busy" ? "Many demos started from your network" : "The demo could not start"} className="mt-6 max-w-xl" role="status">
                {demo === "busy" ? "Please wait a few minutes and try again, or create a free account." : "Please try again in a moment."}
              </Alert>
            ) : null}
            <div className="mt-8">
              <DemoPanel />
            </div>
          </div>
        </section>

        <section aria-labelledby="how-title" className="border-t border-rule bg-sheet">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:py-24">
            <div>
              <h2 id="how-title" className="max-w-[18ch] font-serif text-display font-medium md:text-headline">
                A new doctor understands you in <em className="italic">thirty seconds.</em>
              </h2>
              <ul className="mt-10 space-y-8">
                {features.map(({ Icon, title, body }) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-primary">
                      <Icon aria-hidden weight="duotone" className="size-6" />
                    </span>
                    <div>
                      <h3 className="text-lead font-bold">{title}</h3>
                      <p className="mt-1 max-w-[46ch] text-ink-2">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:pt-4">
              <SampleBrief />
              <p className="mt-3 text-meta text-ink-3">What a doctor sees from a diabetes-only link. Simulated patient.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-dense text-ink-2 sm:flex-row sm:justify-between sm:px-6">
          <p>CareTrail is an information tool, not medical advice.</p>
          <p>Demo data is simulated. No real patient data is used.</p>
        </div>
      </footer>
    </div>
  );
}
