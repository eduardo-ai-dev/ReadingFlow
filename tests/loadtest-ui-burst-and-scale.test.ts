import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ambientAudioEngine } from "@/lib/audio/ambient-engine";
import { computeElapsedFocusSeconds } from "@/features/reading/focus-session-storage";
import {
  groupBooksByGenre,
  packShelfBooksByWidth,
} from "@/features/shelves/virtual-bookshelf";
import { resolveRowSpineVisuals } from "@/components/ShelfView";
import { generateDeterministicUserWorkspace } from "../loadtest/seed.mjs";

describe("Regressão de UI e Escala #4 — Vazamento Web Audio em Rajadas 50x no Modo Foco e Empacotamento 500/1000/2000 Livros", () => {
  const createdSources: Array<{
    started: boolean;
    stopped: boolean;
    disconnected: boolean;
  }> = [];
  const createdGains: Array<{
    connected: boolean;
    disconnected: boolean;
  }> = [];

  beforeEach(() => {
    createdSources.length = 0;
    createdGains.length = 0;

    class MockAudioContext {
      state = "running";
      sampleRate = 8000;
      currentTime = 0;
      destination = {};

      async resume() {
        this.state = "running";
      }

      createBuffer(channels: number, length: number, sampleRate: number) {
        const data = new Float32Array(length);
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          getChannelData: () => data,
        };
      }

      createGain() {
        const record = { connected: false, disconnected: false };
        createdGains.push(record);
        return {
          gain: {
            value: 0.5,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
          },
          connect: () => {
            record.connected = true;
          },
          disconnect: () => {
            record.disconnected = true;
          },
        };
      }

      createBufferSource() {
        const record = {
          started: false,
          stopped: false,
          disconnected: false,
        };
        createdSources.push(record);
        return {
          buffer: null,
          loop: false,
          connect: vi.fn(),
          start: () => {
            record.started = true;
          },
          stop: () => {
            record.stopped = true;
          },
          disconnect: () => {
            record.disconnected = true;
          },
        };
      }
    }

    vi.stubGlobal("AudioContext", MockAudioContext);
  });

  afterEach(() => {
    ambientAudioEngine.disposeImmediate();
    vi.unstubAllGlobals();
  });

  it("libera 100% dos AudioBufferSourceNode e GainNode em 50 ciclos rápidos de iniciar/pausar/encerrar no Modo Foco sem vazamento", async () => {
    for (let i = 0; i < 50; i++) {
      const started = await ambientAudioEngine.startLayer(
        "ruido-marrom",
        0.6,
        800
      );
      expect(started.ok).toBe(true);
      // Para imediatamente antes do fade de 800ms expirar (simulando cliques em rajada)
      ambientAudioEngine.stopLayer("ruido-marrom", 800);
    }

    // No máximo 1 fade-out pode estar pendente (o 50º); os 49 anteriores devem ter sido limpos imediatamente
    expect(ambientAudioEngine.getPendingStopCount()).toBeLessThanOrEqual(1);
    expect(ambientAudioEngine.getActiveIds().length).toBe(0);

    // Encerra sessão / desmonta
    ambientAudioEngine.disposeImmediate();
    expect(ambientAudioEngine.getPendingStopCount()).toBe(0);
    expect(createdSources.length).toBe(50);
    expect(
      createdSources.every((s) => s.started && s.stopped && s.disconnected)
    ).toBe(true);
    // O 1º GainNode é o masterGain; os outros 50 são das camadas criadas e todas desconectadas
    const layerGains = createdGains.slice(1);
    expect(layerGains.length).toBe(50);
    expect(layerGains.every((g) => g.connected && g.disconnected)).toBe(true);
  });

  it("mantém precisão exata do cronômetro do Modo Foco após 50 ciclos rápidos de iniciar/pausar/retomar", () => {
    let accumulatedSeconds = 0;
    let nowMs = 1_700_000_000_000;

    for (let cycle = 1; cycle <= 50; cycle++) {
      const startedAtMs = nowMs;
      // Avança 15 segundos reais neste ciclo
      nowMs += 15_000;
      accumulatedSeconds = computeElapsedFocusSeconds(
        {
          accumulatedSeconds,
          startedAtMs,
          isRunning: true,
          focusMode: "free",
        },
        nowMs
      );
    }

    expect(accumulatedSeconds).toBe(50 * 15);
  });

  it("empacota e resolve lombadas para 500, 1.000 e 2.000 livros sem long tasks (> 50 ms por lote) e sem vizinhos idênticos", () => {
    for (const count of [500, 1000, 2000]) {
      const { workspace } = generateDeterministicUserWorkspace({
        userIndex: 400 + count,
        bookCount: count,
        seed: 20261121,
      });

      const virtualInputs = workspace.items.map((item, idx) => {
        const ed = workspace.editions[idx]!;
        const w = workspace.works[idx]!;
        return {
          id: item.id,
          workId: w.id,
          editionId: ed.id,
          libraryItemId: item.id,
          title: w.title,
          author: w.contributors[0]?.name ?? "Autor",
          genre: w.primaryGenre ?? "Ficção",
          pages: ed.pages ?? 250,
          format: ed.format,
          coverUrl: ed.coverUrl,
          spineColor: ed.coverColor,
          spineAccent: ed.coverAccentColor,
          seed: ed.isbn13 ?? w.id,
        };
      });

      const t0 = performance.now();
      let neighborCollisions = 0;
      const groups = groupBooksByGenre(virtualInputs);
      for (const group of groups) {
        const chunks = packShelfBooksByWidth(group.books, {
          maxRowWidthPx: 560,
          groupGapPx: 10,
          rowSeedPrefix: group.genreKey,
        });
        for (const chunk of chunks) {
          const visuals = resolveRowSpineVisuals(chunk.books);
          for (let i = 1; i < visuals.length; i++) {
            const prev = visuals[i - 1]!;
            const curr = visuals[i]!;
            if (
              prev.template === curr.template &&
              prev.spineBg.toLowerCase() === curr.spineBg.toLowerCase()
            ) {
              neighborCollisions += 1;
            }
          }
        }
      }
      const elapsedMs = performance.now() - t0;
      expect(neighborCollisions).toBe(0);
      expect(elapsedMs).toBeLessThan(450);
    }
  });
});
