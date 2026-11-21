"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startReadingAction } from "@/features/reading/actions";
import type { BookFormat } from "@/lib/domain";

export function StartReadingButtonClient({
  workId,
  editionId,
  itemId,
  format,
  label = "Iniciar leitura",
}: {
  workId: string;
  editionId?: string;
  itemId?: string;
  format?: BookFormat;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await startReadingAction({
            workId,
            editionId,
            libraryItemId: itemId,
            format,
          });
          router.refresh();
        });
      }}
      className="min-h-[40px] rounded-[8px] bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60"
    >
      {isPending ? "Iniciando..." : label}
    </button>
  );
}
