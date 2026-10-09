/** Teaches the next action: one headline, one sentence, one action. */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-rule-strong px-6 py-10 text-center">
      <p className="text-title font-bold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-[40ch] text-ink-2">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
