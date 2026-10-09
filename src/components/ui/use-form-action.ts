"use client";

import { startTransition, useActionState } from "react";

/**
 * Like useActionState, but submits through onSubmit so React does not reset the form.
 * A failed save must never wipe what the patient typed (React 19 resets selects to their
 * first default, which silently cleared fields on the next save).
 */
export function useFormAction<S>(action: (prev: Awaited<S>, form: FormData) => Promise<Awaited<S>>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, onSubmit, pending };
}
