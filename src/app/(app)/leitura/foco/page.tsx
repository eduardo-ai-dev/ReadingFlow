import type { Metadata } from "next";
import { getReadingsOverview } from "@/features/reading/queries";
import { FocusReadingSessionClient, type ActiveBookItem } from "@/components/FocusReadingSessionClient";

export const metadata: Metadata = {
  title: "Sessão de Leitura (Canto de Foco) — ReadingFlow",
};

export default async function FocusSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ readingId?: string }>;
}) {
  const [{ readingId }, overview] = await Promise.all([
    searchParams,
    getReadingsOverview(),
  ]);

  const activeBooks: ActiveBookItem[] = [...overview.active, ...overview.paused].map((entry) => ({
    readingId: entry.reading.id,
    title: entry.work.title,
    author: entry.primaryAuthor,
    coverUrl: entry.edition?.coverUrl,
    spineColor: entry.edition?.coverColor,
    spineAccent: entry.edition?.coverAccentColor,
    seed: entry.edition?.isbn13 ?? entry.work.id,
    readingStatus: entry.reading.status,
    progressValue: entry.reading.progressValue,
    progressTotal: entry.reading.progressTotal ?? entry.edition?.pages,
    progressUnit: entry.reading.progressUnit,
    progressPercent: entry.percent,
  }));

  return (
    <div className="py-2 sm:py-4">
      <FocusReadingSessionClient
        activeBooks={activeBooks}
        initialReadingId={readingId}
      />
    </div>
  );
}
