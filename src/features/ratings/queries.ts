import "server-only";
import { requireAuthenticatedWorkspace } from "@/server/store/memory-repository";
import {
  buildAutomaticRanking,
  type RankedWorkEntry,
} from "@/features/ratings/rules";
import {
  indexEditionsByWorkId,
  resolveWorkCoverEdition,
} from "@/features/catalog/cover-url";

export async function getAutomaticRankingView(): Promise<
  Array<
    RankedWorkEntry & {
      primaryAuthor: string;
      coverUrl?: string;
      spineColor?: string;
      spineAccent?: string;
      seed?: string;
    }
  >
> {
  const ws = await requireAuthenticatedWorkspace();
  const worksById = new Map(ws.works.map((w) => [w.id, w]));
  const editionsByWorkId = indexEditionsByWorkId(ws.editions);
  const ranked = buildAutomaticRanking(ws.reviews, worksById);

  return ranked.map((entry) => {
    const ed = resolveWorkCoverEdition({
      workId: entry.work.id,
      editions: ws.editions,
      editionsByWorkId,
    });
    return {
      ...entry,
      primaryAuthor:
        entry.work.contributors.find((c) => c.role === "author")?.name ??
        "Autor desconhecido",
      coverUrl: ed?.coverUrl,
      spineColor: ed?.coverColor,
      spineAccent: ed?.coverAccentColor,
      seed: ed?.isbn13 ?? entry.work.id,
    };
  });
}
