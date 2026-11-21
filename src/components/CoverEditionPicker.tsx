"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ImagePlus,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { BookCover } from "@/components/BookCover";
import { COVER_UPLOAD_ACCEPTED_TYPES } from "@/features/catalog/cover-rules";
import { processCoverFile } from "@/features/catalog/cover-upload";
import {
  recordDevCoverDiagnostic,
  type CoverProviderSource,
  type CoverSearchCandidate,
  type CoverSearchDiagnostic,
} from "@/features/catalog/cover-search-rules";
import type { CoverSearchResponse } from "@/server/catalog/cover-search";

export interface CoverEditionPickerSelection {
  coverUrl: string | null;
  coverSource: CoverProviderSource | null;
  candidate?: CoverSearchCandidate;
  pageCount?: number;
}

export type CoverSelectionPayload = CoverEditionPickerSelection;

export interface CoverEditionPickerProps {
  title: string;
  author?: string;
  isbn?: string;
  seed?: string;
  selectedCoverUrl?: string | null;
  selectedCoverSource?: CoverProviderSource | null;
  spineColor?: string | null;
  spineAccent?: string | null;
  /** Candidatas pré-carregadas (ex.: vindas da varredura do BackfillCoversModal). */
  initialCandidates?: readonly CoverSearchCandidate[];
  /** Diagnóstico pré-carregado da varredura inicial. */
  initialDiagnostic?: CoverSearchDiagnostic | null;
  /** Indica se a busca inicial encontrou indisponibilidade temporária (429/403/timeout). */
  initialApiUnavailable?: boolean;
  /** Aviso pré-carregado da varredura inicial. */
  initialNotice?: string | null;
  /** Quando true, dispara a busca assim que o título tiver >= 2 caracteres. */
  autoSearch?: boolean;
  /** Rótulo do botão de confirmação principal (padrão: "Usar esta capa"). */
  confirmLabel?: string;
  /** Em fluxos de edição ("Trocar capa"), mostra estado de salvamento externo. */
  isSaving?: boolean;
  onApply: (selection: CoverEditionPickerSelection) => void;
}

const SOURCE_LABELS: Record<CoverProviderSource, string> = {
  brasilapi: "BrasilAPI",
  google: "Google Books",
  openlibrary: "Open Library",
  hardcover: "Hardcover",
  apple: "Apple Books",
  upload: "Upload manual",
};

export function CoverEditionPicker({
  title,
  author,
  isbn,
  seed,
  selectedCoverUrl,
  selectedCoverSource,
  spineColor,
  spineAccent,
  initialCandidates,
  initialDiagnostic,
  initialApiUnavailable,
  initialNotice,
  autoSearch = true,
  confirmLabel = "Usar esta capa",
  isSaving = false,
  onApply,
}: CoverEditionPickerProps) {
  const fileInputId = useId();
  const titleInputId = useId();
  const authorInputId = useId();
  const isbnInputId = useId();
  const pasteUrlInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSeed = seed || isbn || title || "readingflow-cover";

  // Campos editáveis de busca no modal (título, autor, ISBN), sincronizados com props enquanto não editados manualmente
  const [editedFields, setEditedFields] = useState<{
    baseKey: string;
    title?: string;
    author?: string;
    isbn?: string;
  }>({ baseKey: `${title}::${author ?? ""}::${isbn ?? ""}` });

  const currentBaseKey = `${title}::${author ?? ""}::${isbn ?? ""}`;
  const activeEdits =
    editedFields.baseKey === currentBaseKey
      ? editedFields
      : { baseKey: currentBaseKey };

  const searchTitle = activeEdits.title ?? title;
  const searchAuthor = activeEdits.author ?? author ?? "";
  const searchIsbn = activeEdits.isbn ?? isbn ?? "";

  const setSearchTitle = (next: string) =>
    setEditedFields((prev) => ({
      ...(prev.baseKey === currentBaseKey ? prev : { baseKey: currentBaseKey }),
      baseKey: currentBaseKey,
      title: next,
    }));
  const setSearchAuthor = (next: string) =>
    setEditedFields((prev) => ({
      ...(prev.baseKey === currentBaseKey ? prev : { baseKey: currentBaseKey }),
      baseKey: currentBaseKey,
      author: next,
    }));
  const setSearchIsbn = (next: string) =>
    setEditedFields((prev) => ({
      ...(prev.baseKey === currentBaseKey ? prev : { baseKey: currentBaseKey }),
      baseKey: currentBaseKey,
      isbn: next,
    }));

  const [candidates, setCandidates] = useState<CoverSearchCandidate[]>(() =>
    (initialCandidates ?? []).slice(0, 8)
  );
  const [resolvedPageCount, setResolvedPageCount] = useState<
    number | undefined
  >(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);
  const [apiUnavailable, setApiUnavailable] = useState(
    Boolean(initialApiUnavailable)
  );
  const [retryCount, setRetryCount] = useState(0);
  const [diagnostic, setDiagnostic] = useState<CoverSearchDiagnostic | null>(
    initialDiagnostic ?? null
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasSearchedOnce, setHasSearchedOnce] = useState(
    Boolean(initialCandidates !== undefined)
  );

  // Opção "Colar link da imagem"
  const [showPasteLink, setShowPasteLink] = useState(false);
  const [pastedImageUrl, setPastedImageUrl] = useState("");
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [pasteUrlError, setPasteUrlError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (opts?: {
      overrideTitle?: string;
      overrideAuthor?: string;
      overrideIsbn?: string;
      bypassCache?: boolean;
      attemptNumber?: number;
      signal?: AbortSignal;
    }) => {
      const cleanTitle = (opts?.overrideTitle ?? searchTitle).trim();
      const cleanAuthor = (opts?.overrideAuthor ?? searchAuthor).trim();
      const cleanIsbn = (opts?.overrideIsbn ?? searchIsbn).trim();

      if (cleanTitle.length < 2 && !cleanIsbn) {
        setCandidates([]);
        setNotice("Informe pelo menos o título ou o ISBN para buscar edições.");
        return;
      }

      setIsLoading(true);
      setNotice(null);
      setApiUnavailable(false);
      setUploadError(null);

      // Backoff leve quando o usuário clica em "Tentar de novo" após erro de API
      const attemptNum = opts?.attemptNumber ?? 0;
      if (attemptNum > 0) {
        const delayMs = Math.min(1200, 250 * Math.pow(1.6, attemptNum - 1));
        await new Promise((r) => setTimeout(r, delayMs));
      }

      const params = new URLSearchParams();
      if (cleanTitle) params.set("title", cleanTitle);
      if (cleanAuthor) params.set("author", cleanAuthor);
      if (cleanIsbn) params.set("isbn", cleanIsbn);
      if (opts?.bypassCache) params.set("nocache", "1");

      try {
        const res = await fetch(`/api/covers/search?${params.toString()}`, {
          signal: opts?.signal,
        });

        let payload: CoverSearchResponse | null = null;
        try {
          payload = (await res.json()) as CoverSearchResponse;
        } catch {
          payload = null;
        }
        if (opts?.signal?.aborted) return;

        if (!res.ok && !payload) {
          setCandidates([]);
          setApiUnavailable(true);
          setNotice(
            res.status === 401
              ? "Sessão expirada. Entre novamente para buscar capas."
              : "Serviço indisponível, tentar de novo."
          );
          setHasSearchedOnce(true);
          return;
        }

        const safePayload =
          payload ?? ({ candidates: [] } as unknown as CoverSearchResponse);
        const nextCandidates = (safePayload.candidates ?? []).slice(0, 8);
        setCandidates(nextCandidates);
        setResolvedPageCount(safePayload.pageCount);
        setNotice(
          safePayload.notice ??
            (!res.ok ? "Serviço indisponível, tentar de novo." : null)
        );
        setApiUnavailable(
          Boolean(
            safePayload.apiUnavailable ||
            !res.ok ||
            (safePayload.degraded && nextCandidates.length === 0)
          )
        );
        setDiagnostic(safePayload.diagnostic ?? null);
        setHasSearchedOnce(true);

        if (safePayload.diagnostic?.badgePtBr) {
          recordDevCoverDiagnostic(
            {
              editionId: effectiveSeed,
              title: cleanTitle || title,
              isbn: cleanIsbn || isbn,
            },
            safePayload.diagnostic.badgePtBr
          );
        }

        // "Usar esta capa" só habilita com uma candidata selecionada:
        // só mantém seleção se a candidata já selecionada continuar na lista
        setSelectedId((prev) =>
          prev && nextCandidates.some((c) => c.id === prev) ? prev : null
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCandidates([]);
        setApiUnavailable(true);
        setNotice("Serviço indisponível, tentar de novo.");
        setHasSearchedOnce(true);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTitle, searchAuthor, searchIsbn, effectiveSeed, title, isbn]
  );

  // Busca inicial automática quando título/autor/ISBN do livro mudam
  useEffect(() => {
    if (!autoSearch) return;
    const cleanTitle = title.trim();
    const cleanIsbn = isbn?.trim() ?? "";
    if (cleanTitle.length < 2 && !cleanIsbn) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void runSearch({
        overrideTitle: cleanTitle,
        overrideAuthor: author ?? "",
        overrideIsbn: cleanIsbn,
        signal: controller.signal,
      });
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Dispara apenas na mudança das props originais do livro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, author, isbn, autoSearch]);

  const selectedCandidate = candidates.find((c) => c.id === selectedId) ?? null;

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const result = await processCoverFile(file);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      onApply({
        coverUrl: result.dataUrl,
        coverSource: "upload",
      });
    } catch {
      setUploadError(
        "Não foi possível processar esta imagem. Verifique se o arquivo é um JPEG, PNG ou WebP válido."
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImportFromUrl = async () => {
    const cleanUrl = pastedImageUrl.trim();
    if (!cleanUrl) {
      setPasteUrlError("Cole o endereço HTTPS da imagem da capa.");
      return;
    }

    setPasteUrlError(null);
    setIsImportingUrl(true);
    try {
      const res = await fetch("/api/covers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: cleanUrl,
          editionId: seed,
        }),
      });
      const payload = (await res.json()) as
        | {
            ok: true;
            dataUrl: string;
            bucketPath: string;
            width: number;
            height: number;
          }
        | { ok: false; error?: string };

      if (!res.ok || !payload.ok) {
        setPasteUrlError(
          (!payload.ok && payload.error) ||
            "Não foi possível baixar ou validar a imagem deste link."
        );
        return;
      }

      setPastedImageUrl("");
      setShowPasteLink(false);
      onApply({
        coverUrl: payload.dataUrl,
        coverSource: "upload",
      });
    } catch {
      setPasteUrlError(
        "Falha de conexão ao tentar baixar a imagem. Verifique o link e tente novamente."
      );
    } finally {
      setIsImportingUrl(false);
    }
  };

  const devBadgeText = diagnostic?.badgePtBr || diagnostic?.reasonPtBr || null;
  const isBusy = isLoading || isUploading || isImportingUrl || isSaving;

  return (
    <div className="space-y-4 rounded-[12px] border border-[#8C7A63]/35 bg-[#FAF7F1] p-4 shadow-xs">
      {/* Cabeçalho + Pré-visualização atual */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-1.5 sm:items-start">
          <BookCover
            title={searchTitle || title || "Título do livro"}
            author={searchAuthor || author}
            coverUrl={selectedCandidate?.coverUrl ?? selectedCoverUrl ?? null}
            spineColor={spineColor}
            spineAccent={spineAccent}
            seed={seed || title}
            diagnosticReason={devBadgeText}
            size="md"
          />
          {selectedCoverUrl ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#C8A46E]/55 bg-[#F4EFE6] px-2 py-0.5 text-[10px] font-semibold text-[#5C4321]">
              <Check className="h-3 w-3 text-[#2D6A4F]" aria-hidden="true" />
              {selectedCoverSource
                ? SOURCE_LABELS[selectedCoverSource]
                : "Capa ativa"}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-[#5A5045]">
              Fallback editorial ativo
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold tracking-[0.14em] text-[#722F3E] uppercase">
                Seletor de edição · Capas oficiais
              </p>
              <h3 className="font-serif text-base font-semibold text-[#1A1614]">
                Escolha a capa correta da sua edição
              </h3>
            </div>

            {process.env.NODE_ENV !== "production" && devBadgeText ? (
              <span
                data-testid="cover-picker-dev-badge"
                className="rounded border border-[#C8A46E]/50 bg-[#141514] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#DFBE88]"
              >
                dev: {devBadgeText}
              </span>
            ) : null}
          </div>

          {/* Campos editáveis de busca no modal (título, autor, ISBN) + "Buscar edições" */}
          <div
            role="search"
            aria-label="Editar termos de busca de capa"
            className="grid gap-2.5 rounded-[10px] border border-[#8C7A63]/28 bg-[#F4EFE6]/85 p-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-5">
              <label
                htmlFor={titleInputId}
                className="block text-[11px] font-semibold tracking-wider text-[#3E352E] uppercase"
              >
                Título
              </label>
              <input
                id={titleInputId}
                type="text"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch({ bypassCache: true });
                  }
                }}
                placeholder="Ex.: As 48 Leis do Poder"
                className="mt-1 min-h-[36px] w-full rounded-[6px] border border-[#8C7A63]/45 bg-[#FAF7F1] px-2.5 text-[13px] text-[#1A1614] focus:border-[#722F3E] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor={authorInputId}
                className="block text-[11px] font-semibold tracking-wider text-[#3E352E] uppercase"
              >
                Autor
              </label>
              <input
                id={authorInputId}
                type="text"
                value={searchAuthor}
                onChange={(e) => setSearchAuthor(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch({ bypassCache: true });
                  }
                }}
                placeholder="Ex.: Robert Greene"
                className="mt-1 min-h-[36px] w-full rounded-[6px] border border-[#8C7A63]/45 bg-[#FAF7F1] px-2.5 text-[13px] text-[#1A1614] focus:border-[#722F3E] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor={isbnInputId}
                className="block text-[11px] font-semibold tracking-wider text-[#3E352E] uppercase"
              >
                ISBN
              </label>
              <input
                id={isbnInputId}
                type="text"
                value={searchIsbn}
                onChange={(e) => setSearchIsbn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch({ bypassCache: true });
                  }
                }}
                placeholder="Opcional"
                className="mt-1 min-h-[36px] w-full rounded-[6px] border border-[#8C7A63]/45 bg-[#FAF7F1] px-2.5 text-[13px] text-[#1A1614] focus:border-[#722F3E] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 sm:col-span-12">
              <p className="text-[11px] text-[#5A5045]">
                Edite o título (ou tente o título original), sobrenome do autor
                ou ISBN e clique em <strong>Buscar edições</strong>.
              </p>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => void runSearch({ bypassCache: true })}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[8px] border border-[#722F3E] bg-[#722F3E] px-3.5 text-xs font-semibold text-[#FAF7F1] transition-colors hover:bg-[#5B2330] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Buscar edições
              </button>
            </div>
          </div>

          {/* Alerta explícito quando 429/403/timeout (NUNCA tratado como "sem capa") */}
          {apiUnavailable ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#B45309]/45 bg-[#FEF3C7] px-3 py-2 text-xs font-medium text-[#78350F]"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-[#B45309]"
                  aria-hidden="true"
                />
                <span>{notice || "Serviço indisponível, tentar de novo."}</span>
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  const nextRetry = retryCount + 1;
                  setRetryCount(nextRetry);
                  void runSearch({
                    bypassCache: true,
                    attemptNumber: nextRetry,
                  });
                }}
                className="inline-flex min-h-[30px] items-center gap-1.5 rounded-[6px] border border-[#78350F]/40 bg-[#FAF7F1] px-2.5 py-1 text-[11px] font-semibold text-[#78350F] hover:bg-[#FDE68A]"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Tentar de novo
              </button>
            </div>
          ) : notice ? (
            <p
              role="status"
              className="rounded-[8px] border border-[#C8A46E]/55 bg-[#F4EFE6] px-3 py-2 text-xs font-medium text-[#5C4321]"
            >
              {notice}
            </p>
          ) : null}

          {/* Grade de até 8 candidatas (incluindo baixa pontuação com "Correspondência incerta") */}
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-[#5A5045]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Consultando BrasilAPI, Google Books, Open Library e Hardcover...
            </div>
          ) : candidates.length > 0 ? (
            <div
              role="radiogroup"
              aria-label="Edições encontradas com capa"
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
            >
              {candidates.slice(0, 8).map((cand) => {
                const isPicked = cand.id === selectedId;
                const isUncertain = Boolean(cand.uncertainMatch);
                return (
                  <button
                    key={cand.id}
                    type="button"
                    role="radio"
                    aria-checked={isPicked}
                    onClick={() =>
                      setSelectedId((prev) =>
                        prev === cand.id ? null : cand.id
                      )
                    }
                    className={`group relative flex flex-col items-center rounded-[10px] border p-2 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#C8A46E] focus-visible:outline-none ${
                      isPicked
                        ? "border-[#722F3E] bg-[#F3ECE0] ring-2 ring-[#722F3E]/30"
                        : "border-[#8C7A63]/30 bg-[#FAF7F1] hover:border-[#8C7A63]"
                    }`}
                  >
                    <BookCover
                      title={cand.title}
                      author={cand.authors[0] ?? searchAuthor}
                      coverUrl={cand.coverUrl}
                      spineColor={spineColor}
                      spineAccent={spineAccent}
                      seed={cand.id}
                      size="sm"
                    />
                    <div className="mt-2 w-full min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="truncate rounded bg-[#141514]/8 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#4A4139] uppercase">
                          {SOURCE_LABELS[cand.source]}
                        </span>
                        {isPicked ? (
                          <Check
                            className="h-3.5 w-3.5 shrink-0 text-[#722F3E]"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>

                      {isUncertain ? (
                        <span className="mt-1 inline-block rounded border border-[#B45309]/40 bg-[#FEF3C7] px-1.5 py-0.5 text-[9px] font-semibold text-[#92400E]">
                          Correspondência incerta
                        </span>
                      ) : null}

                      <p
                        title={cand.title}
                        className="mt-1 truncate text-[11px] font-semibold text-[#1A1614]"
                      >
                        {cand.title}
                      </p>
                      <p className="truncate text-[10px] text-[#5A5045]">
                        {cand.authors[0] ??
                          ([cand.publisher, cand.publishedYear]
                            .filter(Boolean)
                            .join(" · ") ||
                            (cand.isbn ? `ISBN ${cand.isbn}` : "Edição"))}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : hasSearchedOnce && !apiUnavailable ? (
            <p className="rounded-[8px] border border-dashed border-[#8C7A63]/40 bg-[#F4EFE6]/70 px-3 py-2.5 text-xs text-[#4A4139]">
              Nenhuma capa oficial encontrada com estes termos. Ajuste o título
              ou autor acima e clique em <strong>Buscar edições</strong>, cole o
              link direto da imagem ou envie um arquivo do seu dispositivo.
            </p>
          ) : null}

          {/* Painel expansível: "Colar link da imagem" (SSRF-safe + sharp no servidor) */}
          {showPasteLink ? (
            <div className="space-y-2 rounded-[10px] border border-[#C8A46E]/60 bg-[#F4EFE6] p-3">
              <label
                htmlFor={pasteUrlInputId}
                className="block text-xs font-semibold text-[#1A1614]"
              >
                Colar link HTTPS direto da imagem da capa (JPEG, PNG ou WebP,
                máx. 5 MB)
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={pasteUrlInputId}
                  type="url"
                  value={pastedImageUrl}
                  onChange={(e) => {
                    setPastedImageUrl(e.target.value);
                    setPasteUrlError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleImportFromUrl();
                    }
                  }}
                  placeholder="https://exemplo.com/capa-do-livro.jpg"
                  className="min-h-[38px] flex-1 rounded-[8px] border border-[#8C7A63]/50 bg-[#FAF7F1] px-3 text-xs text-[#1A1614] focus:border-[#722F3E] focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isImportingUrl || !pastedImageUrl.trim()}
                    onClick={() => void handleImportFromUrl()}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] bg-[#722F3E] px-3.5 text-xs font-semibold text-[#FAF7F1] transition-colors hover:bg-[#5B2330] disabled:opacity-50"
                  >
                    {isImportingUrl ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {isImportingUrl ? "Baixando..." : "Baixar e salvar capa"}
                  </button>
                  <button
                    type="button"
                    disabled={isImportingUrl}
                    onClick={() => {
                      setShowPasteLink(false);
                      setPasteUrlError(null);
                    }}
                    className="min-h-[38px] rounded-[8px] border border-[#8C7A63]/40 bg-[#FAF7F1] px-3 text-xs font-semibold text-[#4A4139] hover:bg-[#EFE9DD]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#5A5045]">
                O servidor baixa a imagem via HTTPS com verificação de segurança
                (SSRF), otimiza com <code>sharp</code> e salva no seu acervo.
              </p>
              {pasteUrlError ? (
                <p
                  role="alert"
                  className="text-xs font-semibold text-[#9E2A2B]"
                >
                  {pasteUrlError}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Barra de ações: "Usar esta capa" (só habilita com uma selecionada), "Colar link da imagem", "Enviar capa manual" */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={!selectedCandidate || isBusy}
              onClick={() => {
                if (!selectedCandidate) return;
                onApply({
                  coverUrl: selectedCandidate.coverUrl,
                  coverSource: selectedCandidate.source,
                  candidate: selectedCandidate,
                  pageCount: selectedCandidate.pageCount ?? resolvedPageCount,
                });
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] bg-[#722F3E] px-3.5 text-xs font-semibold text-[#FAF7F1] shadow-xs transition-colors hover:bg-[#5B2330] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {isSaving ? "Salvando..." : confirmLabel}
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setShowPasteLink((prev) => !prev);
                setPasteUrlError(null);
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[#8C7A63]/45 bg-[#F4EFE6] px-3 text-xs font-semibold text-[#2A241F] transition-colors hover:border-[#722F3E] hover:bg-[#EFE9DD] disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              Colar link da imagem
            </button>

            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept={COVER_UPLOAD_ACCEPTED_TYPES.join(",")}
              disabled={isBusy}
              onChange={(e) => void handleFileChange(e.target.files?.[0])}
              className="sr-only"
            />
            <label
              htmlFor={fileInputId}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#8C7A63]/45 bg-[#F4EFE6] px-3 text-xs font-semibold text-[#2A241F] transition-colors hover:border-[#722F3E] hover:bg-[#EFE9DD] ${
                isBusy ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              {isUploading ? "Processando..." : "Enviar capa manual"}
            </label>

            {selectedCoverUrl ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() =>
                  onApply({
                    coverUrl: null,
                    coverSource: null,
                  })
                }
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[#8C7A63]/35 bg-transparent px-3 text-xs font-semibold text-[#5A5045] transition-colors hover:border-[#9E2A2B] hover:text-[#9E2A2B] disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Usar capa tipográfica
              </button>
            ) : null}
          </div>

          {uploadError ? (
            <p role="alert" className="text-xs font-semibold text-[#9E2A2B]">
              {uploadError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
