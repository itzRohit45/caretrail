import { googleLogin } from "@/app/(auth)/actions";
import { buttonClass } from "@/components/ui/button";

/** "Continue with Google", plus an "or" rule above the email form. Rendered only when Google is enabled. */
export function GoogleButton({ next }: { next: string }) {
  return (
    <div className="space-y-5">
      <form action={googleLogin}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className={buttonClass("secondary", "patient", "w-full")}>
          <svg aria-hidden viewBox="0 0 24 24" className="size-5">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
          </svg>
          Continue with Google
        </button>
      </form>
      <p className="flex items-center gap-3 text-dense text-ink-2" aria-hidden>
        <span className="h-px flex-1 bg-rule" /> or with email <span className="h-px flex-1 bg-rule" />
      </p>
    </div>
  );
}
