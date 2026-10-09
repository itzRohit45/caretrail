"use client";

import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function PatientError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageHeader title="Something went wrong" subtitle="Your records are safe. Nothing was lost." />
      <PageBody>
        <div className="space-y-4 rounded-card border border-rule bg-sheet p-5 sm:p-7">
          <Alert tone="severe" title="This page could not load" role="alert">
            Check your internet connection and try again.
          </Alert>
          <button type="button" onClick={reset} className={buttonClass("primary")}>
            Try again
          </button>
        </div>
      </PageBody>
    </>
  );
}
