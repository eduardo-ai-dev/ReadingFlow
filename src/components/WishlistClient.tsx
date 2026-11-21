"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BookFormat } from "@/lib/domain";
import type { EnrichedWishEntry } from "@/features/wishlist/queries";
import {
  addWishlistItemAction,
  dropWishlistItemAction,
  purchaseWishlistItemAction,
} from "@/features/wishlist/actions";
import { BookCover } from "@/components/BookCover";
import { FormatBadge } from "@/components/StatusBadge";

export function WishlistClient({
  wanted,
  purchased,
}: {
  wanted: EnrichedWishEntry[];
  purchased: EnrichedWishEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // Add wish form state
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [format, setFormat] = useState<BookFormat>("paperback");
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [targetPrice, setTargetPrice] = useState("");
  const [whereToBuy, setWhereToBuy] = useState("");

  // Atomic purchase drawer per wish
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [buyFormat, setBuyFormat] = useState<BookFormat>("paperback");
  const [buyPrice, setBuyPrice] = useState("");
  const [buyStore, setBuyStore] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-muted)]">
          {wanted.length}{" "}
          {wanted.length === 1 ? "livro desejado" : "livros desejados"}
        </p>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="min-h-[44px] rounded-[8px] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
        >
          {showAdd ? "Fechar formulário" : "+ Novo desejo"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[8px] border border-[var(--status-error)] bg-[var(--status-error-bg)] p-3 text-xs font-medium text-[var(--status-error)]"
        >
          {error}
        </div>
      ) : null}

      {showAdd ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (submittingRef.current) return;
            setError(null);

            const cleanTitle = title.trim();
            if (!cleanTitle) {
              setError("Informe o título do livro desejado.");
              return;
            }
            if (cleanTitle.length > 300) {
              setError("O título pode ter no máximo 300 caracteres.");
              return;
            }

            const cleanAuthor = author.trim();
            if (!cleanAuthor) {
              setError("Informe o(a) autor(a) principal.");
              return;
            }
            if (cleanAuthor.length > 200) {
              setError("O nome do autor pode ter no máximo 200 caracteres.");
              return;
            }

            const trimmedPrice = targetPrice.trim();
            let parsedPrice: number | undefined;
            if (trimmedPrice) {
              if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmedPrice)) {
                setError(
                  "Informe um preço-alvo válido (ex.: 39,90) entre R$ 0,00 e R$ 100.000,00."
                );
                return;
              }
              const val = Number.parseFloat(trimmedPrice.replace(",", "."));
              if (!Number.isFinite(val) || val < 0 || val > 100000) {
                setError(
                  "Informe um preço alvo válido entre R$ 0,00 e R$ 100.000,00."
                );
                return;
              }
              parsedPrice = val;
            }

            submittingRef.current = true;
            startTransition(async () => {
              try {
                const res = await addWishlistItemAction({
                  title: cleanTitle,
                  primaryAuthor: cleanAuthor,
                  format,
                  priority,
                  targetPrice: parsedPrice,
                  whereToBuy: whereToBuy.trim() || undefined,
                });
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setTitle("");
                setAuthor("");
                setTargetPrice("");
                setWhereToBuy("");
                setShowAdd(false);
                router.refresh();
              } catch {
                setError(
                  "Não foi possível salvar o desejo agora. Tente novamente."
                );
              } finally {
                submittingRef.current = false;
              }
            });
          }}
          className="space-y-4 rounded-[12px] border border-[var(--border-ui)] bg-[var(--bg-surface)] p-5"
        >
          <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
            Adicionar à Lista de Desejos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="wish-title"
                className="block text-xs font-semibold"
              >
                Título *
              </label>
              <input
                id="wish-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="wish-author"
                className="block text-xs font-semibold"
              >
                Autor(a) *
              </label>
              <input
                id="wish-author"
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="wish-format"
                className="block text-xs font-semibold"
              >
                Formato pretendido
              </label>
              <select
                id="wish-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as BookFormat)}
                className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
              >
                <option value="paperback">Brochura</option>
                <option value="hardcover">Capa dura</option>
                <option value="ebook">E-book</option>
                <option value="audiobook">Audiobook</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="wish-priority"
                className="block text-xs font-semibold"
              >
                Prioridade (1 a 5)
              </label>
              <select
                id="wish-priority"
                value={priority}
                onChange={(e) =>
                  setPriority(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                }
                className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
              >
                <option value={5}>5 — Prioridade máxima</option>
                <option value={4}>4 — Alta</option>
                <option value={3}>3 — Média</option>
                <option value={2}>2 — Baixa</option>
                <option value={1}>1 — Quando surgir promoção</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="wish-price"
                className="block text-xs font-semibold"
              >
                Preço-alvo (R$)
              </label>
              <input
                id="wish-price"
                type="text"
                inputMode="decimal"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Ex.: 39,90"
                className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="wish-store"
                className="block text-xs font-semibold"
              >
                Onde comprar
              </label>
              <input
                id="wish-store"
                type="text"
                value={whereToBuy}
                onChange={(e) => setWhereToBuy(e.target.value)}
                placeholder="Ex.: Sebo, Livraria..."
                className="mt-1 min-h-[42px] w-full rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-[44px] rounded-[8px] bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--on-primary)]"
          >
            Salvar desejo
          </button>
        </form>
      ) : null}

      <div className="space-y-4">
        {wanted.map((entry) => {
          const isBuying = purchasingId === entry.wish.id;
          return (
            <article
              key={entry.wish.id}
              className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-4">
                  <BookCover
                    title={entry.work.title}
                    author={entry.primaryAuthor}
                    coverUrl={entry.edition?.coverUrl}
                    spineColor={entry.edition?.coverColor}
                    spineAccent={entry.edition?.coverAccentColor}
                    seed={entry.edition?.isbn13 ?? entry.work.id}
                    isWishlist
                    size="md"
                  />
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-2.5 py-0.5 text-xs font-semibold">
                        Prioridade {entry.wish.priority}/5
                      </span>
                      {entry.edition ? (
                        <FormatBadge format={entry.edition.format} />
                      ) : null}
                      {entry.overlap.ownsWork ? (
                        <span className="rounded-full border border-[var(--status-warn)] bg-[var(--status-warn-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--status-warn)]">
                          Você já possui edição desta obra
                        </span>
                      ) : null}
                    </div>

                    <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
                      <Link
                        href={`/livros/${entry.work.id}`}
                        className="hover:underline"
                      >
                        {entry.work.title}
                      </Link>
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      {entry.primaryAuthor}
                      {entry.wish.whereToBuy
                        ? ` · ${entry.wish.whereToBuy}`
                        : ""}
                    </p>
                    {entry.wish.targetPrice !== undefined ? (
                      <p className="text-xs font-semibold text-[var(--accent-text)]">
                        Preço estimado: R${" "}
                        {entry.wish.targetPrice.toFixed(2).replace(".", ",")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPurchasingId(isBuying ? null : entry.wish.id);
                      setBuyFormat(entry.edition?.format ?? "paperback");
                      setBuyPrice(
                        entry.wish.targetPrice
                          ? String(entry.wish.targetPrice)
                          : ""
                      );
                      setBuyStore(entry.wish.whereToBuy ?? "");
                    }}
                    className="min-h-[42px] rounded-[8px] bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
                  >
                    Comprei · Mover p/ Estante
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        try {
                          const res = await dropWishlistItemAction({
                            wishId: entry.wish.id,
                          });
                          if (!res.ok) {
                            setError(res.error);
                            return;
                          }
                          router.refresh();
                        } catch {
                          setError(
                            "Não foi possível arquivar o desejo agora. Tente novamente."
                          );
                        }
                      });
                    }}
                    className="min-h-[42px] rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-3.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Arquivar
                  </button>
                </div>
              </div>

              {isBuying ? (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (submittingRef.current) return;
                    setError(null);
                    const trimmedBuyPrice = buyPrice.trim();
                    let validBuyPrice: number | undefined;
                    if (trimmedBuyPrice) {
                      if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmedBuyPrice)) {
                        setError(
                          "Informe um valor pago válido (ex.: 49,90) entre R$ 0,00 e R$ 100.000,00."
                        );
                        return;
                      }
                      const parsed = Number.parseFloat(
                        trimmedBuyPrice.replace(",", ".")
                      );
                      if (
                        !Number.isFinite(parsed) ||
                        parsed < 0 ||
                        parsed > 100000
                      ) {
                        setError(
                          "O valor pago deve estar entre R$ 0,00 e R$ 100.000,00."
                        );
                        return;
                      }
                      validBuyPrice = parsed;
                    }

                    submittingRef.current = true;
                    startTransition(async () => {
                      try {
                        const res = await purchaseWishlistItemAction({
                          wishId: entry.wish.id,
                          format: buyFormat,
                          pricePaid: validBuyPrice,
                          store: buyStore.trim() || undefined,
                        });
                        if (!res.ok) {
                          setError(res.error);
                          return;
                        }
                        setPurchasingId(null);
                        router.refresh();
                      } catch {
                        setError(
                          "Não foi possível confirmar a compra agora. Tente novamente."
                        );
                      } finally {
                        submittingRef.current = false;
                      }
                    });
                  }}
                  className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-4"
                >
                  <div>
                    <label
                      htmlFor={`buy-fmt-${entry.wish.id}`}
                      className="block text-xs font-semibold"
                    >
                      Formato comprado
                    </label>
                    <select
                      id={`buy-fmt-${entry.wish.id}`}
                      value={buyFormat}
                      onChange={(e) =>
                        setBuyFormat(e.target.value as BookFormat)
                      }
                      className="mt-1 min-h-[40px] w-full rounded-[6px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-2.5 text-xs"
                    >
                      <option value="paperback">Brochura (Est. Física)</option>
                      <option value="hardcover">Capa dura (Est. Física)</option>
                      <option value="ebook">E-book (Est. Digital)</option>
                      <option value="audiobook">Audiobook (Est. Áudio)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`buy-price-${entry.wish.id}`}
                      className="block text-xs font-semibold"
                    >
                      Valor pago (R$)
                    </label>
                    <input
                      id={`buy-price-${entry.wish.id}`}
                      type="text"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      className="mt-1 min-h-[40px] w-full rounded-[6px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-2.5 text-xs"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`buy-store-${entry.wish.id}`}
                      className="block text-xs font-semibold"
                    >
                      Loja
                    </label>
                    <input
                      id={`buy-store-${entry.wish.id}`}
                      type="text"
                      value={buyStore}
                      onChange={(e) => setBuyStore(e.target.value)}
                      className="mt-1 min-h-[40px] w-full rounded-[6px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-2.5 text-xs"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="min-h-[40px] w-full rounded-[6px] bg-[var(--accent-primary)] px-3 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)]"
                    >
                      Confirmar entrada na estante
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>

      {purchased.length > 0 ? (
        <section className="space-y-2 border-t border-[var(--border-subtle)] pt-6">
          <h2 className="font-serif text-lg font-semibold text-[var(--text-heading)]">
            Desejos já adquiridos ({purchased.length})
          </h2>
          <ul className="space-y-2 text-xs">
            {purchased.map((p) => (
              <li
                key={p.wish.id}
                className="flex items-center justify-between rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2.5"
              >
                <span className="font-medium text-[var(--text-primary)]">
                  {p.work.title} — {p.primaryAuthor}
                </span>
                <Link
                  href={`/livros/${p.work.id}`}
                  className="font-semibold text-[var(--accent-text)] underline"
                >
                  Ver na estante
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
