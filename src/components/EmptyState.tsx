import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] font-serif text-lg font-semibold text-[var(--accent-text)]"
      >
        §
      </div>
      <h2 className="font-serif text-xl font-semibold text-[var(--text-heading)]">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <div className="mt-5">
          <Link
            href={actionHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
          >
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
