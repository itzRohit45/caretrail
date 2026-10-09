import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/alert";
import { safeNext } from "@/lib/schemas/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const returning = typeof next === "string";
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-display font-medium md:text-headline">Welcome <em className="italic">back</em></h1>
      {returning ? (
        <Alert tone="info" title="Please log in again">
          For your safety you were logged out. You will go straight back to where you were.
        </Alert>
      ) : null}
      {error === "no-profile" ? (
        <Alert tone="severe" title="We could not find your profile" role="alert">
          Log in again. If this keeps happening, create a new account.
        </Alert>
      ) : null}
      <LoginForm next={safeNext(next)} />
      <p className="text-ink-2">
        New to CareTrail?{" "}
        <Link href="/signup" className="font-semibold text-primary underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
