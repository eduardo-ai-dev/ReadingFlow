export function ProgressBar({
  value,
  label,
  variant = "gradient",
  className = "",
}: {
  value: number;
  label: string;
  variant?: "solid" | "gradient";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`w-full ${className}`}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="h-2 w-full overflow-hidden rounded-[var(--rf-radius-full)] bg-[var(--rf-surface-subtle)]"
      >
        <div
          style={{ width: `${clamped}%` }}
          className={`h-full rounded-[var(--rf-radius-full)] transition-[width] duration-300 ${
            variant === "gradient"
              ? "bg-gradient-to-r from-[var(--rf-accent-secondary)] to-[var(--rf-accent-primary)]"
              : "bg-[var(--rf-accent-secondary)]"
          }`}
        />
      </div>
    </div>
  );
}
