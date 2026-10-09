import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Atkinson_Hyperlegible_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin", "latin-ext"], adjustFontFallback: false });
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"] });
const mono = Atkinson_Hyperlegible_Mono({ variable: "--font-atkinson-mono", subsets: ["latin"], adjustFontFallback: false });

export const metadata: Metadata = {
  title: { default: "CareTrail", template: "%s · CareTrail" },
  description: "Your prescriptions and lab reports on one verified timeline, shared safely with the doctors you choose.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ed" },
    { media: "(prefers-color-scheme: dark)", color: "#121316" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
