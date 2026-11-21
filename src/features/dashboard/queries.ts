import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import { selectEligibleFinishedReadings } from "@/features/goals/rules";
import { daysBetweenInclusive, formatDateInTimezone } from "@/lib/dates";
import {
  MONTH_NAMES_PT_BR,
  computeActiveDaysMetrics,
  computeCompletedMonthsComparison,
  computeDailyPaceOnActiveDays,
  computeReadingForecast,
  computeReadingFrequencyPerWeek,
  computeWeeklyAverage,
  curateDashboardActivityFeed,
  deriveDailyReadingLedger,
  type CompletedMonthsComparison,
  type CuratedDashboardActivityEvent,
  type DailyReadingRecord,
  type MetricWithBasis,
  type RawDashboardActivityEvent,
} from "@/lib/reading-metrics";
import type { Edition, Work } from "@/lib/domain";

export { computeReadingForecast };

export type DashboardActivityEvent = CuratedDashboardActivityEvent;

export interface HeatmapDay {
  ymd: string;
  dayOfMonth: number;
  weekday: number; // 0 = dom, 6 = sab
  pages: number;
  level: 0 | 1 | 2 | 3;
}

export interface CollectionSummaryItem {
  work: Work;
  edition?: Edition;
  author: string;
  statusLabel: string;
}

export interface DashboardEditorialData {
  referenceDateIso: string;
  todayYmd: string;
  activityFeed: DashboardActivityEvent[];
  streak: {
    activeDaysInMonth: number;
    monthNameLower: string;
    heatmap: HeatmapDay[];
  };
  calendar: {
    todayYmd: string;
    initialYearMonth: string;
    earliestYearMonth: string;
    daysByYmd: Record<string, DailyReadingRecord>;
  };
  metrics: {
    dailyPace: MetricWithBasis;
    weeklyMonthAverage: MetricWithBasis;
    readingFrequency: MetricWithBasis;
    activeDaysInMonth: number;
    totalSessionsInMonth: number;
    monthElapsedDays: number;
    monthName: string;
    monthNameLower: string;
  };
  monthly: {
    monthName: string;
    monthNameLower: string;
    yearMonth: string;
    pagesRead: number;
    booksFinished: number;
    audioHours: number;
    dailyAveragePages: number;
    activeDaysInMonth: number;
    dailyPace: MetricWithBasis;
    weeklyAverage: MetricWithBasis;
    comparison: CompletedMonthsComparison | null;
  };
  collectionOverview: {
    counts: {
      ownedWorks: number;
      favorites: number;
      reading: number;
      finished: number;
      wishlist: number;
      abandoned: number;
    };
    recentBooks: CollectionSummaryItem[];
    wishlistBooks: CollectionSummaryItem[];
  };
}

export async function getDashboardEditorialData(): Promise<DashboardEditorialData> {
  const ws = await requireAuthenticatedWorkspace();
  const timezone = ws.profile.timezone || "America/Sao_Paulo";
  const now = new Date();
  const todayYmd = formatDateInTimezone(now, timezone);
  const currentYear = todayYmd.slice(0, 4);
  const currentMonth = todayYmd.slice(5, 7);
  const currentYearMonth = `${currentYear}-${currentMonth}`;
  const monthStartYmd = `${currentYearMonth}-01`;
  const monthEndYmd = `${currentYearMonth}-31`;

  const worksById = new Map(ws.works.map((w) => [w.id, w]));
  const editionsById = new Map(ws.editions.map((e) => [e.id, e]));
  const editionsByWorkId = new Map(ws.editions.map((e) => [e.workId, e]));

  // 1. Atividade Recente (lotes agrupados + prioridade a leitura e conclusão)
  const rawActivityEvents: RawDashboardActivityEvent[] = [];

  for (const r of ws.readings) {
    const work = worksById.get(r.workId);
    if (!work) continue;

    if (r.status === "finished") {
      rawActivityEvents.push({
        id: `act-fin-${r.id}`,
        type: "finished",
        title: `Concluiu "${work.title}"`,
        workTitle: work.title,
        detail: `Leitura em ${r.progressUnit === "seconds" ? "áudio" : "páginas"} finalizada.`,
        timestamp: r.finishedOn ?? r.updatedAt,
        workId: work.id,
      });
    } else if (r.status === "reading") {
      rawActivityEvents.push({
        id: `act-prog-${r.id}`,
        type: "progress",
        title: `Leu "${work.title}"`,
        workTitle: work.title,
        detail: `Progresso registrado: ${r.progressUnit === "seconds"
          ? `${Math.round(r.progressValue / 60)} minutos`
          : r.progressUnit === "pages"
            ? `${r.progressValue} páginas`
            : `${r.progressValue}%`
          }.`,
        timestamp: r.updatedAt,
        workId: work.id,
      });
    }
  }

  for (const rev of ws.reviews) {
    const work = worksById.get(rev.workId);
    if (!work) continue;
    rawActivityEvents.push({
      id: `act-rev-${rev.id}`,
      type: "reviewed",
      title: `Avaliou "${work.title}"`,
      workTitle: work.title,
      detail: `Nota ${rev.rating.toFixed(1).replace(".", ",")} ★ registrada.`,
      timestamp: rev.updatedAt,
      workId: work.id,
    });
  }

  const ownedItems = ws.items.filter(
    (item) => item.status === "owned" || item.status === "lent"
  );
  const ownedWorkIds = new Set<string>();
  for (const item of ownedItems) {
    const ed = editionsById.get(item.editionId);
    if (ed) ownedWorkIds.add(ed.workId);
  }

  for (const w of ws.works) {
    if (!ownedWorkIds.has(w.id)) continue;
    rawActivityEvents.push({
      id: `act-add-${w.id}`,
      type: "added",
      title: `Adicionou "${w.title}"`,
      workTitle: w.title,
      detail: "Obra catalogada no acervo pessoal.",
      timestamp: w.createdAt,
      workId: w.id,
    });
  }

  const recentEvents = curateDashboardActivityFeed(rawActivityEvents, 5);

  // 2. Fonte Única de Métricas (src/lib/reading-metrics.ts)
  const ledger = deriveDailyReadingLedger(ws.readings, worksById, editionsById);

  const daysByYmd: Record<string, DailyReadingRecord> = {};
  let earliestYearMonth = currentYearMonth;
  for (const [ymd, record] of ledger.entries()) {
    daysByYmd[ymd] = record;
    const ym = ymd.slice(0, 7);
    if (ym && ym < earliestYearMonth) {
      earliestYearMonth = ym;
    }
  }

  const monthIndex = Number.parseInt(currentMonth, 10) - 1;
  const monthName = MONTH_NAMES_PT_BR[monthIndex] ?? "Mês atual";
  const monthNameLower = monthName.toLowerCase();

  const monthPeriod = computeActiveDaysMetrics(
    ledger,
    monthStartYmd,
    monthEndYmd
  );
  const monthElapsedDays = Math.max(
    1,
    daysBetweenInclusive(monthStartYmd, todayYmd)
  );

  const dailyPace = computeDailyPaceOnActiveDays({
    totalPages: monthPeriod.totalPages,
    activeDays: monthPeriod.activeDays,
    periodLabel: monthNameLower,
  });

  const weeklyMonthAverage = computeWeeklyAverage({
    totalPages: monthPeriod.totalPages,
    elapsedDays: monthElapsedDays,
    scope: "month",
    periodLabel: monthNameLower,
  });

  const readingFrequency = computeReadingFrequencyPerWeek({
    activeDays: monthPeriod.activeDays,
    elapsedDays: monthElapsedDays,
    periodLabel: monthNameLower,
  });

  const comparison = computeCompletedMonthsComparison({
    ledger,
    currentYearMonth,
  });

  const finishedInMonth = selectEligibleFinishedReadings(ws.readings, {
    startsOn: monthStartYmd,
    endsOn: monthEndYmd,
    countRereads: ws.profile.goalsCountRereads,
  });

  // Compatibilidade legada para streak.heatmap (últimos 28 dias)
  const heatmap: HeatmapDay[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ymd = formatDateInTimezone(d, timezone);
    const dom = Number.parseInt(ymd.slice(8, 10), 10) || d.getDate();
    const dow = d.getDay();
    const pages = ledger.get(ymd)?.pages ?? 0;
    const level: 0 | 1 | 2 | 3 =
      pages === 0 ? 0 : pages < 20 ? 1 : pages < 33 ? 2 : 3;
    heatmap.push({ ymd, dayOfMonth: dom, weekday: dow, pages, level });
  }

  // 3. Visão de Coleção e Prateleiras
  const highRatedWorkIds = new Set(
    ws.reviews.filter((r) => r.rating >= 4.5).map((r) => r.workId)
  );
  const ownedWorksList = ws.works.filter((w) => ownedWorkIds.has(w.id));

  const recentBooks: CollectionSummaryItem[] = ownedWorksList.map((w) => {
    const ed = editionsByWorkId.get(w.id);
    const author =
      w.contributors.find((c) => c.role === "author")?.name ??
      "Autor desconhecido";
    const reading = ws.readings.find((r) => r.workId === w.id);
    const statusLabel = reading
      ? reading.status === "reading"
        ? "Em andamento"
        : reading.status === "finished"
          ? "Concluído"
          : reading.status === "paused"
            ? "Pausado"
            : "Abandonado"
      : "Na estante";

    return {
      work: w,
      edition: ed,
      author,
      statusLabel,
    };
  });

  const wishlistBooks: CollectionSummaryItem[] = ws.wishlist
    .filter((wish) => wish.status === "wanted")
    .map((wish): CollectionSummaryItem | null => {
      const w = worksById.get(wish.workId);
      if (!w) return null;
      const ed = wish.editionId
        ? editionsById.get(wish.editionId)
        : editionsByWorkId.get(w.id);
      const author =
        w.contributors.find((c) => c.role === "author")?.name ??
        "Autor desconhecido";
      return {
        work: w,
        edition: ed,
        author,
        statusLabel: "Desejado",
      };
    })
    .filter((item): item is CollectionSummaryItem => item !== null);

  const counts = {
    ownedWorks: ownedWorksList.length,
    favorites: highRatedWorkIds.size,
    reading: recentBooks.filter((b) => b.statusLabel === "Em andamento").length,
    finished: recentBooks.filter((b) => b.statusLabel === "Concluído").length,
    wishlist: wishlistBooks.length,
    abandoned: recentBooks.filter((b) => b.statusLabel === "Abandonado").length,
  };

  return {
    referenceDateIso: now.toISOString(),
    todayYmd,
    activityFeed: recentEvents,
    streak: {
      activeDaysInMonth: monthPeriod.activeDays,
      monthNameLower,
      heatmap,
    },
    calendar: {
      todayYmd,
      initialYearMonth: currentYearMonth,
      earliestYearMonth,
      daysByYmd,
    },
    metrics: {
      dailyPace,
      weeklyMonthAverage,
      readingFrequency,
      activeDaysInMonth: monthPeriod.activeDays,
      totalSessionsInMonth: monthPeriod.totalSessions,
      monthElapsedDays,
      monthName,
      monthNameLower,
    },
    monthly: {
      monthName,
      monthNameLower,
      yearMonth: currentYearMonth,
      pagesRead: monthPeriod.totalPages,
      booksFinished: finishedInMonth.length,
      audioHours: Number((monthPeriod.totalSeconds / 3600).toFixed(1)),
      dailyAveragePages: dailyPace.value,
      activeDaysInMonth: monthPeriod.activeDays,
      dailyPace,
      weeklyAverage: weeklyMonthAverage,
      comparison,
    },
    collectionOverview: {
      counts,
      recentBooks,
      wishlistBooks,
    },
  };
}
