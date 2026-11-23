"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startReadingAction } from "@/features/reading/actions";
import { useIsDemoSession } from "@/components/DemoSessionContext";
import { DEMO_READONLY_ERROR } from "@/lib/auth-demo";
import { handleServerActionError } from "@/lib/server-action-error";
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
  const isDemoSession = useIsDemoSession();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setErrorMsg(null);
          if (isDemoSession) {
            setErrorMsg(DEMO_READONLY_ERROR);
            return;
          }
          startTransition(async () => {
            try {
              const res = await startReadingAction({
                workId,
                editionId,
                libraryItemId: itemId,
                format,
              });
              if (!res.ok) {
                setErrorMsg(res.error);
                return;
              }
              router.refresh();
            } catch (err) {
              const handled = handleServerActionError(
                err,
                "Não foi possível iniciar a leitura agora. Tente novamente."
              );
              setErrorMsg(handled.message);
            }
          });
        }}
        className="min-h-[44px] rounded-[8px] bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--accent-primary-hover)] disabled:opacity-60 lg:min-h-[40px]"
      >
        {isPending ? "Iniciando..." : label}
      </button>
      {errorMsg ? (
        <p
          role="alert"
          className="text-[11px] font-medium text-[var(--status-error)]"
        >
          {errorMsg}
        </p>
      ) : null}
    </div>
  );
}
