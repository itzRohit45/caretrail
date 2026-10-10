# CareTrail

**Your health history, understood, safe, and in the right doctor's hands only when you say so.**

Built in 24 hours at the IIITDM Kancheepuram web development hackathon (HealthTech track: *Lost in Transit: Fragmented Medical Records and Repeated Care Across Providers*).

> Work in progress during the hackathon. See `STATUS.md` for what works right now.

## Problem

Patients with long-term conditions see many doctors, labs and pharmacies. Each keeps its own records, so the patient carries the history as paper, PDFs and WhatsApp photos. Doctors work from incomplete information, tests get repeated, two doctors prescribe the same drug under different brands, and there is no safe way to share records and stop sharing them afterwards.

## Solution

CareTrail reads prescriptions and lab reports into one verified, source-linked timeline:

1. **Source-linked doctor brief.** Every fact links to the document and text it came from.
2. **Cross-prescriber safety checks.** Duplicate generics, drug interactions, allergy conflicts and recently done tests, across all doctors.
3. **Consent you can see and revoke.** Scoped, expiring share links with a live "viewing now" indicator, instant revocation, an access log, and a two-tier emergency card: a public critical card, plus logged "break-glass" full access for clinicians that alerts the patient and their emergency contact.

## Setup

Requires Node 22 (`nvm use` reads `.nvmrc`).

```bash
npm install
cp .env.example .env.local        # fill in the values; each line says where it comes from
npm run migrate                   # applies supabase/migrations to your Supabase database
npm run gen-types                 # regenerates src/lib/db/types.ts from the live schema
npm run dev
```

Seed the demo patients (runs the real extraction pipeline on `demo-docs/`): `npm run seed`.

Checks: `npm run typecheck && npm run lint && npm run build`, unit tests `npm test` (36), browser tests in `scripts/e2e/` (`phase-a` to `phase-k`, plus `mobile-shots.mjs` for 360/390 px captures with an overflow check; need the dev server and Google Chrome), e.g. `node --env-file=.env.local scripts/e2e/phase-ef.mjs`.

## Try it

- **Try demo:** on the landing or login page, choose *Try as Ravi*, *Lakshmi* or *Arun*. You get a private copy of a simulated patient (no sign-up).
- **Doctor's view:** *Open a doctor's view* mints a real 1-hour link to Ravi's record. It is pre-filled as Ravi's diabetologist (Dr. A. Suresh, registration TNMC 61234), whose simulated last view was on 20 Aug 2026, so it opens on *Since your last view*: two new prescriptions from other doctors, the penicillin clash, the duplicate metformin and the rising HbA1c. Change the name to see the record as a new doctor.
- **Emergency card:** *Open an emergency card* shows Arun's tier 1 card. At the bottom, *Request full record* is the tier 2 break-glass: enter a name, hospital and registration number to open the full record for 2 hours.
- **Doctor write-back:** *Try as Ravi*, open *Sharing*, tick *Let the doctor add to my record* and create the link. Open it in another browser as a doctor: add a note and upload `demo-docs/fresh/ravi-live-upload-rx-oct-2026.jpg` (in the repo). The prescription goes through the same extraction and waits on the patient's Home, marked *Added by* the doctor, until the patient checks the doses.
- **See break-glass from the patient's side:** *Try as Arun*, add your own email as the emergency contact in Profile, create the emergency QR in *Emergency card*, open the QR link on another device and request the full record. Your inbox gets the alert; Home, Sharing and Access history flag the access, and *End access* stops it.

### How the demo data was made
Twenty-four simulated documents (fictional Chennai clinics, labs and patients) were rendered as PDFs and phone-style photos (`scripts/demo-docs/build.mjs`, output in `demo-docs/`), then run through the same upload, AI extraction, normalisation and safety pipeline the app uses (`npm run seed`). Every field was saved exactly as the model read it; nothing was typed by hand. One fresh prescription (`demo-docs/fresh/`) is kept aside for a live upload.

### Known limits
- The extraction model reports high confidence even on handwriting, so routing relies on the PRD rule that every medicine dose is checked by the patient.
- Interaction checks cover the medicines in the DDInter dataset; gliclazide, vildagliptin, teneligliptin, voglibose and cilnidipine are recognised but not covered.
- Demo copies created by *Try demo* are not cleaned up automatically yet.
- *Since your last view* compares clinical dates (document, test, start and stop dates) with the day of the doctor's previous view; a document uploaded later but dated before that view is not listed as new. It needs the same name and registration number as the earlier view; registration numbers are not verified against the medical council register.

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
| Phosphor Icons (`@phosphor-icons/react`) | Icons |
| `server-only` | Keeps server secrets out of client bundles |
| Google Gemini API (`gemini-3.5-flash-lite`, fallback `gemini-3.6-flash`) | Document extraction (vision). Free tier; only simulated documents are sent. Model order chosen from a head-to-head test on the demo documents. |
| Brevo transactional email API | Emergency and break-glass alert emails |
| Atkinson Hyperlegible Next / Mono (Braille Institute) and Source Serif 4 (Adobe), via Google Fonts | Body type chosen for low-vision readers; serif for headings and numbers |
| Kalam (Google Fonts) | Handwriting style used only when generating the simulated demo prescriptions |
| Photo by Wilfred Sequeira on Unsplash (Unsplash License) | Landing page portrait |
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
