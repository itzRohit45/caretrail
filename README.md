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
3. **Consent you can see and revoke.** Scoped, expiring share links with a live "viewing now" indicator, instant revocation, an access log, and an emergency card.

## Setup

Requires Node 22 (`nvm use` reads `.nvmrc`).

```bash
npm install
cp .env.example .env.local        # fill in the values; each line says where it comes from
npm run migrate                   # applies supabase/migrations to your Supabase database
npm run gen-types                 # regenerates src/lib/db/types.ts from the live schema
npm run dev
```

Checks: `npm run typecheck && npm run lint && npm run build`, unit tests `npm test`, browser smoke tests `node --env-file=.env.local scripts/e2e/phase-a.mjs` (needs the dev server and Google Chrome).

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
| Google Gemini API (`gemini-3.6-flash`, fallback `gemini-3.5-flash-lite`) | Document extraction (vision). Free tier; simulated data only. |
| Brevo transactional email API | Emergency and break-glass alert emails |
| Atkinson Hyperlegible Next / Mono (Braille Institute, via Google Fonts) | Typeface chosen for low-vision readers |
| Vercel | Hosting |
| `pg` (dev) | Migration runner and type generator scripts |
| Vitest (dev) | Unit tests |
| Playwright Core (dev, drives local Chrome) | Browser smoke tests and screenshots |
| ESLint (dev) | Linting |
| Agent skills used during development: ui-ux-pro-max, design-taste-frontend, impeccable, ponytail, graphify (see `skills-lock.json`) | Design system research, UI audits, code-size discipline, code graph |
| Claude Code (Anthropic) | AI pair programmer used to write code |
