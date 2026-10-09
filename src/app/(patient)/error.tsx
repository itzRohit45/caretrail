"use client";

import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";

export default function PatientError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alert tone="severe" title="This page could not load" role="alert">
        Your records are safe. Check your internet connection and try again.
      </Alert>
      <button type="button" onClick={reset} className={buttonClass("primary")}>
        Try again
      </button>
    </div>
  );
}
