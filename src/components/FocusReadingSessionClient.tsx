"use client";

import { memo, useCallback, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
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
import {
  FOCUS_POMODORO_SECONDS,
  clearPersistedFocusSession,
  computeElapsedFocusSeconds,
  getFocusSessionStorageKey,
  parsePersistedFocusSession,
  readPersistedFocusSession,
  writePersistedFocusSession,
  type FocusSessionMode,
} from "@/features/reading/focus-session-storage";
import type { AmbientPreferences } from "@/features/reading/ambient-catalog";
import { BookCover } from "@/components/BookCover";
import type { ReadingStatus } from "@/lib/domain";

const AmbientSoundMixer = dynamic(
  () =>
    import("@/components/AmbientSoundMixer").then(
      (mod) => mod.AmbientSoundMixer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2 py-1" aria-hidden="true">
        <div className="h-4 w-28 animate-pulse rounded bg-[var(--rf-surface-subtle)]" />
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-lg bg-[var(--rf-surface-subtle)]"
            />
          ))}
        </div>
      </div>
    ),
  }
);

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Hook isolado de relógio de parede: atualiza apenas o componente consumidor a cada 1s
 * e pausa automaticamente quando a aba fica oculta (`document.visibilityState === "hidden"`),
 * evitando re-renderizar toda a página do Canto de Foco durante a sessão.
 */
function useLiveElapsedSeconds(params: {
  accumulatedSeconds: number;
  startedAtMs: number | null;
  isRunning: boolean;
  focusMode: FocusSessionMode;
  onPomodoroFinished?: () => void;
}): number {
  const {
    accumulatedSeconds,
    startedAtMs,
    isRunning,
    focusMode,
    onPomodoroFinished,
  } = params;
  const [liveSeconds, setLiveSeconds] = useState<number>(() =>
    computeElapsedFocusSeconds(
      { accumulatedSeconds, startedAtMs, isRunning, focusMode },
      Date.now()
    )
  );
  const onFinishRef = useRef(onPomodoroFinished);
  useEffect(() => {
    onFinishRef.current = onPomodoroFinished;
  }, [onPomodoroFinished]);

  useEffect(() => {
    const syncNow = () => {
      const next = computeElapsedFocusSeconds(
        { accumulatedSeconds, startedAtMs, isRunning, focusMode },
        Date.now()
      );
      setLiveSeconds(next);
      if (
        isRunning &&
        focusMode === "pomodoro" &&
        next >= FOCUS_POMODORO_SECONDS
      ) {
        onFinishRef.current?.();
      }
    };

    syncNow();
    if (!isRunning || startedAtMs === null) return;

    let intervalId: number | null = null;
    const startInterval = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(syncNow, 1000);
    };
    const stopInterval = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    if (document.visibilityState !== "hidden") {
      startInterval();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopInterval();
      } else {
        syncNow();
        startInterval();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [accumulatedSeconds, startedAtMs, isRunning, focusMode]);

  return liveSeconds;
}

const FocusStopwatchDisplay = memo(function FocusStopwatchDisplay({
  accumulatedSeconds,
  startedAtMs,
  isRunning,
  hasStarted,
  focusMode,
  pomodoroDone,
  onPomodoroFinished,
}: {
  accumulatedSeconds: number;
  startedAtMs: number | null;
  isRunning: boolean;
  hasStarted: boolean;
  focusMode: FocusSessionMode;
  pomodoroDone: boolean;
  onPomodoroFinished: () => void;
}) {
  const elapsedSeconds = useLiveElapsedSeconds({
    accumulatedSeconds,
    startedAtMs,
    isRunning,
    focusMode,
    onPomodoroFinished,
  });

  const displayedTimerSeconds =
    focusMode === "pomodoro"
      ? Math.max(0, FOCUS_POMODORO_SECONDS - elapsedSeconds)
      : elapsedSeconds;

  const pomodoroProgressPercent =
    focusMode === "pomodoro"
      ? Math.min(
          100,
          Math.round((elapsedSeconds / FOCUS_POMODORO_SECONDS) * 100)
        )
      : 0;

  const ringRadius = 112;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgressRatio =
    focusMode === "pomodoro"
      ? Math.min(1, elapsedSeconds / FOCUS_POMODORO_SECONDS)
      : Math.min(1, (elapsedSeconds % 3600) / 3600);
  const ringStrokeDashoffset = ringCircumference * (1 - ringProgressRatio);

  return (
    <>
      {focusMode === "pomodoro" ? (
        <p className="mt-2 font-sans text-xs font-medium text-[#5B4D44] tabular-nums">
          {pomodoroDone
            ? "Ciclo Pomodoro de 25 minutos concluído!"
            : `Bloco focado de 25 minutos (${pomodoroProgressPercent}%)`}
        </p>
      ) : null}

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
            className="transition-[stroke-dashoffset] duration-700 ease-out"
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

      {/* Linha de progresso dourada fina animada via transform: scaleX (zero layout) */}
      <div
        role="progressbar"
        aria-label="Progresso da sessão de leitura"
        aria-valuenow={Math.round(ringProgressRatio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mx-auto mb-6 h-1 w-full max-w-xs overflow-hidden rounded-full bg-[#8C7A63]/20"
      >
        <div
          className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#C4A77D] to-[#D4AF37] transition-transform duration-500"
          style={{ transform: `scaleX(${ringProgressRatio})` }}
        />
      </div>
    </>
  );
});

const FocusElapsedText = memo(function FocusElapsedText({
  accumulatedSeconds,
  startedAtMs,
  isRunning,
  focusMode,
}: {
  accumulatedSeconds: number;
  startedAtMs: number | null;
  isRunning: boolean;
  focusMode: FocusSessionMode;
}) {
  const live = useLiveElapsedSeconds({
    accumulatedSeconds,
    startedAtMs,
    isRunning,
    focusMode,
  });
  return (
    <strong className="font-semibold text-[#1C1815]">
      {formatTimer(live)}
    </strong>
  );
});

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

type FocusMode = FocusSessionMode;
type QuickRegisterMode = "delta" | "current_page";

const POMODORO_SECONDS = FOCUS_POMODORO_SECONDS;
const SESSION_TARGET_PAGES = 50;

export function FocusReadingSessionClient({
  userId,
  activeBooks,
  initialReadingId,
  initialAmbientPreferences,
}: {
  userId?: string;
  activeBooks: ActiveBookItem[];
  initialReadingId?: string;
  initialAmbientPreferences?: AmbientPreferences | null;
}) {
  const router = useRouter();
  const resolvedInitialId =
    initialReadingId &&
    activeBooks.some((b) => b.readingId === initialReadingId)
      ? initialReadingId
      : (activeBooks[0]?.readingId ?? "");

  const [progressOverrides, setProgressOverrides] = useState<
    Record<string, { progressValue: number; progressPercent: number }>
  >({});
  const [selectedBookId, setSelectedBookId] =
    useState<string>(resolvedInitialId);
  const [focusMode, setFocusMode] = useState<FocusMode>("free");
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [pomodoroDone, setPomodoroDone] = useState(false);
  const [quickRegisterMode, setQuickRegisterMode] =
    useState<QuickRegisterMode>("delta");
  const [stopAudioSignal, setStopAudioSignal] = useState(0);
  const [sessionNotes, setSessionNotes] = useState("");
  const [rawSessionInput, setRawSessionInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedNotesIncluded, setSavedNotesIncluded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hydratedStorageRef = useRef(false);

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

  // Restaura sessão em andamento após recarregamento sem erro de hidratação SSR (isolado por userId)
  useEffect(() => {
    const saved = readPersistedFocusSession(userId);
    hydratedStorageRef.current = true;
    if (!saved) return;

    const matchesExistingBook = activeBooks.some(
      (b) => b.readingId === saved.readingId
    );
    const shouldRestore =
      matchesExistingBook &&
      (!initialReadingId || initialReadingId === saved.readingId);
    if (!shouldRestore) return;

    const restoredElapsed = computeElapsedFocusSeconds(saved, Date.now());
    const finishedPomodoro =
      saved.focusMode === "pomodoro" && restoredElapsed >= POMODORO_SECONDS;

    const frameId = window.requestAnimationFrame(() => {
      setSelectedBookId(saved.readingId);
      setFocusMode(saved.focusMode);
      setAccumulatedSeconds(
        finishedPomodoro ? POMODORO_SECONDS : saved.accumulatedSeconds
      );
      setStartedAtMs(
        finishedPomodoro || !saved.isRunning ? null : saved.startedAtMs
      );
      setIsRunning(!finishedPomodoro && saved.isRunning);
      setHasStarted(saved.hasStarted || restoredElapsed > 0);
      setPomodoroDone(finishedPomodoro);
      if (finishedPomodoro || (!saved.isRunning && restoredElapsed > 0)) {
        setShowQuickRegister(true);
      }
      setSessionNotes(saved.sessionNotes);
    });
    return () => window.cancelAnimationFrame(frameId);
    // Executa apenas na montagem para hidratar a sessão ativa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persiste estado da sessão no localStorage escopado por usuário (sobrevive a F5 e sincroniza entre abas)
  useEffect(() => {
    if (!hydratedStorageRef.current || !selectedBookId) return;
    if (
      !hasStarted &&
      accumulatedSeconds === 0 &&
      !isRunning &&
      !sessionNotes.trim()
    ) {
      clearPersistedFocusSession(userId);
      return;
    }
    writePersistedFocusSession(
      {
        readingId: selectedBookId,
        focusMode,
        accumulatedSeconds,
        startedAtMs,
        isRunning,
        hasStarted,
        sessionNotes,
        updatedAtMs: Date.now(),
      },
      userId
    );
  }, [
    userId,
    selectedBookId,
    focusMode,
    accumulatedSeconds,
    startedAtMs,
    isRunning,
    hasStarted,
    sessionNotes,
  ]);

  // Sincroniza múltiplas abas abertas do Canto de Foco via evento `storage` (somente da mesma conta)
  useEffect(() => {
    const expectedKey = getFocusSessionStorageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== expectedKey) return;
      if (!e.newValue) {
        setIsRunning(false);
        setAccumulatedSeconds(0);
        setStartedAtMs(null);
        setHasStarted(false);
        setShowQuickRegister(false);
        setPomodoroDone(false);
        setSessionNotes("");
        return;
      }
      const next = parsePersistedFocusSession(e.newValue);
      if (!next) return;
      setSelectedBookId((curr) =>
        activeBooks.some((b) => b.readingId === next.readingId)
          ? next.readingId
          : curr
      );
      setFocusMode(next.focusMode);
      setAccumulatedSeconds(next.accumulatedSeconds);
      setStartedAtMs(next.startedAtMs);
      setIsRunning(next.isRunning);
      setHasStarted(next.hasStarted);
      setSessionNotes(next.sessionNotes);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [activeBooks, userId]);

  // Alerta antes de fechar ou recarregar durante sessão ativa
  useEffect(() => {
    if (!isRunning) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isRunning]);

  // Auto-focus no campo numérico sempre que o card rápido abrir após Pausar/Encerrar Sessão
  useEffect(() => {
    if (showQuickRegister) {
      const id = window.requestAnimationFrame(() => {
        quickInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [showQuickRegister, quickRegisterMode]);

  const handlePomodoroFinished = useCallback(() => {
    setAccumulatedSeconds(POMODORO_SECONDS);
    setStartedAtMs(null);
    setIsRunning(false);
    setPomodoroDone(true);
    setShowQuickRegister(true);
  }, []);

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

  const handleSelectMode = (nextMode: FocusMode) => {
    setFocusMode(nextMode);
    setIsRunning(false);
    setAccumulatedSeconds(0);
    setStartedAtMs(null);
    setHasStarted(false);
    setShowQuickRegister(false);
    setPomodoroDone(false);
    setSaveSuccess(false);
    setSavedNotesIncluded(false);
    setSaveError(null);
  };

  const handleTogglePlayPause = () => {
    if (isRunning) {
      // Pausar consolida tempo real decorrido e abre imediatamente o card central de registro rápido
      const consolidated = computeElapsedFocusSeconds(
        { accumulatedSeconds, startedAtMs, isRunning: true, focusMode },
        Date.now()
      );
      setAccumulatedSeconds(consolidated);
      setStartedAtMs(null);
      setIsRunning(false);
      setShowQuickRegister(true);
      setSaveError(null);
      return;
    }
    let nextAccum = accumulatedSeconds;
    if (focusMode === "pomodoro" && accumulatedSeconds >= POMODORO_SECONDS) {
      nextAccum = 0;
      setAccumulatedSeconds(0);
    }
    setAccumulatedSeconds(nextAccum);
    setStartedAtMs(Date.now());
    setHasStarted(true);
    setPomodoroDone(false);
    setShowQuickRegister(false);
    setSaveSuccess(false);
    setSavedNotesIncluded(false);
    setSaveError(null);
    setIsRunning(true);
  };

  const handleStopSession = () => {
    if (isRunning) {
      const consolidated = computeElapsedFocusSeconds(
        { accumulatedSeconds, startedAtMs, isRunning: true, focusMode },
        Date.now()
      );
      setAccumulatedSeconds(consolidated);
    }
    setStartedAtMs(null);
    setIsRunning(false);
    setHasStarted(true);
    setShowQuickRegister(true);
    setSaveError(null);
    setStopAudioSignal((s) => s + 1);
  };

  const handleResetSession = () => {
    setIsRunning(false);
    setAccumulatedSeconds(0);
    setStartedAtMs(null);
    setHasStarted(false);
    setShowQuickRegister(false);
    setPomodoroDone(false);
    setRawSessionInput("");
    setSessionNotes("");
    setSaveSuccess(false);
    setSavedNotesIncluded(false);
    setSaveError(null);
    clearPersistedFocusSession(userId);
  };

  const trimmedRawInput = rawSessionInput.trim();
  const isRawInputValidInt =
    trimmedRawInput === "" || /^\d+$/.test(trimmedRawInput);
  const numericInput = isRawInputValidInt
    ? Math.max(0, Number.parseInt(trimmedRawInput, 10) || 0)
    : 0;
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
    if (!selectedBook) return;
    if (!isRawInputValidInt) {
      setSaveError("Informe um número inteiro sem casas decimais.");
      return;
    }
    if (pagesReadThisSession <= 0) {
      setSaveError("Informe um avanço maior que zero para registrar a sessão.");
      return;
    }

    const nextRawValue =
      selectedBook.progressUnit === "seconds"
        ? (previousBookValue + pagesReadThisSession) * 60
        : previousBookValue + pagesReadThisSession;

    if (selectedBook.progressUnit === "percent" && nextRawValue > 100) {
      setSaveError("A porcentagem acumulada não pode exceder 100%.");
      return;
    }
    if (
      selectedBook.progressTotal &&
      nextRawValue > selectedBook.progressTotal
    ) {
      setSaveError(
        selectedBook.progressUnit === "pages"
          ? `O avanço informado excede o total do livro (${selectedBook.progressTotal} pág.).`
          : `O tempo informado excede a duração total (${Math.round(selectedBook.progressTotal / 60)} min).`
      );
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const cleanNotes = sessionNotes.trim();
      const res = await updateReadingProgressAction({
        readingId: selectedBook.readingId,
        progressUnit: selectedBook.progressUnit,
        progressValue: nextRawValue,
        progressTotal: selectedBook.progressTotal,
        sessionNotes: cleanNotes || undefined,
      });

      if (!res.ok) {
        setSaveError(res.error);
        return;
      }

      const nextPercent =
        selectedBook.progressUnit === "percent"
          ? Math.min(100, Math.round(nextRawValue))
          : selectedBook.progressTotal && selectedBook.progressTotal > 0
            ? Math.min(
                100,
                Math.round((nextRawValue / selectedBook.progressTotal) * 100)
              )
            : selectedBook.progressPercent;

      setProgressOverrides((prev) => ({
        ...prev,
        [selectedBook.readingId]: {
          progressValue: nextRawValue,
          progressPercent: nextPercent,
        },
      }));
      setSavedNotesIncluded(Boolean(cleanNotes));
      setSaveSuccess(true);
      setSessionNotes("");
      setAccumulatedSeconds(0);
      setStartedAtMs(null);
      setHasStarted(false);
      clearPersistedFocusSession(userId);
      router.refresh();
    } catch {
      setSaveError(
        "Não foi possível registrar o avanço agora. Tente novamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const sessionSummaryText = selectedBook
    ? formatFocusSessionSummaryPtBr({
        amount: pagesReadThisSession,
        unit: selectedBook.progressUnit,
        elapsedSeconds: accumulatedSeconds,
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
          className="order-first rounded-2xl border border-[#C4A77D]/30 bg-[#FAF7F1] p-6 text-center shadow-[0_8px_32px_-16px_rgba(44,34,30,0.14)] sm:p-8 lg:order-2 lg:col-span-6"
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
                  {
                    id: "pomodoro",
                    label: "Pomodoro 25m",
                    icon: TimerIconShim,
                  },
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
                <span>
                  Objetivo desta sessão: {SESSION_TARGET_PAGES} páginas
                </span>
              </p>
            ) : null}
          </div>

          <FocusStopwatchDisplay
            accumulatedSeconds={accumulatedSeconds}
            startedAtMs={startedAtMs}
            isRunning={isRunning}
            hasStarted={hasStarted}
            focusMode={focusMode}
            pomodoroDone={pomodoroDone}
            onPomodoroFinished={handlePomodoroFinished}
          />

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
              disabled={!isRunning && !hasStarted && accumulatedSeconds === 0}
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
                  min={
                    quickRegisterMode === "current_page" ? previousBookValue : 0
                  }
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
                      <Check className="h-4 w-4" aria-hidden="true" />{" "}
                      Atualizado!
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
                    onClick={() =>
                      setRawSessionInput(String(SESSION_TARGET_PAGES))
                    }
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
                  <AlertCircle
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{saveError}</span>
                </p>
              ) : null}

              <div
                role="status"
                aria-live="polite"
                className="mt-5 rounded-xl border border-[#C8A46E]/25 bg-[#222422] px-4 py-3 text-center"
              >
                <p className="inline-flex items-center justify-center gap-1.5 font-sans text-xs sm:text-sm font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[#DFBE88]">
                  <Sparkles
                    className="h-4 w-4 shrink-0 text-[#C8A46E]"
                    aria-hidden="true"
                  />
                  <span>{sessionSummaryText}</span>
                </p>
                {selectedBook.progressTotal ? (
                  <p className="mt-1 font-sans text-[11px] tabular-nums [font-variant-numeric:lining-nums_tabular-nums] text-[#E3DBD0]">
                    {saveSuccess
                      ? `Progresso atualizado para ${selectedBook.progressValue} / ${selectedBook.progressTotal} (${selectedBook.progressPercent}%)${savedNotesIncluded ? " · Anotações salvas no histórico da obra." : ""}`
                      : `Progresso atual: ${selectedBook.progressValue} / ${selectedBook.progressTotal} (${selectedBook.progressPercent}%)`}
                  </p>
                ) : saveSuccess && savedNotesIncluded ? (
                  <p className="mt-1 font-sans text-[11px] text-[#E3DBD0]">
                    Anotações salvas no histórico da obra.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {/* LATERAL ESQUERDA (3 cols desktop · order-2 mobile): LIVRO EM LEITURA + PROGRESSO */}
        <aside
          aria-label="Livro em foco e progresso"
          className="order-2 rounded-2xl border border-[#8C7A63]/18 bg-[#FAF7F1] p-5 shadow-[0_4px_24px_-12px_rgba(44,34,30,0.08)] lg:order-1 lg:col-span-3"
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
              <BookOpen
                className="mx-auto mb-2 h-6 w-6 text-[#C4A77D]"
                aria-hidden="true"
              />
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
          className="order-3 space-y-4 rounded-2xl border border-[#8C7A63]/18 bg-[#FAF7F1] p-5 shadow-[0_4px_24px_-12px_rgba(44,34,30,0.08)] lg:order-3 lg:col-span-3"
        >
          <div className="border-b border-[#8C7A63]/22 pb-3">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A5230]">
              Ambiente &amp; Notas
            </p>
            <h2 className="mt-0.5 font-serif text-base font-semibold text-[#2C221E]">
              Apoio de Leitura
            </h2>
          </div>

          <AmbientSoundMixer
            userId={userId}
            initialPreferences={initialAmbientPreferences}
            stopSignal={stopAudioSignal}
          />

          <div className="border-t border-[#8C7A63]/22 pt-3.5">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#5B4D44]">
              Resumo da sessão
            </p>
            <p className="mt-1 font-sans text-xs tabular-nums text-[#5B4D44]">
              Tempo decorrido:{" "}
              <FocusElapsedText
                accumulatedSeconds={accumulatedSeconds}
                startedAtMs={startedAtMs}
                isRunning={isRunning}
                focusMode={focusMode}
              />
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
