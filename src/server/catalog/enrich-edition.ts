import type { Edition } from "@/lib/domain";
import { hydrateBookCoverMetadata } from "@/server/catalog/hydrate";
import { extractSpinePaletteFromCover } from "@/server/catalog/spine-color";
import {
  clampPaperHsl,
  deriveSpineAccentHex,
} from "@/features/catalog/spine-color-rules";
import { coverColor } from "@/lib/cover-color";

/**
 * Enriquecimento no cadastro (uma única vez, nunca na renderização):
 * 1. Se faltar capa ou páginas, busca por título + autor (Google Books `intitle:` + `inauthor:` + `langRestrict=pt` -> Open Library `?default=false`).
 * 2. Com a capa definida, extrai e persiste `coverColor` (`spineColor`) e `coverAccentColor` (`spineAccent`).
 * 3. Sem capa, deriva `coverColor` e `coverAccentColor` por deslocamento de matiz, garantindo persistência completa.
 * Preenche apenas o que está ausente e nunca lança: falhas deixam a edição consistente.
 */
export async function enrichEditionCoverMetadata(
  edition: Edition,
  author: string | undefined,
  options: { timeoutMs?: number; skipCoverLookup?: boolean } = {}
): Promise<void> {
  const signal = AbortSignal.timeout(options.timeoutMs ?? 3500);

  try {
    if ((!edition.coverUrl && !options.skipCoverLookup) || !edition.pages) {
      const found = await hydrateBookCoverMetadata({
        title: edition.title,
        author,
        isbn: edition.isbn13 ?? edition.isbn10 ?? null,
        format:
          edition.format === "audiobook"
            ? "audiobook"
            : edition.format === "ebook"
              ? "ebook"
              : "book",
        signal,
      });
      if (!options.skipCoverLookup && !edition.coverUrl && found.coverUrl) {
        edition.coverUrl = found.coverUrl;
        edition.coverSource = found.source ?? null;
      }
      if (!edition.pages && found.pages) edition.pages = found.pages;
    }

    if (edition.coverUrl && (!edition.coverColor || !edition.coverAccentColor)) {
      const palette = await extractSpinePaletteFromCover(edition.coverUrl, signal);
      if (palette) {
        if (!edition.coverColor) edition.coverColor = clampPaperHsl(palette.spineColor);
        if (!edition.coverAccentColor) {
          edition.coverAccentColor = clampPaperHsl(palette.spineAccent);
        }
      }
    }
  } catch {
    // Enriquecimento é opcional: o cadastro nunca falha por causa dele.
  }

  // Sem capa (ou falha na extração): garante spineColor e spineAccent persistidos desde o cadastro
  const seed = edition.isbn13 ?? edition.workId ?? edition.id;
  if (!edition.coverColor) {
    edition.coverColor = clampPaperHsl(coverColor(seed));
  }
  if (!edition.coverAccentColor) {
    edition.coverAccentColor = deriveSpineAccentHex(edition.coverColor, seed);
  }
}
