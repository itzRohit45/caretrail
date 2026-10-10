import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = { title: "Privacy policy" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What CareTrail stores",
    body: [
      "Your account: email address and name (from the sign-up form, or from Google if you continue with Google).",
      "What you add: your profile (date of birth, sex, blood group, emergency contact), allergies, the documents you upload or type, and the medicines, test results and diagnoses read from them.",
      "Who saw your records: every time a share link or your emergency card is used, the name the viewer entered and the time. IP addresses are stored only as a one-way hash.",
    ],
  },
  {
    title: "Where it is kept",
    body: [
      "Data is stored with Supabase (database and private file storage) in Sydney, Australia, and the app runs on Vercel. Files are never public: they are opened through links that expire after 5 minutes.",
      "Each account can only read its own records. A doctor sees only what you choose to share, for as long as you choose, and you can end access at any time.",
    ],
  },
  {
    title: "Who processes it for us",
    body: [
      "Google Gemini API reads the documents you upload so you do not have to type them. This build uses Google's free tier, under which Google may use submitted content to improve its services. Only upload documents you are comfortable sending to Google.",
      "Brevo sends alert emails (for example when your emergency card is used). Google provides sign-in if you choose Continue with Google.",
      "CareTrail does not sell data and does not show advertising.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You decide what each share link includes and when it ends. Access history cannot be edited or deleted, so you always see who viewed your records.",
      "You can download everything you have saved as a FHIR file from your profile. To delete your account and records, contact the team as described below.",
    ],
  },
];

/** Public privacy policy (also the link Google's sign-in consent screen requires). */
export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-18 max-w-3xl items-center px-5 sm:px-6">
        <Link href="/" className="rounded-control" aria-label="CareTrail home">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pt-6 pb-16 sm:px-6">
        <h1 className="font-serif text-display font-medium md:text-headline">Privacy policy</h1>
        <p className="mt-3 text-lead text-ink-2">
          CareTrail is a hackathon project (IIITDM Kancheepuram, October 2026). It is an information tool, not medical advice, and it is not a certified medical records system.
        </p>
        <div className="mt-10 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title} aria-labelledby={s.title}>
              <h2 id={s.title} className="text-title font-bold">{s.title}</h2>
              <ul className="mt-3 space-y-3">
                {s.body.map((line) => (
                  <li key={line} className="max-w-[68ch]">{line}</li>
                ))}
              </ul>
            </section>
          ))}
          <section aria-labelledby="contact">
            <h2 id="contact" className="text-title font-bold">Contact</h2>
            <p className="mt-3 max-w-[68ch]">For questions or to delete your account, contact the CareTrail team through the support email shown on Google&apos;s sign-in screen, or through the IIITDM Kancheepuram hackathon organisers.</p>
            <p className="mt-6 text-dense text-ink-2">Last updated 10 October 2026.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
