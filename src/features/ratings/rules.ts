import type { Review, Work } from "@/lib/domain";

export function isValidHalfStar(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (value < 0.5 || value > 5.0) return false;
  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
}

export interface RankedWorkEntry {
  position: number;
  review: Review;
  work: Work;
}

export function buildAutomaticRanking(
  reviews: readonly Review[],
  worksById: ReadonlyMap<string, Work>
): RankedWorkEntry[] {
  const valid = reviews
    .filter((rev) => isValidHalfStar(rev.rating) && worksById.has(rev.workId))
    .map((review) => ({
      review,
      work: worksById.get(review.workId)!,
    }))
    .sort((a, b) => {
      if (b.review.rating !== a.review.rating) {
        return b.review.rating - a.review.rating;
      }
      const narA = a.review.narrationRating ?? 0;
      const narB = b.review.narrationRating ?? 0;
      if (narB !== narA) {
        return narB - narA;
      }
      return a.work.title.localeCompare(b.work.title, "pt-BR");
    });

  return valid.map((entry, idx) => ({
    position: idx + 1,
    review: entry.review,
    work: entry.work,
  }));
}
