import type { BookFormat, Edition, Work } from "@/lib/domain";
import { normalizeToIsbn13 } from "@/lib/isbn";
import { coverTone } from "@/lib/cover-color";

export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeWorkFingerprint(
  title: string,
  primaryAuthor: string,
  language = "pt-BR"
): string {
  const normTitle = normalizeSearchText(title);
  const normAuthor = normalizeSearchText(primaryAuthor);
  const normLang = language.trim().toLowerCase();
  return `${normTitle}::${normAuthor}::${normLang}`;
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j] ?? 0;
    }
  }

  return prev[b.length] ?? 0;
}

export type DuplicationResult =
  | { kind: "exact"; editionId: string; workId: string }
  | {
      kind: "probable";
      workId: string;
      reason: "fingerprint" | "similar_title";
    }
  | { kind: "distinct" };

export interface BookCandidate {
  isbn?: string;
  title: string;
  primaryAuthor: string;
  language?: string;
}

export function classifyBookDuplication(
  candidate: BookCandidate,
  existingEditions: readonly Edition[],
  existingWorks: readonly Work[]
): DuplicationResult {
  if (candidate.isbn) {
    const normalizedIsbn = normalizeToIsbn13(candidate.isbn);
    if (normalizedIsbn) {
      const matchedEdition = existingEditions.find(
        (ed) => ed.isbn13 === normalizedIsbn
      );
      if (matchedEdition) {
        return {
          kind: "exact",
          editionId: matchedEdition.id,
          workId: matchedEdition.workId,
        };
      }
    }
  }

  const targetFingerprint = computeWorkFingerprint(
    candidate.title,
    candidate.primaryAuthor,
    candidate.language ?? "pt-BR"
  );
  const candidateNormTitle = normalizeSearchText(candidate.title);
  const candidateNormAuthor = normalizeSearchText(candidate.primaryAuthor);

  for (const work of existingWorks) {
    if (work.fingerprint === targetFingerprint) {
      return { kind: "probable", workId: work.id, reason: "fingerprint" };
    }
    const workNormTitle = normalizeSearchText(work.title);
    const workAuthor =
      work.contributors.find((c) => c.role === "author")?.name ?? "";
    const workNormAuthor = normalizeSearchText(workAuthor);
    if (
      candidateNormTitle.length >= 5 &&
      levenshteinDistance(candidateNormTitle, workNormTitle) <= 2 &&
      levenshteinDistance(candidateNormAuthor, workNormAuthor) <= 2
    ) {
      return { kind: "probable", workId: work.id, reason: "similar_title" };
    }
  }

  return { kind: "distinct" };
}

export function matchesCatalogQuery(
  query: string,
  fields: readonly string[]
): boolean {
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return true;

  const queryTokens = normQuery.split(" ").filter(Boolean);
  const combinedHaystack = fields.map(normalizeSearchText).join(" ");
  const haystackWords = combinedHaystack.split(" ").filter(Boolean);

  return queryTokens.every((token) => {
    if (combinedHaystack.includes(token)) {
      return true;
    }
    if (token.length < 4) {
      return false;
    }
    const maxTypos = token.length >= 7 ? 2 : 1;
    return haystackWords.some(
      (word) =>
        Math.abs(word.length - token.length) <= maxTypos &&
        levenshteinDistance(token, word) <= maxTypos
    );
  });
}

export function estimateBookDimensions(
  format: BookFormat,
  pages?: number,
  explicit?: { heightMm?: number; thicknessMm?: number }
): { heightMm: number; thicknessMm: number } {
  const defaultHeightByFormat: Record<BookFormat, number> = {
    pocket: 180,
    paperback: 210,
    hardcover: 230,
    ebook: 200,
    audiobook: 200,
    box: 235,
    other: 210,
  };

  const heightMm = explicit?.heightMm ?? defaultHeightByFormat[format];

  if (explicit?.thicknessMm) {
    return { heightMm, thicknessMm: explicit.thicknessMm };
  }

  if (format === "ebook" || format === "audiobook") {
    return { heightMm, thicknessMm: 4 };
  }

  if (!pages || pages <= 0) {
    return { heightMm, thicknessMm: 20 };
  }

  const estimated = Math.round(2 + 0.05 * pages);
  return { heightMm, thicknessMm: Math.max(6, estimated) };
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((idx) => {
    const srgb = parseInt(hex.slice(idx, idx + 2), 16) / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

export function calculateContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function deriveTypographicCover(
  title: string,
  seed?: string,
  avoidNeighborHex?: string | null
): {
  backgroundColor: string;
  cssMix: string;
  textColor: string;
  accentColor: string;
  contrastRatio: number;
  monogram: string;
} {
  const chosen = coverTone(seed || title || "livro", avoidNeighborHex);
  const words = title.trim().split(/\s+/).filter(Boolean);
  const monogram =
    words.length >= 2
      ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase()
      : (words[0]?.slice(0, 2) ?? "RF").toUpperCase();

  return {
    backgroundColor: chosen.hex,
    cssMix: chosen.cssMix,
    textColor: chosen.textHex,
    accentColor: chosen.accentHex,
    contrastRatio: calculateContrastRatio(chosen.textHex, chosen.hex),
    monogram,
  };
}
