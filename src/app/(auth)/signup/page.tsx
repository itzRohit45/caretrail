import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/auth-forms";
import { GoogleButton } from "@/components/auth/google-button";
import { googleEnabled } from "@/lib/auth-providers";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const google = await googleEnabled();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-serif text-display font-medium md:text-headline">Create your <em className="italic">account</em></h1>
        <p className="text-ink-2">Your records stay private to you. Only you decide who sees them.</p>
      </div>
      {google ? <GoogleButton next="/home" /> : null}
      <SignupForm />
      <p className="text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
