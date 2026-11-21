"use client";

import { useEffect, useState } from "react";

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Amostra a cor predominante da capa em um `<canvas>` 16×16 oculto com fallback
 * seguro para a cor determinística da paleta em caso de bloqueio CORS ou erro.
 * Ajusta luminância máxima para manter contraste AA da tipografia clara na lombada.
 */
export function useDominantCoverColor(
  coverUrl: string | undefined,
  fallbackColor: string
): string {
  const [sampled, setSampled] = useState<{ url: string; hex: string } | null>(
    null
  );

  useEffect(() => {
    if (!coverUrl || typeof window === "undefined") return;
    // Amostragem de pixels só roda em fontes sem restrição de CORS (data:, blob: ou mesma origem)
    // para nunca gerar erros de CORS no console do navegador.
    const isSameOrigin =
      coverUrl.startsWith("/") || coverUrl.startsWith(window.location.origin);
    if (!coverUrl.startsWith("data:") && !coverUrl.startsWith("blob:") && !isSameOrigin) {
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let weightSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3] ?? 0;
          if (alpha < 128) continue;

          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

          // Ignora branco de papel ou preto quase absoluto para capturar a cor editorial da capa
          if (lum > 235 || lum < 12) continue;

          const saturationWeight = 1 + ((max - min) / 255) * 2.4;
          rSum += r * saturationWeight;
          gSum += g * saturationWeight;
          bSum += b * saturationWeight;
          weightSum += saturationWeight;
        }

        if (weightSum <= 0) return;

        let rAvg = rSum / weightSum;
        let gAvg = gSum / weightSum;
        let bAvg = bSum / weightSum;

        // Mantém fundo escuro suficiente para contraste >= 4.5:1 com tipografia clara (#F4EFE6)
        const lumAvg = 0.2126 * rAvg + 0.7152 * gAvg + 0.0722 * bAvg;
        if (lumAvg > 92) {
          const scale = 92 / lumAvg;
          rAvg *= scale;
          gAvg *= scale;
          bAvg *= scale;
        }

        if (!cancelled) {
          setSampled({
            url: coverUrl,
            hex: rgbToHex(rAvg, gAvg, bAvg),
          });
        }
      } catch {
        // SecurityError (CORS) ou erro de leitura: mantém fallback determinístico da paleta
      }
    };

    img.onerror = () => {
      // Silencioso: mantém fallback determinístico da paleta
    };

    img.src = coverUrl;
    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  if (coverUrl && sampled && sampled.url === coverUrl) {
    return sampled.hex;
  }
  return fallbackColor;
}
