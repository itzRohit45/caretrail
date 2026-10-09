"use client";

import { useFormStatus } from "react-dom";
import { CircleNotch } from "@phosphor-icons/react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";

/** Keeps its width while pending and announces the busy state. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "patient",
  className,
  pending: pendingProp,
}: {
  pending?: boolean;
  children: React.ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)}>
      {pending ? (
        <>
          <CircleNotch aria-hidden className="size-5 animate-spin" weight="bold" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
