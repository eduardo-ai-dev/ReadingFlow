"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Loader2, Sparkles } from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { startReadingFromWishlistAction } from "@/features/wishlist/actions";
import { rfButtonClassName } from "@/components/ui/ActionControls";

export interface ExplorarWishlistCardItem {
  wishId: string;
  workId: string;
  title: string;
  author: string;
  priority: number;
  targetPrice?: number;
  coverUrl?: string;
  spineColor?: string;
  spineAccent?: string;
  seed: string;
}

export function ExplorarWishlistSectionClient({
  items,
}: {
  items: readonly ExplorarWishlistCardItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [movingWishId, setMovingWishId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const handleStartReading = (item: ExplorarWishlistCardItem) => {
    if (isPending) return;
    setFeedback(null);
    setMovingWishId(item.wishId);
    startTransition(async () => {
      try {
        const res = await startReadingFromWishlistAction({ wishId: item.wishId });
        if (!res.ok) {
          setFeedback({ tone: "error", text: res.error });
          return;
        }
        setFeedback({
          tone: "ok",
          text: `“${item.title}” movido para sua estante e marcado em Na Cabeceira!`,
        });
        router.refresh();
      } finally {
        setMovingWishId(null);
      }
    });
  };

  return (
    <section
      aria-labelledby="explorar-desejos-heading"
      className="relative overflow-hidden rounded-[var(--rf-card-radius)] border border-[var(--rf-border-accent-soft)] bg-gradient-to-br from-[var(--rf-surface-contrast-hover)] via-[var(--rf-surface-contrast-elevated)] to-[var(--rf-surface-contrast)] p-6 text-[var(--rf-text-on-contrast)] shadow-[var(--rf-shadow-spotlight)] sm:p-8"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-[var(--rf-radius-full)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--rf-text-on-contrast-muted)]">
              <Sparkles
                className="h-3.5 w-3.5 text-[var(--rf-text-on-contrast-muted)]"
                aria-hidden="true"
              />
              Curadoria de Aquisições
            </span>
            <span className="rounded-[var(--rf-radius-full)] bg-[var(--rf-accent-primary)] px-2.5 py-0.5 font-sans text-[11px] font-bold tabular-nums text-[var(--rf-accent-on-primary)]">
              {items.length}{" "}
              {items.length === 1 ? "livro desejado" : "livros desejados"}
            </span>
          </div>

          <h2
            id="explorar-desejos-heading"
            className="font-serif text-2xl font-semibold text-[var(--rf-text-on-contrast)] sm:text-3xl"
          >
            Lista de Desejos
          </h2>

          <p className="font-sans text-sm leading-relaxed text-[var(--rf-text-on-contrast)] opacity-90">
            Organize suas próximas aquisições por prioridade, acompanhe preços-alvo e mova qualquer título diretamente para sua cabeceira com um clique.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/desejos"
              className={rfButtonClassName({
                variant: "primary",
                size: "lg",
                pill: true,
              })}
            >
              Abrir Lista de Desejos
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:min-w-[380px] lg:max-w-lg">
            {items.map((entry) => {
              const busy = isPending && movingWishId === entry.wishId;
              return (
                <article
                  key={entry.wishId}
                  className="group flex flex-col justify-between gap-3 rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] p-3.5 transition-colors hover:border-[var(--rf-border-accent)] hover:bg-[var(--rf-surface-contrast-elevated)]"
                >
                  <div className="flex items-center gap-3">
                    <BookCover
                      size="sm"
                      title={entry.title}
                      author={entry.author}
                      coverUrl={entry.coverUrl}
                      spineColor={entry.spineColor}
                      spineAccent={entry.spineAccent}
                      seed={entry.seed}
                      isWishlist
                      className="shrink-0"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <span className="inline-block font-sans text-[10px] font-semibold uppercase tracking-wider text-[var(--rf-text-on-contrast-muted)]">
                        Prioridade {entry.priority}/5
                      </span>
                      <h3 className="line-clamp-2 font-serif text-sm font-semibold text-[var(--rf-text-on-contrast)]">
                        {entry.title}
                      </h3>
                      <p className="truncate font-sans text-xs text-[var(--rf-text-on-contrast)] opacity-80">
                        {entry.author}
                        {typeof entry.targetPrice === "number"
                          ? ` · R$ ${entry.targetPrice.toFixed(2).replace(".", ",")}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleStartReading(entry)}
                    aria-label={`Começar a ler e mover ${entry.title} para Na Cabeceira`}
                    className={rfButtonClassName({
                      variant: "subtle",
                      tone: "dark",
                      size: "sm",
                      className: "w-full",
                    })}
                  >
                    {busy ? (
                      <>
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                        <span>Movendo...</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Começar a Ler · Cabeceira</span>
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[var(--rf-radius-lg)] border border-[var(--rf-border-accent-soft)] bg-[var(--rf-surface-contrast)] p-4 text-xs text-[var(--rf-text-on-contrast)] opacity-90">
            Sua lista de desejos está livre no momento. Explore gêneros ou cadastre títulos futuros.
          </div>
        )}
      </div>

      {feedback ? (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`mt-5 flex flex-wrap items-center justify-between gap-2 rounded-[var(--rf-radius-lg)] border px-4 py-3 font-sans text-xs font-semibold ${
            feedback.tone === "error"
              ? "border-[var(--rf-status-error)] bg-[var(--rf-status-error-bg)] text-[var(--rf-status-error)]"
              : "border-[var(--rf-status-success)] bg-[var(--rf-status-success-bg)] text-[var(--rf-status-success)]"
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.tone === "ok" ? (
            <Link
              href="/painel"
              className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rf-focus-ring-color)]"
            >
              Ver em Na Cabeceira ➔
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
