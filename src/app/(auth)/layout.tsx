import Link from "next/link";
import { LockKey, Eye, ClockCountdown } from "@phosphor-icons/react/ssr";
import { Wordmark } from "@/components/wordmark";
import { SampleLabCard } from "@/components/marketing/samples";

const promises = [
  { Icon: LockKey, text: "Only you can see your records after you log in." },
  { Icon: ClockCountdown, text: "Doctors see only what you share, until the link ends." },
  { Icon: Eye, text: "Every view is logged where you can see it." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="hidden border-r border-rule bg-sheet lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="self-start rounded-control" aria-label="CareTrail home">
          <Wordmark />
        </Link>
        <div className="max-w-md">
          <p className="font-serif text-headline font-medium">
            Your record <em className="italic">stays yours.</em>
          </p>
          <ul className="mt-8 space-y-4">
            {promises.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-lead text-ink-2">
                <Icon aria-hidden weight="duotone" className="size-6 shrink-0 text-primary" />
                {text}
              </li>
            ))}
          </ul>
          <SampleLabCard className="mt-10 max-w-sm shadow-float" />
        </div>
        <p className="text-meta text-ink-3">Sample data shown. CareTrail is an information tool, not medical advice.</p>
      </aside>
      <main className="flex min-h-dvh flex-col px-5 py-6 sm:px-6 lg:min-h-0 lg:items-center lg:justify-center lg:py-12">
        <Link href="/" className="self-start rounded-control lg:hidden" aria-label="CareTrail home">
          <Wordmark />
        </Link>
        <div className="mx-auto mt-10 w-full max-w-md lg:mt-0">{children}</div>
      </main>
    </div>
  );
}
