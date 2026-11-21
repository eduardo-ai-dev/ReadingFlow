"use client";

import {
  EMPTY_PERSISTED_SHELF_LAYOUT,
  parsePersistedShelfLayout,
  SHELF_LAYOUT_STORAGE_KEY,
  type PersistedShelfLayout,
} from "@/features/shelves/arrange-shelves";

const SHELF_LAYOUT_CHANGE_EVENT = "readingflow:shelf-layout-change";

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedParsed: PersistedShelfLayout = EMPTY_PERSISTED_SHELF_LAYOUT;

function notifyAll(): void {
  for (const listener of listeners) {
    listener();
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SHELF_LAYOUT_CHANGE_EVENT));
  }
}

export function getServerShelfLayoutSnapshot(): PersistedShelfLayout {
  return EMPTY_PERSISTED_SHELF_LAYOUT;
}

export function getClientShelfLayoutSnapshot(): PersistedShelfLayout {
  if (typeof window === "undefined") return EMPTY_PERSISTED_SHELF_LAYOUT;
  try {
    const raw = window.localStorage.getItem(SHELF_LAYOUT_STORAGE_KEY);
    if (!raw) {
      cachedRaw = null;
      cachedParsed = EMPTY_PERSISTED_SHELF_LAYOUT;
      return EMPTY_PERSISTED_SHELF_LAYOUT;
    }
    if (raw === cachedRaw) {
      return cachedParsed;
    }
    cachedRaw = raw;
    cachedParsed = parsePersistedShelfLayout(raw);
    return cachedParsed;
  } catch {
    return EMPTY_PERSISTED_SHELF_LAYOUT;
  }
}

export function subscribeShelfLayout(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SHELF_LAYOUT_STORAGE_KEY || e.key === null) {
      cachedRaw = null;
      listener();
    }
  };
  const onCustom = () => {
    listener();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    window.addEventListener(SHELF_LAYOUT_CHANGE_EVENT, onCustom);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SHELF_LAYOUT_CHANGE_EVENT, onCustom);
    }
  };
}

export function writeShelfLayout(next: PersistedShelfLayout | null): void {
  if (typeof window === "undefined") return;
  try {
    if (next === null) {
      window.localStorage.removeItem(SHELF_LAYOUT_STORAGE_KEY);
      cachedRaw = null;
      cachedParsed = EMPTY_PERSISTED_SHELF_LAYOUT;
    } else {
      const serialized = JSON.stringify(next);
      const normalized = parsePersistedShelfLayout(serialized);
      const canonical = JSON.stringify(normalized);
      window.localStorage.setItem(SHELF_LAYOUT_STORAGE_KEY, canonical);
      cachedRaw = canonical;
      cachedParsed = normalized;
    }
    notifyAll();
  } catch {
    // Ignora falhas de quota de armazenamento
  }
}

export function updateShelfLayout(
  updater: (prev: PersistedShelfLayout) => PersistedShelfLayout
): void {
  const current = getClientShelfLayoutSnapshot();
  writeShelfLayout(updater(current));
}
