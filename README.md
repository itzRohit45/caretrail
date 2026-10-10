# CareTrail

**Your health history, understood, safe, and in the right doctor's hands only when you say so.**

Built in 24 hours at the IIITDM Kancheepuram web development hackathon (HealthTech track: *Lost in Transit: Fragmented Medical Records and Repeated Care Across Providers*).

**Live:** https://caretrail-tan.vercel.app (no sign-up needed: use *Try the demo*). Progress log: `STATUS.md`.

## Problem

Patients with long-term conditions see many doctors, labs and pharmacies. Each keeps its own records, so the patient carries the history as paper, PDFs and WhatsApp photos. Doctors work from incomplete information, tests get repeated, two doctors prescribe the same drug under different brands, and there is no safe way to share records and stop sharing them afterwards.

## Solution

CareTrail reads prescriptions and lab reports into one verified, source-linked timeline:

1. **Source-linked doctor brief.** Every fact links to the document and text it came from.
2. **Cross-prescriber safety checks.** Duplicate generics, drug interactions, allergy conflicts and recently done tests, across all doctors.
3. **Consent you can see and revoke.** Scoped, expiring share links with a live "viewing now" indicator, instant revocation, an access log, and a two-tier emergency card: a public critical card, plus logged "break-glass" full access for clinicians that alerts the patient and their emergency contact.

## What works

Every requirement in the PRD's Must and Should lists, plus the FHIR export stretch goal, is built and covered by a browser test that runs against the live site (`E2E_BASE_URL=https://caretrail-tan.vercel.app node --env-file=.env.local scripts/e2e/<phase>.mjs`).

| PRD | Feature | Test |
|---|---|---|
| FR-01 | Sign up, log in (email, or Google once enabled), profile, allergies, emergency contact | `phase-a` |
| FR-02, FR-03, FR-04 | Upload (10 MB, PDF/JPG/PNG, duplicate block; several photos or PDFs of one report become one multi-page record; phone photos are shrunk on the device), AI extraction with confidence and source text, verify screen beside the original, normalisation (brands to generics, units, dosing shorthand) | `phase-b`, `phase-m` |
| FR-05 | Timeline with condition, type and date filters; lab trends with normal ranges | `phase-c` |
| FR-06, FR-07 | Safety checks across doctors (duplicates, interactions, allergy clashes); Test Saver | `phase-d` |
| FR-08, FR-09, FR-10 | Scoped, expiring share links (QR, optional code, revoke reaches the doctor within 5 s), access history and live "viewing now", source-linked doctor brief | `phase-ef` |
| FR-11 | Emergency QR, public tier 1 card, lock-screen image, wallet card, scan alerts | `phase-g` |
| FR-12 | Break-glass: logged 2-hour full access, contact and patient alerted, revocable | `phase-i` |
| FR-13 | Since-last-visit view for a returning doctor | `phase-j` |
| FR-14 | Doctor write-back: notes and prescriptions, only on links that allow it | `phase-k` |
| FR-15 (Stretch) | FHIR R4 export (Patient, Condition, MedicationStatement, Observation with LOINC where certain, AllergyIntolerance), each fact noting its source | `phase-l` |
| Test account | Every card on the seeded test account shows the uploaded records | `phase-h` |
| Records without a file | Consultation notes typed by the patient, with an optional prescription photo; handwritten prescriptions | `phase-n` |

Accessibility: axe-core WCAG 2.1 AA on 18 screens, 0 violations (`scripts/e2e/audit.mjs`); every screen checked at 360 and 390 px (`scripts/e2e/mobile-shots.mjs`).

### Security in one paragraph
Row-level security on every patient table; the browser never reads patient data for doctors or emergency staff directly, every token request goes through one server gate that re-checks expiry, revocation and scope. Share and emergency tokens are 32 random bytes, kept in the URL fragment, and only their SHA-256 is stored; unknown, expired and revoked tokens get the same 410. Files live in a private bucket and are served through 5-minute signed URLs. The access log is insert-only (database triggers block update and delete, even for the service key). All input and all model output are validated with Zod; the doctor brief is built from database rows only. Token routes are rate limited per IP.

## Setup

Requires Node 22 (`nvm use` reads `.nvmrc`).

```bash
npm install
cp .env.example .env.local        # fill in the values; each line says where it comes from
npm run migrate                   # applies supabase/migrations to your Supabase database
npm run gen-types                 # regenerates src/lib/db/types.ts from the live schema
npm run dev
```

Create the test account (runs the real extraction pipeline on `demo-docs/ravi/`): `npm run seed:test-account`.

**Google sign-in (optional):** in Google Cloud Console create an OAuth client (Web application) with the redirect URI `https://<project>.supabase.co/auth/v1/callback`; in Supabase, *Authentication > Sign In / Providers > Google*, paste the client ID and secret and enable it; in *Authentication > URL Configuration* add `https://<your-site>/auth/callback` to the redirect URLs. The *Continue with Google* button appears by itself once the provider is on.

Checks: `npm run typecheck && npm run lint && npm run build`, unit tests `npm test` (51), browser tests in `scripts/e2e/` (`phase-a` to `phase-n`, plus `mobile-shots.mjs` for 360/390 px captures with an overflow check; need the dev server and Google Chrome), e.g. `node --env-file=.env.local scripts/e2e/phase-ef.mjs`.

## Try it

**Test account** (a simulated patient, Ravi Kumar, with 10 sample prescriptions, lab reports and a discharge summary already uploaded through the real pipeline):

| Email | Password |
|---|---|
| `caretrail.test@example.com` | `CareTrail@2026` |

The account is shared, so other testers may add records or links too. Rebuild it any time with `npm run seed:test-account`. Or create your own account (email, or *Continue with Google* once it is enabled in Supabase).

- **Home:** medicine warnings across doctors (penicillin allergy clash, metformin prescribed twice, an interaction), Taking now, Tests still valid with a rupee estimate, Latest results with each lab's printed range.
- **Add a record:** upload a photo or PDF; several photos of one report become one record; or choose *Consultation notes* and just type what the doctor said (a photo is optional). Try `demo-docs/fresh/ravi-live-upload-rx-oct-2026.jpg` (in the repo): the check screen shows how often and for how many days, worked out from the quantity written on the paper.
- **Medicines:** courses whose written days have passed move to *Finished courses* by themselves.
- **Sharing:** create a link (scope, expiry, optional code; doctors can add notes and prescriptions unless you untick it). Open it in another browser as a doctor: the one-screen brief, every fact opening its source. Notes the doctor leaves appear on Home, Sharing and Access history. *End access* stops the doctor's screen within seconds.
- **Since your last view:** open the same link twice as the same doctor (name and registration number) with a new record added in between.
- **Emergency card:** create the QR on *Emergency card*, open the link on another device; *Request full record* is the logged 2-hour break-glass.

### How the test account was made
Simulated documents (fictional Chennai clinics, labs and patients) were rendered as PDFs and phone-style photos (`scripts/demo-docs/build.mjs`, output in `demo-docs/`), then run through the same upload, AI extraction, normalisation and safety pipeline the app uses (`scripts/seed-test-account.mts`). Every field was saved exactly as the model read it; nothing was typed by hand. The most recent prescriptions are dated early October 2026 so their courses are still running.

### Known limits
- Handwriting is read by the AI with varying success from one try to the next; every medicine dose and frequency always goes to the patient's check screen. When the model leaves a field empty, the dosing pattern and quantity are read from the line exactly as written.
- Days are worked out from a written quantity only when it divides exactly by the doses a day (20 tablets at 1-0-1 = 10 days); bottles, creams and inhalers are never converted.
- Interaction checks cover the medicines in the DDInter dataset; gliclazide, vildagliptin, teneligliptin, voglibose and cilnidipine are recognised but not covered.
- *Since your last view* needs the same name and registration number as the earlier view; registration numbers are not verified against the medical council register.
- Google sign-in needs the Google provider switched on in Supabase (see Setup); until then only email sign-in is shown.
- Typed consultation notes are stored as a PDF in a standard font, so letters outside Latin script are replaced.

## Disclosures

Everything below was used to build CareTrail. No real patient data is used anywhere; all demo records are simulated.

| Item | Use |
|---|---|
| Next.js 16, React 19, TypeScript | Web app framework and API routes |
| Tailwind CSS 4 (+ `@tailwindcss/turbopack`) | Styling with project design tokens |
| Supabase (Postgres, Auth, Storage) via `@supabase/supabase-js`, `@supabase/ssr` | Database with row-level security, login, private file storage |
| Zod | Validation of all API input and AI output |
| Recharts | Lab trend charts |
| qrcode.react | Share and emergency QR codes |
| pdf.js (`pdfjs-dist`) | PDF rendering and source-text highlighting |
| pdf-lib | Combines several photos or PDFs of one report into one PDF, in the browser |
| Phosphor Icons (`@phosphor-icons/react`) | Icons |
| `server-only` | Keeps server secrets out of client bundles |
| Google Gemini API (`gemini-3.5-flash-lite`, fallback `gemini-3.6-flash`) | Document extraction (vision). Free tier; only simulated documents are sent. Model order chosen from a head-to-head test on the demo documents. |
| Brevo transactional email API | Emergency and break-glass alert emails |
| Atkinson Hyperlegible Next / Mono (Braille Institute) and Source Serif 4 (Adobe), via Google Fonts | Body type chosen for low-vision readers; serif for headings and numbers |
| Kalam (Google Fonts) | Handwriting style used only when generating the simulated demo prescriptions |
| Portrait photo supplied by the team (source and licence to be confirmed by the team before public use) | Landing page portrait |
| DDInter drug-drug interaction dataset (Xiong et al., Nucleic Acids Research 2022, ddinter.scbdd.com) | Interaction pairs and severity, filtered to the 55 curated generics (293 pairs); free for academic, non-commercial use |
| Brand-to-generic map and test validity table | Hand-curated for this demo from publicly known Indian brand names and typical lab practice; not a clinical database |
| Vercel | Hosting |
| `pg` (dev) | Migration runner and type generator scripts |
| Vitest (dev) | Unit tests |
| tsx (dev) | Runs TypeScript scripts (seeding, extraction checks) |
| Playwright Core (dev, drives local Chrome) | Browser smoke tests and screenshots |
| axe-core via `@axe-core/playwright` (dev) | WCAG 2.1 AA accessibility audit (`scripts/e2e/audit.mjs`) |
| ESLint (dev) | Linting |
| Agent skills used during development: ui-ux-pro-max, design-taste-frontend, impeccable, ponytail, graphify (see `skills-lock.json`) | Design system research, UI audits, code-size discipline, code graph |
| Claude Code (Anthropic) | AI pair programmer used to write code |
