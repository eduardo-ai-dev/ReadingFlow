import { hashCoverSeed } from "@/lib/cover-color";
import { deriveSpineAccentHex } from "@/features/catalog/spine-color-rules";

/**
 * Paleta editorial de encadernação derivada de forma determinística em JS puro
 * (100% compatível com Cloudflare Workers / workerd, sem binários nativos).
 * Quando o cliente extrai a cor real via Canvas no navegador, essa cor prevalece;
 * no servidor, o fallback determinístico evita bloqueio de CPU e dependências nativas.
 */
const EDITORIAL_BOOKBINDING_SWATCHES = [
  "#6E1E2A", // Couro Bordô
  "#2F5C46", // Verde Biblioteca
  "#26466D", // Azul Prussiano
  "#7A4B2A", // Nogueira
  "#8A3B2B", // Terracota
  "#5B3A63", // Ameixa Editorial
  "#8F6B24", // Ocre Dourado
  "#2D524E", // Petróleo Escuro
  "#6C2D3C", // Vinho Antigo
  "#47392E", // Tabaco Escuro
] as const;

/**
 * Calcula no servidor, em TypeScript puro (sem `sharp`), uma paleta editorial
 * determinística (`spineColor` + `spineAccent`) para a lombada a partir da URL da capa.
 */
export async function extractSpinePaletteFromCover(
  coverUrl: string,
  _signal?: AbortSignal
): Promise<{ spineColor: string; spineAccent: string } | null> {
  void _signal;
  const trimmed = coverUrl.trim();
  if (!trimmed) return null;

  const idx = hashCoverSeed(trimmed) % EDITORIAL_BOOKBINDING_SWATCHES.length;
  const primary = EDITORIAL_BOOKBINDING_SWATCHES[idx] ?? "#6E1E2A";
  const accent = deriveSpineAccentHex(primary);

  return {
    spineColor: primary,
    spineAccent: accent,
  };
}

/**
 * Compatibilidade: retorna apenas a cor principal da lombada.
 */
export async function extractSpineColorFromCover(
  coverUrl: string,
  signal?: AbortSignal
): Promise<string | null> {
  const palette = await extractSpinePaletteFromCover(coverUrl, signal);
  return palette?.spineColor ?? null;
}
