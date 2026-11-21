/**
 * Regras puras: cor principal (`spineColor`) e cor de acento (`spineAccent`) da capa
 * para tingir lombadas com acabamento de papel (HSL S <= 70%, L entre 18% e 82%).
 * Roda no servidor (sobre pixels já decodificados) e no cliente como fallback determinístico.
 */

function toHex(r: number, g: number, b: number): string {
  const byte = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return [
      Number.parseInt(clean[0]! + clean[0]!, 16),
      Number.parseInt(clean[1]! + clean[1]!, 16),
      Number.parseInt(clean[2]! + clean[2]!, 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      Number.parseInt(clean.slice(0, 2), 16),
      Number.parseInt(clean.slice(2, 4), 16),
      Number.parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) {
    return { h: 0, s: 0, l: l * 100 };
  }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h / 6) * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(
  h: number,
  s: number,
  l: number
): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;

  if (sat === 0) {
    const v = lig * 255;
    return [v, v, v];
  }

  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
  const p = 2 * lig - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const hk = hue / 360;
  return [
    hue2rgb(hk + 1 / 3) * 255,
    hue2rgb(hk) * 255,
    hue2rgb(hk - 1 / 3) * 255,
  ];
}

/**
 * Acabamento de papel impresso: limita saturação (S <= 70%) e mantém luminosidade
 * entre 18% e 82% para eliminar o aspecto plástico/neon ou preto/branco puros.
 */
export function clampPaperHsl(hex: string): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const clampedS = Math.min(70, Math.max(0, s));
  const clampedL = Math.max(18, Math.min(82, l));
  const [r, g, b] = hslToRgb(h, clampedS, clampedL);
  return toHex(r, g, b);
}

/**
 * Deriva uma segunda cor harmônica (`spineAccent`) a partir da cor principal da lombada
 * por deslocamento de matiz e contraste tonal, mantendo o acabamento de papel.
 */
export function deriveSpineAccentHex(spineHex: string, seed = ""): string {
  const rgb = parseHexRgb(spineHex) ?? [60, 44, 38];
  const { h, s, l } = rgbToHsl(rgb[0], rgb[1], rgb[2]);

  // Deslocamento de matiz determinístico (~32° a 48° ou complementar suave para neutros)
  let seedSum = 0;
  for (let i = 0; i < seed.length; i += 1) {
    seedSum = (seedSum * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const shift = seedSum % 2 === 0 ? 36 : -40;

  // Para neutros escuros (preto/grafite) ou muito claros (marfim), escolhe acento editorial (latão/bordô/sálvia/terracota)
  if (s < 10) {
    const editorialAccents = [
      "#B8935A", // latão
      "#8B3A3A", // carmim fosco
      "#3D6B58", // verde sálvia
      "#47638A", // azul petróleo
      "#A45B38", // terracota
      "#6B4E71", // ameixa seca
    ] as const;
    return clampPaperHsl(editorialAccents[seedSum % editorialAccents.length]!);
  }

  const nextH = (h + shift + 360) % 360;
  const nextS = Math.min(68, Math.max(26, s * 0.92));
  // Se a cor principal for escura, clareia o acento; se for clara, aprofunda o acento
  const nextL = l < 46 ? Math.min(74, l + 24) : Math.max(24, l - 24);
  const [r, g, b] = hslToRgb(nextH, nextS, nextL);
  return toHex(r, g, b);
}

/**
 * Extrai a cor principal e a segunda cor dominante distinta da capa (pixels RGB/RGBA).
 * - Ignora transparência e margens quase brancas.
 * - Pondera por saturação, garantindo boa leitura de capas escuras ou coloridas.
 */
export function pickDominantSpinePalette(
  pixels: ArrayLike<number>,
  channels: 3 | 4 = 3
): { primary: string; accent: string } | null {
  const buckets = new Map<
    number,
    { weight: number; r: number; g: number; b: number }
  >();

  for (let i = 0; i + 2 < pixels.length; i += channels) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const alpha = channels === 4 ? (pixels[i + 3] ?? 255) : 255;
    if (alpha < 128) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min >= 236) continue; // quase branco

    const saturation = max === 0 ? 0 : (max - min) / max;
    const weight = 1 + saturation * 3;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.weight += weight;
      bucket.r += r * weight;
      bucket.g += g * weight;
      bucket.b += b * weight;
    } else {
      buckets.set(key, { weight, r: r * weight, g: g * weight, b: b * weight });
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.weight - a.weight);
  const best = sorted[0];
  if (!best) return null;

  const pR = best.r / best.weight;
  const pG = best.g / best.weight;
  const pB = best.b / best.weight;
  const primary = toHex(pR, pG, pB);

  let accent: string | null = null;
  for (let i = 1; i < sorted.length; i += 1) {
    const cand = sorted[i]!;
    const cR = cand.r / cand.weight;
    const cG = cand.g / cand.weight;
    const cB = cand.b / cand.weight;
    const dist = Math.hypot(cR - pR, cG - pG, cB - pB);
    if (dist >= 54) {
      accent = clampPaperHsl(toHex(cR, cG, cB));
      break;
    }
  }

  return {
    primary,
    accent: accent ?? deriveSpineAccentHex(primary),
  };
}

/**
 * Escolhe a cor predominante entre pixels RGB(A) intercalados.
 * Mantida para compatibilidade com chamadas existentes.
 */
export function pickDominantSpineColor(
  pixels: ArrayLike<number>,
  channels: 3 | 4 = 3
): string | null {
  return pickDominantSpinePalette(pixels, channels)?.primary ?? null;
}
