"use client";

import {
  AMBIENT_FADE_MS,
  AMBIENT_SOUND_BY_ID,
  MAX_ACTIVE_AMBIENT_LAYERS,
  clampVolume,
  type AmbientSoundId,
} from "@/features/reading/ambient-catalog";

interface ActiveLayerNodes {
  source: AudioBufferSourceNode;
  gain: GainNode;
  volume: number;
}

/**
 * Gera buffer mono contínuo (loop sem estalo com crossfade de 0,5 s nas pontas)
 * para ruído branco, rosa (filtro Paul Kellet) e marrom, sem usar ScriptProcessor.
 */
export function synthesizeNoiseBuffer(
  ctx: BaseAudioContext,
  noiseId: "ruido-branco" | "ruido-rosa" | "ruido-marrom",
  durationSeconds = 10
): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const totalSamples = Math.max(
    sampleRate * 2,
    Math.floor(sampleRate * durationSeconds)
  );
  const fadeSamples = Math.min(
    Math.floor(sampleRate * 0.5),
    Math.floor(totalSamples / 4)
  );
  const rawLen = totalSamples + fadeSamples;
  const raw = new Float32Array(rawLen);

  if (noiseId === "ruido-branco") {
    for (let i = 0; i < rawLen; i++) {
      raw[i] = (Math.random() * 2 - 1) * 0.16;
    }
  } else if (noiseId === "ruido-rosa") {
    // Aproximação Paul Kellet (suave e sem picos agressivos)
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < rawLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      raw[i] = pink * 0.045;
    }
  } else {
    // Ruído marrom com leaky integrator (sem drift DC)
    let last = 0;
    for (let i = 0; i < rawLen; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      raw[i] = last * 0.65;
    }
  }

  // Overlap-add crossfade de cosseno igual-potência para loop 100% sem costura
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const out = buffer.getChannelData(0);
  for (let i = 0; i < totalSamples; i++) {
    out[i] = raw[i]!;
  }
  for (let i = 0; i < fadeSamples; i++) {
    const t = i / fadeSamples;
    const fadeIn = Math.sin(t * Math.PI * 0.5);
    const fadeOut = Math.cos(t * Math.PI * 0.5);
    out[i] = raw[i]! * fadeIn + raw[totalSamples + i]! * fadeOut;
  }

  return buffer;
}

/**
 * Motor Web Audio singleton para o mixer do Canto de Foco:
 * - Um único `AudioContext` criado e resumido SOMENTE após gesto explícito do usuário.
 * - `AudioBufferSourceNode` com `loop = true`, `GainNode` por camada e `GainNode` mestre.
 * - Fade suave (~800 ms) ao ligar, desligar, aplicar preset, silenciar ou encerrar timer.
 * - Fetch sob demanda + cache de `AudioBuffer` em memória.
 * - Limite rígido de 3 camadas simultâneas.
 */
class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 0.75;
  private activeLayers = new Map<AmbientSoundId, ActiveLayerNodes>();
  private bufferCache = new Map<AmbientSoundId, AudioBuffer>();
  private loadingPromises = new Map<AmbientSoundId, Promise<AudioBuffer>>();
  private stopTimers = new Map<AmbientSoundId, number>();
  private visibilityBound = false;

  private ensureVisibilityListener(): void {
    if (this.visibilityBound || typeof document === "undefined") return;
    this.visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        this.activeLayers.size > 0 &&
        this.ctx &&
        this.ctx.state === "suspended"
      ) {
        void this.ctx.resume().catch(() => {});
      }
    });
  }

  /** Cria ou retoma o AudioContext único — chamar apenas dentro de handler de clique/tecla. */
  private async ensureContext(): Promise<AudioContext> {
    if (typeof window === "undefined") {
      throw new Error("AudioContext indisponível fora do navegador.");
    }
    this.ensureVisibilityListener();
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        throw new Error("Web Audio API indisponível neste navegador.");
      }
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.masterVolume,
        this.ctx.currentTime
      );
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  private async loadBuffer(id: AmbientSoundId): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(id);
    if (cached) return cached;

    const existingPromise = this.loadingPromises.get(id);
    if (existingPromise) return existingPromise;

    const promise = (async () => {
      const ctx = await this.ensureContext();
      const spec = AMBIENT_SOUND_BY_ID[id];

      if (spec.kind === "noise") {
        const buffer = synthesizeNoiseBuffer(
          ctx,
          id as "ruido-branco" | "ruido-rosa" | "ruido-marrom"
        );
        this.bufferCache.set(id, buffer);
        return buffer;
      }

      if (!spec.src) {
        throw new Error(`Som "${id}" sem arquivo de áudio configurado.`);
      }

      const response = await fetch(spec.src, { cache: "force-cache" });
      if (!response.ok) {
        throw new Error(
          `Falha ao carregar áudio "${spec.label}" (HTTP ${response.status}).`
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(id, decoded);
      return decoded;
    })();

    this.loadingPromises.set(id, promise);
    try {
      return await promise;
    } finally {
      this.loadingPromises.delete(id);
    }
  }

  isPlayingAny(): boolean {
    return this.activeLayers.size > 0;
  }

  getActiveIds(): AmbientSoundId[] {
    return Array.from(this.activeLayers.keys());
  }

  async startLayer(
    id: AmbientSoundId,
    volume: number,
    fadeMs = AMBIENT_FADE_MS
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const targetVol = clampVolume(volume);

    // Se já está tocando, apenas ajusta volume com fade
    const existing = this.activeLayers.get(id);
    if (existing) {
      this.cancelPendingStop(id);
      this.setLayerVolume(id, targetVol, 180);
      return { ok: true };
    }

    if (this.activeLayers.size >= MAX_ACTIVE_AMBIENT_LAYERS) {
      return {
        ok: false,
        error: `Limite de ${MAX_ACTIVE_AMBIENT_LAYERS} sons simultâneos atingido.`,
      };
    }

    try {
      const ctx = await this.ensureContext();
      const buffer = await this.loadBuffer(id);

      // Revalida caso o usuário tenha ativado outra camada durante o carregamento assíncrono
      if (this.activeLayers.has(id)) {
        this.setLayerVolume(id, targetVol, 180);
        return { ok: true };
      }
      if (this.activeLayers.size >= MAX_ACTIVE_AMBIENT_LAYERS) {
        return {
          ok: false,
          error: `Limite de ${MAX_ACTIVE_AMBIENT_LAYERS} sons simultâneos atingido.`,
        };
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(
        Math.max(0.0001, targetVol),
        now + fadeMs / 1000
      );

      source.connect(gain);
      gain.connect(this.masterGain!);
      source.start(now);

      this.activeLayers.set(id, { source, gain, volume: targetVol });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Não foi possível iniciar este som ambiente.",
      };
    }
  }

  private cancelPendingStop(id: AmbientSoundId): void {
    const timer = this.stopTimers.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.stopTimers.delete(id);
    }
  }

  stopLayer(id: AmbientSoundId, fadeMs = AMBIENT_FADE_MS): void {
    const layer = this.activeLayers.get(id);
    if (!layer) return;

    this.cancelPendingStop(id);
    this.activeLayers.delete(id);

    const ctx = this.ctx;
    if (!ctx || ctx.state === "closed" || fadeMs <= 0) {
      this.cleanupLayerNodes(layer);
      return;
    }

    try {
      const now = ctx.currentTime;
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setValueAtTime(
        Math.max(0.0001, layer.gain.gain.value),
        now
      );
      layer.gain.gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
    } catch {
      this.cleanupLayerNodes(layer);
      return;
    }

    const timer = window.setTimeout(() => {
      this.stopTimers.delete(id);
      this.cleanupLayerNodes(layer);
    }, fadeMs + 60);
    this.stopTimers.set(id, timer);
  }

  private cleanupLayerNodes(layer: ActiveLayerNodes): void {
    try {
      layer.source.stop();
    } catch {
      // Já parado
    }
    try {
      layer.source.disconnect();
      layer.gain.disconnect();
    } catch {
      // Já desconectado
    }
  }

  setLayerVolume(id: AmbientSoundId, volume: number, rampMs = 120): void {
    const layer = this.activeLayers.get(id);
    if (!layer || !this.ctx || this.ctx.state === "closed") return;
    const clamped = clampVolume(volume);
    layer.volume = clamped;
    const now = this.ctx.currentTime;
    layer.gain.gain.cancelScheduledValues(now);
    layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
    layer.gain.gain.linearRampToValueAtTime(
      Math.max(0.0001, clamped),
      now + rampMs / 1000
    );
  }

  setMasterVolume(volume: number, rampMs = 120): void {
    const clamped = clampVolume(volume);
    this.masterVolume = clamped;
    if (!this.masterGain || !this.ctx || this.ctx.state === "closed") return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(
      Math.max(0.0001, clamped),
      now + rampMs / 1000
    );
  }

  stopAll(fadeMs = AMBIENT_FADE_MS): void {
    const ids = Array.from(this.activeLayers.keys());
    for (const id of ids) {
      this.stopLayer(id, fadeMs);
    }
  }

  /** Libera nós ativos imediatamente (útil em encerramento forçado/desmontagem). */
  disposeImmediate(): void {
    for (const timer of this.stopTimers.values()) {
      window.clearTimeout(timer);
    }
    this.stopTimers.clear();
    for (const layer of this.activeLayers.values()) {
      this.cleanupLayerNodes(layer);
    }
    this.activeLayers.clear();
  }
}

export const ambientAudioEngine = new AmbientAudioEngine();
