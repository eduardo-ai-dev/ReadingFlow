import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AMBIENT_PRESETS,
  AMBIENT_SOUNDS,
  DEFAULT_AMBIENT_PREFERENCES,
  MAX_ACTIVE_AMBIENT_LAYERS,
  applyAmbientPreset,
  normalizeAmbientPreferences,
  toggleAmbientLayer,
} from "@/features/reading/ambient-catalog";
import { synthesizeNoiseBuffer } from "@/lib/audio/ambient-engine";

describe("Mixer de sons ambiente — catálogo, regras, presets e licenças", () => {
  it("entrega pelo menos 8 sons de arquivo licenciados e todos os arquivos existem (<= 1 MB) e constam em CREDITS.md", () => {
    const fileSounds = AMBIENT_SOUNDS.filter((s) => s.kind === "file");
    expect(fileSounds.length).toBeGreaterThanOrEqual(8);

    const creditsPath = path.join(
      process.cwd(),
      "public",
      "audio",
      "ambient",
      "CREDITS.md"
    );
    expect(fs.existsSync(creditsPath)).toBe(true);
    const creditsText = fs.readFileSync(creditsPath, "utf8");

    for (const sound of fileSounds) {
      expect(sound.src).toBeTruthy();
      const rel = sound.src!.replace(/^\//, "");
      const abs = path.join(process.cwd(), "public", rel);
      expect(fs.existsSync(abs)).toBe(true);
      const stat = fs.statSync(abs);
      expect(stat.size).toBeGreaterThan(10_000);
      expect(stat.size).toBeLessThanOrEqual(1_050_000);
      expect(creditsText).toContain(path.basename(abs));
    }
  });

  it("impõe limite rígido de 3 camadas simultâneas com retorno claro", () => {
    let prefs = DEFAULT_AMBIENT_PREFERENCES;

    const r1 = toggleAmbientLayer(prefs, "chuva-suave");
    expect(r1.ok).toBe(true);
    if (r1.ok) prefs = r1.next;

    const r2 = toggleAmbientLayer(prefs, "lareira");
    expect(r2.ok).toBe(true);
    if (r2.ok) prefs = r2.next;

    const r3 = toggleAmbientLayer(prefs, "vento");
    expect(r3.ok).toBe(true);
    if (r3.ok) prefs = r3.next;

    expect(prefs.selectedIds).toHaveLength(MAX_ACTIVE_AMBIENT_LAYERS);

    // 4ª camada deve ser bloqueada
    const r4 = toggleAmbientLayer(prefs, "cafeteria");
    expect(r4.ok).toBe(false);
    if (!r4.ok) {
      expect(r4.reason).toBe("max_layers");
      expect(r4.maxLayers).toBe(3);
    }

    // Desativar uma camada libera espaço
    const rRemove = toggleAmbientLayer(prefs, "lareira");
    expect(rRemove.ok).toBe(true);
    if (rRemove.ok) {
      expect(rRemove.added).toBe(false);
      expect(rRemove.next.selectedIds).toEqual(["chuva-suave", "vento"]);
    }
  });

  it("aplica presets curados mantendo no máximo 3 camadas e volumes válidos", () => {
    expect(AMBIENT_PRESETS.map((p) => p.label)).toEqual(
      expect.arrayContaining([
        "Chuva na janela",
        "Lareira e chuva",
        "Biblioteca à noite",
        "Cafeteria",
      ])
    );

    for (const preset of AMBIENT_PRESETS) {
      const next = applyAmbientPreset(DEFAULT_AMBIENT_PREFERENCES, preset.id);
      expect(next).not.toBeNull();
      expect(next!.selectedIds.length).toBeGreaterThan(0);
      expect(next!.selectedIds.length).toBeLessThanOrEqual(
        MAX_ACTIVE_AMBIENT_LAYERS
      );
      for (const id of next!.selectedIds) {
        const vol = next!.volumes[id];
        expect(typeof vol).toBe("number");
        expect(vol!).toBeGreaterThanOrEqual(0);
        expect(vol!).toBeLessThanOrEqual(1);
      }
    }
  });

  it("normaliza preferências inválidas e mantém continueAcrossPages desligado por padrão", () => {
    const normalized = normalizeAmbientPreferences({
      selectedIds: [
        "chuva-suave",
        "chuva-suave",
        "lareira",
        "vento",
        "cafeteria",
      ],
      volumes: { "chuva-suave": 1.8, lareira: -0.5 },
      masterVolume: 2.5,
    });

    expect(normalized.selectedIds).toEqual(["chuva-suave", "lareira", "vento"]);
    expect(normalized.volumes["chuva-suave"]).toBe(1);
    expect(normalized.volumes["lareira"]).toBe(0);
    expect(normalized.masterVolume).toBe(1);
    expect(normalized.continueAcrossPages).toBe(false);
  });

  it("sintetiza buffers de ruído branco, rosa e marrom sem ScriptProcessor e com amostras finitas", () => {
    const fakeCtx = {
      sampleRate: 8000,
      createBuffer: (_ch: number, len: number, sr: number) => {
        const arr = new Float32Array(len);
        return {
          length: len,
          sampleRate: sr,
          numberOfChannels: 1,
          getChannelData: () => arr,
        } as unknown as AudioBuffer;
      },
    } as unknown as BaseAudioContext;

    for (const id of ["ruido-branco", "ruido-rosa", "ruido-marrom"] as const) {
      const buf = synthesizeNoiseBuffer(fakeCtx, id, 2);
      const data = buf.getChannelData(0);
      expect(data.length).toBe(16000);
      let maxAbs = 0;
      for (let i = 0; i < data.length; i++) {
        expect(Number.isFinite(data[i])).toBe(true);
        const a = Math.abs(data[i]!);
        if (a > maxAbs) maxAbs = a;
      }
      expect(maxAbs).toBeGreaterThan(0.01);
      expect(maxAbs).toBeLessThanOrEqual(1);
    }
  });
});
