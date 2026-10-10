"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Header pill shown on every patient screen while a doctor has a link open. */
export function LiveViewerPill() {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetch("/api/access-logs").catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      if (live && body?.data) setNames(body.data.viewing_now.map((v: { viewer_name: string }) => v.viewer_name));
    };
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (!names.length) return null;
  return (
    <Link href="/sharing/history" role="status" className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-verified-soft px-3 text-dense font-semibold text-verified">
      <span aria-hidden className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-pill bg-verified opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-pill bg-verified" />
      </span>
      <span className="max-w-[12rem] truncate sm:max-w-none">{names[0]}{names.length > 1 ? ` +${names.length - 1}` : ""} viewing now</span>
    </Link>
  );
}
