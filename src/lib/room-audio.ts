"use client";

import { useSyncExternalStore } from "react";

interface RoomState {
  isSoundEnabled: boolean;
  isLightOn: boolean;
}

let state: RoomState = {
  isSoundEnabled: true,
  isLightOn: true,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RoomState {
  return state;
}

const SERVER_SNAPSHOT: RoomState = {
  isSoundEnabled: true,
  isLightOn: true,
};

function getServerSnapshot(): RoomState {
  return SERVER_SNAPSHOT;
}

export function toggleRoomSound() {
  state = { ...state, isSoundEnabled: !state.isSoundEnabled };
  emitChange();
  if (state.isSoundEnabled) {
    playSoftTickSound();
  }
}

export function toggleRoomLight(nextValue?: boolean) {
  const next = typeof nextValue === "boolean" ? nextValue : !state.isLightOn;
  if (next === state.isLightOn) return;
  state = { ...state, isLightOn: next };
  emitChange();
  playLampPullSound(next);
}

export function useRoomState(): RoomState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

let audioCtx: AudioContext | null = null;
let lastHoverSoundAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!state.isSoundEnabled) return null;

  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) {
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Som mecânico realista de interruptor de cordão (pull-chain click-clack).
 */
export function playLampPullSound(turningOn: boolean) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1º estágio: clique metálico da corrente
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(turningOn ? 1150 : 920, now);
    osc1.frequency.exponentialRampToValueAtTime(turningOn ? 420 : 310, now + 0.032);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.14, now + 0.004);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.036);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.04);

    // 2º estágio: retorno da mola interna (~45ms depois)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(turningOn ? 1680 : 1240, now + 0.045);
    osc2.frequency.exponentialRampToValueAtTime(turningOn ? 680 : 480, now + 0.085);

    gain2.gain.setValueAtTime(0.001, now + 0.045);
    gain2.gain.linearRampToValueAtTime(0.09, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.045);
    osc2.stop(now + 0.095);
  } catch {
    // Silencioso caso o navegador bloqueie Web Audio antes do primeiro clique
  }
}

/**
 * Toque sutil de madeira/tecido ao deslizar o cursor pelas lombadas.
 */
export function playBookHoverSound(index = 0) {
  const nowMs = Date.now();
  if (nowMs - lastHoverSoundAt < 55) return;
  lastHoverSoundAt = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = 290 + (index % 12) * 18;
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.58, now + 0.028);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.032, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.032);
  } catch {}
}

/**
 * Som suave de livro saindo da prateleira / folhear capa.
 */
export function playBookOpenSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.09);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.25;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  } catch {}
}

function playSoftTickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.032);
  } catch {}
}

