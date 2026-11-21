"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  VolumeX,
  BookOpen,
  Check,
  ArrowLeft,
  Sparkles,
  Target,
  Clock,
  AlertCircle,
} from "lucide-react";
import { updateReadingProgressAction } from "@/features/reading/actions";
import { formatFocusSessionSummaryPtBr } from "@/features/reading/rules";
import { BookCover } from "@/components/BookCover";
import type { ReadingStatus } from "@/lib/domain";

export interface ActiveBookItem {
  readingId: string;
  title: string;
  author: string;
  coverUrl?: string;
  spineColor?: string;
  spineAccent?: string;
  seed?: string;
  readingStatus?: ReadingStatus;
  progressValue: number;
  progressTotal?: number;
  progressUnit: "pages" | "percent" | "seconds";
  progressPercent: number;
}

type FocusMode = "free" | "pomodoro" | "target_50";
type QuickRegisterMode = "delta" | "current_page";

const POMODORO_SECONDS = 25 * 60;
const SESSION_TARGET_PAGES = 50;

export function FocusReadingSessionClient({
  activeBooks,
  initialReadingId,
}: {
  activeBooks: ActiveBookItem[];
  initialReadingId?: string;
}) {
  const router = useRouter();
  const resolvedInitialId =
    initialReadingId && activeBooks.some((b) => b.readingId === initialReadingId)
      ? initialReadingId
      : (activeBooks[0]?.readingId ?? "");

  const [progressOverrides, setProgressOverrides] = useState<
    Record<string, { progressValue: number; progressPercent: number }>
  >({});
  const [selectedBookId, setSelectedBookId] = useState<string>(resolvedInitialId);
  const [focusMode, setFocusMode] = useState<FocusMode>("free");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [pomodoroDone, setPomodoroDone] = useState(false);
  const [quickRegisterMode, setQuickRegisterMode] =
    useState<QuickRegisterMode>("delta");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");
  const [rawSessionInput, setRawSessionInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const quickInputRef = useRef<HTMLInputElement | null>(null);

  const booksState = activeBooks.map((item) => {
    const override = progressOverrides[item.readingId];
    return override
      ? {
          ...item,
          progressValue: override.progressValue,
          progressPercent: override.progressPercent,
        }
      : item;
  });

  const selectedBook = booksState.find((b) => b.readingId === selectedBookId);

  // Auto-focus no campo numérico sempre que o card rápido abrir após Pausar/Encerrar Sessão
  useEffect(() => {
    if (showQuickRegister) {
      const id = window.requestAnimationFrame(() => {
        quickInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [showQuickRegister, quickRegisterMode]);

  // Timer loop
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (focusMode === "pomodoro" && next >= POMODORO_SECONDS) {
          setIsRunning(false);
          setPomodoroDone(true);
          setShowQuickRegister(true);
          return POMODORO_SECONDS;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, focusMode]);

  // Alerta sonoro suave ao concluir um ciclo Pomodoro de 25 minutos
  useEffect(() => {
    if (!pomodoroDone) return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(528, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.85);
      osc.onended = () => {
        void ctx.close();
      };
    } catch {
      // Silencioso caso Web Audio esteja indisponível
    }
  }, [pomodoroDone]);

  // Ambient sound generator via Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (soundEnabled) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0,
          b1 = 0,
          b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          data[i] = (b0 + b1 + b2) * 0.04;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 450;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNodeRef.current = gain;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } catch {
        // Fallback gracefully if Web Audio is unsupported
      }
    } else if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [soundEnabled]);

  const displayedTimerSeconds =
    focusMode === "pomodoro"
      ? Math.max(0, POMODORO_SECONDS - elapsedSeconds)
      : elapsedSeconds;

  const pomodoroProgressPercent =
    focusMode === "pomodoro"
      ? Math.min(100, Math.round((elapsedSeconds / POMODORO_SECONDS) * 100))
      : 0;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectMode = (nextMode: FocusMode) => {
    setFocusMode(nextMode);
    setIsRunning(false);
    setElapsedSeconds(0);
    setHasStarted(false);
    setShowQuickRegister(false);
    setPomodoroDone(false);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleTogglePlayPause = () => {
    if (isRunning) {
      // Pausar abre imediatamente o card central de registro rápido
      setIsRunning(false);
      setShowQuickRegister(true);
      setSaveError(null);
      return;
    }
    if (focusMode === "pomodoro" && elapsedSeconds >= POMODORO_SECONDS) {
      setElapsedSeconds(0);
    }
    setHasStarted(true);
    setPomodoroDone(false);
    setShowQuickRegister(false);
    setSaveSuccess(false);
    setSaveError(null);
    setIsRunning(true);
  };

  const handleStopSession = () => {
    setIsRunning(false);
    setHasStarted(true);
    setShowQuickRegister(true);
    setSaveError(null);
  };

  const handleResetSession = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setHasStarted(false);
    setShowQuickRegister(false);
    setPomodoroDone(false);
    setRawSessionInput("");
    setSaveSuccess(false);
    setSaveError(null);
  };

  const numericInput = Math.max(0, Number.parseInt(rawSessionInput, 10) || 0);
  const previousBookValue = selectedBook
    ? selectedBook.progressUnit === "seconds"
      ? Math.round(selectedBook.progressValue / 60)
      : selectedBook.progressValue
    : 0;

  const pagesReadThisSession =
    quickRegisterMode === "current_page"
      ? Math.max(0, numericInput - previousBookValue)
      : numericInput;

  const handleSaveProgress = async () => {
    if (!selectedBook || pagesReadThisSession <= 0) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const nextRawValue =
        selectedBook.progressUnit === "seconds"
          ? (previousBookValue + pagesReadThisSession) * 60
          : previousBookValue + pagesReadThisSession;

      const clampedValue = selectedBook.progressTotal
        ? Math.min(selectedBook.progressTotal, nextRawValue)
        : nextRawValue;

      const res = await updateReadingProgressAction({
        readingId: selectedBook.readingId,
        progressUnit: selectedBook.progressUnit,
        progressValue: clampedValue,
        progressTotal: selectedBook.progressTotal,
      });

      if (!res.ok) {
        setSaveError(res.error);
        return;
      }

      const nextPercent =
        selectedBook.progressTotal && selectedBook.progressTotal > 0
          ? Math.min(
              100,
              Math.round((clampedValue / selectedBook.progressTotal) * 100)
            )
          : selectedBook.progressPercent;

      setProgressOverrides((prev) => ({
        ...prev,
        [selectedBook.readingId]: {
          progressValue: clampedValue,
          progressPercent: nextPercent,
        },
      }));
      setSaveSuccess(true);
      router.refresh();
    } catch {
      setSaveError("Não foi possível registrar o avanço agora. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const sessionSummaryText = selectedBook
    ? formatFocusSessionSummaryPtBr({
        amount: pagesReadThisSession,
        unit: selectedBook.progressUnit,
        elapsedSeconds,
      })
    : "";

  const progressInputLabel =
    quickRegisterMode === "current_page"
      ? selectedBook?.progressUnit === "seconds"
        ? "Minuto atual onde parou"
        : selectedBook?.progressUnit === "percent"
          ? "Porcentagem atual (%)"
          : "Página atual onde parou"
      : selectedBook?.progressUnit === "seconds"
        ? "Minutos ouvidos nesta sessão"
        : selectedBook?.progressUnit === "percent"
          ? "Porcentagem lida nesta sessão"
          : "Páginas Lidas nesta sessão";

  const ringRadius = 112;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgressRatio =
    focusMode === "pomodoro"
      ? Math.min(1, elapsedSeconds / POMODORO_SECONDS)
      : Math.min(1, (elapsedSeconds % 3600) / 3600);
  const ringStrokeDashoffset = ringCircumference * (1 - ringProgressRatio);

  return (
    <div className="space-y-6">
      {/* Cabeçalho editorial da tela com marcador de seção */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#8C7A63]/22 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rf-section-marker">04 · Canto de Foco</span>
            <Link
              href="/leitura"
              className="inline-flex items-center gap-1.5 rounded-sm font-sans text-xs font-semibold text-[#722F3E] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4A77D]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar para Leitura
            </Link>
          </div>
          <h1 className="rf-title-h1 text-2xl sm:text-3xl text-[#2C221E] dark:text-[#F4EFE6]">
            Sessão de Leitura
          </h1>
        </div>

        <p className="font-serif text-xs italic text-[#5B4D44] sm:text-sm">
          Sem distrações, sem pressa. Apenas você e as páginas.
        </p>
      </header>

      {/* Grid 12 colunas: Cronômetro central (order-first no mobile) + painéis auxiliares translúcidos nas laterais */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12 lg:items-start">
        {/* CENTRO (6 cols desktop · order-first no mobile): HIERARQUIA ABSOLUTA NO CRONÔMETRO */}
        <section
          aria-label="Cronômetro de leitura"
          className="order-first rounded-2xl border border-[#C4A77D]/30 bg-[#FAF7F1]/88 p-6 text-center shadow-[0_8px_32px_-16px_rgba(44,34,30,0.14)] backdrop-blur-md sm:p-8 lg:order-2 lg:col-span-6"
        >
          {/* Seletor de Modo (Livre / Pomodoro / Meta 50 págs) */}
          <div className="flex flex-col items-center gap-2.5">
            <div
              role="group"
              aria-label="Atalhos rápidos de modo de leitura"
              className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-[#8C7A63]/22 bg-[#EFE9DD] p-1"
            >
              {(
                [
                  { id: "free", label: "Modo Livre", icon: Clock },
                  { id: "pomodoro", label: "Pomodoro 25m", icon: TimerIconShim },
                  { id: "target_50", label: "Meta 50 págs", icon: Target },
                ] as const
              ).map((item) => {
                const active = focusMode === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectMode(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-sans text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4A77D] ${
                      active
                        ? "bg-[#722F3E] text-[#F5F2EB] shadow-xs"
                        : "text-[#2C221E] hover:bg-[#E4DCCD]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {focusMode === "target_50" ? (
              <p className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-[#722F3E] tabular-nums">
                <Target className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Objetivo desta sessão: {SESSION_TARGET_PAGES} páginas</span>
              </p>
            ) : focusMode === "pomodoro" ? (
              <p className="font-sans text-xs font-medium text-[#5B4D44] tabular-nums">
                {pomodoroDone
                  ? "Ciclo Pomodoro de 25 minutos concluído!"
                  : `Bloco focado de 25 minutos (${pomodoroProgressPercent}%)`}
              </p>
            ) : null}
          </div>

          {/* Mostrador Principal com Anel Dourado Sutil */}
          <div className="relative mx-auto my-7 flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
            <svg
              viewBox="0 0 256 256"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
            >
              <circle
                cx="128"
                cy="128"
                r={ringRadius}
                fill="none"
                stroke="rgba(140, 122, 99, 0.2)"
                strokeWidth="3"
              />
              <circle
                cx="128"
                cy="128"
                r={ringRadius}
                fill="none"
                stroke={isRunning ? "#D4AF37" : "#C4A77D"}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringStrokeDashoffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>

            <div className="relative z-10 flex flex-col items-center">
              <div
                aria-live="off"
                className="font-serif text-6xl font-bold tracking-tight tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[#1C1815] sm:text-7xl"
              >
                {formatTimer(displayedTimerSeconds)}
              </div>
              <span className="mt-2 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[#722F3E]">
                {isRunning
                  ? "Em leitura"
                  : pomodoroDone
                    ? "Ciclo concluído"
                    : hasStarted
                      ? "Pausado"
                      : focusMode === "pomodoro"
                        ? "Pomodoro 25 min"
                        : "Cronômetro livre"}
              </span>
            </div>
          </div>

          {/* Linha de progresso dourada fina */}
          <div
            role="progressbar"
            aria-label="Progresso da sessão de leitura"
            aria-valuenow={Math.round(ringProgressRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mx-auto mb-6 h-1 w-full max-w-xs overflow-hidden rounded-full bg-[#8C7A63]/20"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#C4A77D] to-[#D4AF37] transition-all duration-500"
              style={{ width: `${Math.round(ringProgressRatio * 100)}%` }}
            />
          </div>

          {/* Controles Diretos do Cronômetro */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlayPause}
              className="inline-flex min-h-[48px] min-w-[144px] items-center justify-center gap-2 rounded-full bg-[#C8A46E] px-6 font-sans text-sm sm:text-base font-semibold text-[#141514] shadow-md hover:bg-[#DFBE88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] transition-all active:scale-[0.99]"
            >
              {isRunning ? (
                <>
                  <Pause className="h-4 w-4" aria-hidden="true" /> Pausar
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />{" "}
                  {showQuickRegister || hasStarted ? "Retomar" : "Iniciar"}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleStopSession}
              disabled={!isRunning && !hasStarted && elapsedSeconds === 0}
              className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full border border-[#722F3E]/35 bg-[#722F3E] px-5 font-sans text-sm font-semibold text-[#F4EFE6] hover:bg-[#5E2431] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] disabled:opacity-45 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              <span>Encerrar Sessão</span>
            </button>

            <button
              type="button"
              onClick={handleResetSession}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#8C7A63]/30 bg-[#F4EFE6] px-5 font-sans text-sm font-medium text-[#2C221E] hover:border-[#C4A77D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E] transition-all active:scale-[0.99]"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" /> Zerar
            </button>
          </div>

          {/* Painel central imediato após Pausar ou Encerrar Sessão */}
          {selectedBook && showQuickRegister ? (
            <div
              aria-label="Registro imediato da sessão encerrada"
              className="mx-auto mt-7 max-w-lg rounded-2xl border border-[#C8A46E]/45 bg-[#141514] p-5 text-center text-[#F4EFE6] shadow-lg sm:p-6"
            >
              <p className="font-sans text-[11px] font-bold tracking-[0.16em] uppercase text-[#DFBE88]">
                Registrar avanço da sessão
              </p>

              <div
                role="group"
                aria-label="Modo de entrada de páginas"
                className="mx-auto mt-3 inline-flex rounded-full border border-[#C8A46E]/30 bg-[#222422] p-1"
              >
                <button
                  type="button"
                  aria-pressed={quickRegisterMode === "delta"}
                  onClick={() => {
                    setQuickRegisterMode("delta");
                    setRawSessionInput("");
                  }}
                  className={`rounded-full px-3 py-1 font-sans text-[11px] font-semibold transition-colors ${
                    quickRegisterMode === "delta"
                      ? "bg-[#C8A46E] text-[#141514]"
                      : "text-[#DFBE88] hover:text-[#F4EFE6]"
                  }`}
                >
                  Páginas lidas nesta sessão
                </button>
                <button
                  type="button"
                  aria-pressed={quickRegisterMode === "current_page"}
                  onClick={() => {
                    setQuickRegisterMode("current_page");
                    setRawSessionInput(String(previousBookValue));
                  }}
                  className={`rounded-full px-3 py-1 font-sans text-[11px] font-semibold transition-colors ${
                    quickRegisterMode === "current_page"
                      ? "bg-[#C8A46E] text-[#141514]"
                      : "text-[#DFBE88] hover:text-[#F4EFE6]"
                  }`}
                >
                  Página atual onde parou
                </button>
              </div>

              <label
                htmlFor="focus-session-pages"
                className="mt-4 block font-serif text-xl font-bold text-[#F4EFE6]"
              >
                {progressInputLabel}
              </label>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <input
                  ref={quickInputRef}
                  id="focus-session-pages"
                  autoFocus
                  type="number"
                  min={quickRegisterMode === "current_page" ? previousBookValue : 0}
                  placeholder={
                    quickRegisterMode === "current_page"
                      ? String(previousBookValue)
                      : focusMode === "target_50"
                        ? "50"
                        : "Ex.: 20"
                  }
                  value={rawSessionInput}
                  onChange={(e) => {
                    setRawSessionInput(e.target.value);
                    if (saveSuccess) setSaveSuccess(false);
                    if (saveError) setSaveError(null);
                  }}
                  className="min-h-[44px] w-36 rounded-lg border border-[#C8A46E]/40 bg-[#F4EFE6] px-3 py-2 text-center font-sans text-base font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[#141514] focus:border-[#C8A46E] focus:outline-none focus:ring-2 focus:ring-[#C8A46E]"
                />

                <button
                  type="button"
                  disabled={isSaving || pagesReadThisSession <= 0}
                  onClick={handleSaveProgress}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#C8A46E] px-5 font-sans text-sm font-bold text-[#141514] hover:bg-[#DFBE88] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DFBE88] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  {isSaving ? (
                    "Salvando..."
                  ) : saveSuccess ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" /> Atualizado!
                    </>
                  ) : (
                    "Atualizar"
                  )}
                </button>

                {focusMode === "target_50" &&
                quickRegisterMode === "delta" &&
                pagesReadThisSession !== SESSION_TARGET_PAGES ? (
                  <button
                    type="button"
                    onClick={() => setRawSessionInput(String(SESSION_TARGET_PAGES))}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-[#C8A46E]/35 bg-[#222422] px-3 font-sans text-xs font-semibold text-[#DFBE88] hover:border-[#C8A46E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A46E]"
                  >
                    Usar meta ({SESSION_TARGET_PAGES} págs)
                  </button>
                ) : null}
              </div>

              {quickRegisterMode === "current_page" &&
              numericInput > previousBookValue ? (
                <p className="mt-2 font-sans text-xs text-[#E3DBD0] tabular-nums">
                  Diferença calculada: +{pagesReadThisSession} nesta sessão
                </p>
              ) : null}

              {saveError ? (
                <p
                  role="alert"
                  className="mt-3 inline-flex items-center gap-1.5 font-sans text-xs font-medium text-[#F28B82]"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{saveError}</span>
                </p>
              ) : null}

              <div
                role="status"
                aria-live="polite"
                className="mt-5 rounded-xl border border-[#C8A46E]/25 bg-[#222422] px-4 py-3 text-center"
              >
                <p className="inline-flex items-center justify-center gap-1.5 font-sans text-xs sm:text-sm font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[#DFBE88]">
                  <Sparkles className="h-4 w-4 shrink-0 text-[#C8A46E]" aria-hidden="true" />
                  <span>{sessionSummaryText}</span>
                </p>
                {selectedBook.progressTotal ? (
                  <p className="mt-1 font-sans text-[11px] tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[#E3DBD0]">
                    {saveSuccess
                      ? `Progresso atualizado para ${selectedBook.progressValue} / ${selectedBook.progressTotal} (${selectedBook.progressPercent}%)`
                      : `Progresso atual: ${selectedBook.progressValue} / ${selectedBook.progressTotal} (${selectedBook.progressPercent}%)`}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {/* LATERAL ESQUERDA (3 cols desktop · order-2 mobile): LIVRO EM LEITURA + PROGRESSO */}
        <aside
          aria-label="Livro em foco e progresso"
          className="order-2 rounded-2xl border border-[#8C7A63]/18 bg-[#FAF7F1]/65 p-5 shadow-[0_4px_24px_-12px_rgba(44,34,30,0.08)] backdrop-blur-md lg:order-1 lg:col-span-3"
        >
          <div className="border-b border-[#8C7A63]/22 pb-3">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-[#722F3E]">
              Livro em Foco
            </p>
            <h2 className="mt-0.5 font-serif text-base font-semibold text-[#2C221E]">
              Obra da Sessão
            </h2>
          </div>

          {booksState.length > 0 ? (
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="book-select"
                  className="mb-1.5 block font-sans text-[11px] font-medium text-[#5B4D44]"
                >
                  Trocar obra
                </label>
                <select
                  id="book-select"
                  value={selectedBookId}
                  onChange={(e) => {
                    setSelectedBookId(e.target.value);
                    setRawSessionInput("");
                    setSaveSuccess(false);
                  }}
                  className="w-full rounded-lg border border-[#8C7A63]/28 bg-[#F4EFE6] px-3 py-2 font-sans text-xs font-medium text-[#1C1815] focus:border-[#C4A77D] focus:outline-none focus:ring-2 focus:ring-[#C4A77D]"
                >
                  {booksState.map((b) => (
                    <option key={b.readingId} value={b.readingId}>
                      {b.title} — {b.author}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBook ? (
                <div className="space-y-3 border-t border-[#8C7A63]/22 pt-3.5">
                  <div className="flex items-start gap-3">
                    <BookCover
                      title={selectedBook.title}
                      author={selectedBook.author}
                      coverUrl={selectedBook.coverUrl}
                      spineColor={selectedBook.spineColor}
                      spineAccent={selectedBook.spineAccent}
                      seed={selectedBook.seed ?? selectedBook.readingId}
                      readingStatus={selectedBook.readingStatus ?? "reading"}
                      progressPercent={selectedBook.progressPercent}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-serif text-base font-bold leading-snug text-[#1C1815]">
                        {selectedBook.title}
                      </p>
                      <p className="mt-0.5 font-sans text-xs text-[#5B4D44]">
                        {selectedBook.author}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between font-sans text-[11px] tabular-nums text-[#5B4D44]">
                      <span>
                        {selectedBook.progressValue}
                        {selectedBook.progressTotal
                          ? ` / ${selectedBook.progressTotal}`
                          : ""}
                      </span>
                      <span className="font-semibold text-[#722F3E]">
                        {selectedBook.progressPercent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#8C7A63]/20">
                      <div
                        className="h-full rounded-full bg-[#C4A77D] transition-all duration-300"
                        style={{ width: `${selectedBook.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 text-center">
              <BookOpen className="mx-auto mb-2 h-6 w-6 text-[#C4A77D]" aria-hidden="true" />
              <p className="font-sans text-xs text-[#5B4D44]">
                Nenhum livro marcado como &ldquo;Lendo agora&rdquo;.
              </p>
              <Link
                href="/estantes"
                className="mt-2 inline-flex font-sans text-xs font-semibold text-[#722F3E] hover:underline"
              >
                Escolher na estante →
              </Link>
            </div>
          )}
        </aside>

        {/* LATERAL DIREITA (3 cols desktop · order-3 mobile): AMBIENTE, RESUMO E ANOTAÇÕES RÁPIDAS */}
        <aside
          aria-label="Ambiente e anotações rápidas da sessão"
          className="order-3 space-y-4 rounded-2xl border border-[#8C7A63]/18 bg-[#FAF7F1]/65 p-5 shadow-[0_4px_24px_-12px_rgba(44,34,30,0.08)] backdrop-blur-md lg:order-3 lg:col-span-3"
        >
          <div className="border-b border-[#8C7A63]/22 pb-3">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A5230]">
              Ambiente &amp; Notas
            </p>
            <h2 className="mt-0.5 font-serif text-base font-semibold text-[#2C221E]">
              Apoio de Leitura
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 font-sans text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4A77D] ${
              soundEnabled
                ? "border-[#C4A77D] bg-[#C4A77D]/18 text-[#1C1815]"
                : "border-[#8C7A63]/22 bg-[#F4EFE6]/80 text-[#5B4D44] hover:border-[#C4A77D]"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-[#722F3E]" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4 text-[#7A6A5E]" aria-hidden="true" />
              )}
              <span>{soundEnabled ? "Chuva suave: ativo" : "Som ambiente"}</span>
            </span>
            <span className="font-mono text-[10px] uppercase text-[#7A5230]">
              {soundEnabled ? "ON" : "OFF"}
            </span>
          </button>

          <div className="border-t border-[#8C7A63]/22 pt-3.5">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#5B4D44]">
              Resumo da sessão
            </p>
            <p className="mt-1 font-sans text-xs tabular-nums text-[#5B4D44]">
              Tempo decorrido:{" "}
              <strong className="font-semibold text-[#1C1815]">
                {formatTimer(elapsedSeconds)}
              </strong>
            </p>
            <p className="mt-0.5 font-sans text-[11px] text-[#7A6A5E]">
              Pause ou encerre para registrar páginas e calcular o ritmo.
            </p>
          </div>

          <div className="border-t border-[#8C7A63]/22 pt-3.5">
            <label
              htmlFor="focus-quick-notes"
              className="mb-1.5 block font-sans text-[11px] font-semibold uppercase tracking-wider text-[#5B4D44]"
            >
              Anotações rápidas
            </label>
            <textarea
              id="focus-quick-notes"
              rows={4}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Trechos marcantes, páginas para reler ou impressões desta sessão..."
              className="w-full resize-none rounded-xl border border-[#8C7A63]/22 bg-[#F4EFE6]/75 p-2.5 font-sans text-xs leading-relaxed text-[#2C221E] placeholder:text-[#7A6A5E]/75 focus:border-[#C4A77D] focus:outline-none"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function TimerIconShim({ className }: { className?: string }) {
  return <Clock className={className} aria-hidden="true" />;
}
