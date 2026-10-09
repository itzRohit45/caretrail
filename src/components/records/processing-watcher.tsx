"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";

/** Resumes a read that has not started yet, then polls until it finishes. */
export function ProcessingWatcher({ documentId, status }: { documentId: string; status: string }) {
  const router = useRouter();
  useEffect(() => {
    let live = true;
    if (status === "pending") fetch(`/api/documents/${documentId}/process`, { method: "POST" }).then(() => live && router.refresh());
    const timer = setInterval(async () => {
      const res = await fetch(`/api/documents/${documentId}/extraction`).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (live && body?.data?.status && body.data.status !== "processing" && body.data.status !== "pending") router.refresh();
    }, 2500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [documentId, status, router]);
  return (
    <p role="status" className="flex items-center gap-3 rounded-card border border-rule bg-sheet p-5 font-semibold">
      <CircleNotch aria-hidden weight="bold" className="size-6 animate-spin text-primary" />
      Reading your document. This usually takes 5 to 15 seconds.
    </p>
  );
}
