"use client";

import { useId, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { processCoverFile } from "@/features/catalog/cover-upload";

export type CoverSource = "auto" | "upload" | "none";

export function CoverUploader({
  title,
  author,
  coverUrl,
  source,
  canRestoreAuto,
  isResolving = false,
  restoreLabel = "Restaurar capa automática",
  onUpload,
  onRestoreAuto,
  onRemove,
  onUploadStart,
}: {
  title: string;
  author: string;
  /** Capa efetiva exibida no momento (automática, enviada ou vazia). */
  coverUrl: string;
  source: CoverSource;
  canRestoreAuto: boolean;
  isResolving?: boolean;
  restoreLabel?: string;
  onUpload: (dataUrl: string) => void;
  onRestoreAuto: () => void;
  onRemove: () => void;
  /** Avisado ao iniciar um upload (ex.: cancelar a busca automática em andamento). */
  onUploadStart?: () => void;
}) {
  const inputId = useId();
  const messageId = `${inputId}-message`;
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file || processing) return;
    onUploadStart?.();
    setProcessing(true);
    setFeedback(null);
    try {
      const result = await processCoverFile(file);
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.error });
        return;
      }
      onUpload(result.dataUrl);
      setFeedback({
        tone: "ok",
        text: "Capa enviada. A prévia foi atualizada.",
      });
    } catch {
      setFeedback({
        tone: "error",
        text: "Não foi possível ler ou converter esta imagem. Tente outro arquivo JPEG, PNG ou WebP.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const hasCover = Boolean(coverUrl);
  const busy = processing || isResolving;

  return (
    <div className="w-full space-y-2.5 sm:w-44">
      <div className="relative mx-auto w-fit">
        {/* A chave remonta a capa: BookCover guarda o estado de "imagem falhou". */}
        <BookCover
          key={coverUrl || "sem-capa"}
          title={title}
          author={author}
          coverUrl={coverUrl || undefined}
          size="lg"
        />
        {busy ? (
          <span
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[6px] bg-[#141514]/70 px-2 text-center text-[11px] font-semibold text-[#F4EFE6]"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {processing ? "Processando..." : "Buscando capa..."}
          </span>
        ) : null}
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            setDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={`relative rounded-[10px] border-2 border-dashed px-3 py-3 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent-primary)] ${
          dragging
            ? "border-[var(--accent-primary)] bg-[var(--bg-subtle)]"
            : "border-[var(--border-ui)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)]"
        }`}
      >
        <input
          id={inputId}
          type="file"
          accept="image/*"
          aria-label="Enviar capa do livro (galeria ou câmera)"
          aria-describedby={feedback ? messageId : undefined}
          disabled={processing}
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
        />
        <ImagePlus
          className="mx-auto h-5 w-5 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">
          Enviar capa
        </p>
        <p className="text-[11px] text-[var(--text-muted)]">
          Clique ou arraste. JPEG, PNG ou WebP.
        </p>
      </div>

      {feedback ? (
        <p
          id={messageId}
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`text-[11px] font-medium ${
            feedback.tone === "error"
              ? "text-[var(--status-error)]"
              : "text-[var(--status-ok)]"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {canRestoreAuto && source !== "auto" ? (
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              onRestoreAuto();
            }}
            className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {restoreLabel}
          </button>
        ) : null}
        {hasCover ? (
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              onRemove();
            }}
            className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-[8px] border border-[var(--border-ui)] bg-[var(--bg-elevated)] px-2.5 text-xs font-semibold text-[var(--status-error)] hover:bg-[var(--status-error-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remover capa
          </button>
        ) : null}
      </div>

      {!hasCover && !busy ? (
        <p className="text-center text-[11px] text-[var(--text-muted)]">
          Sem capa: o sistema usa a capa tipográfica.
        </p>
      ) : null}
    </div>
  );
}
