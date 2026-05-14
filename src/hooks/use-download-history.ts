"use client";

import { useCallback, useSyncExternalStore } from "react";
import { HISTORY_MAX_ENTRIES, HISTORY_STORAGE_KEY } from "@/lib/constants";
import type { DownloadHistoryEntry } from "@/types/video";

const subscribers = new Set<() => void>();
const EMPTY_LIST: DownloadHistoryEntry[] = [];

function notifyLocal() {
  for (const fn of subscribers) fn();
}

function safeRead(): DownloadHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is DownloadHistoryEntry =>
        typeof e === "object" && e !== null && typeof e.id === "string"
    );
  } catch {
    return [];
  }
}

function safeWrite(entries: DownloadHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
    notifyLocal();
  } catch {
    // quota or disabled storage — ignore
  }
}

// Cache snapshot to satisfy useSyncExternalStore's referential-equality contract.
let cachedSnapshot: DownloadHistoryEntry[] | null = null;
let cachedRaw: string | null = null;

function getSnapshot(): DownloadHistoryEntry[] {
  if (typeof window === "undefined") return EMPTY_LIST;
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = safeRead();
  }
  return cachedSnapshot ?? EMPTY_LIST;
}

function getServerSnapshot(): DownloadHistoryEntry[] {
  return EMPTY_LIST;
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === HISTORY_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subscribers.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDownloadHistory() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((entry: DownloadHistoryEntry) => {
    const current = safeRead();
    const next = [entry, ...current.filter((e) => e.id !== entry.id)].slice(
      0,
      HISTORY_MAX_ENTRIES
    );
    safeWrite(next);
  }, []);

  const update = useCallback((id: string, patch: Partial<DownloadHistoryEntry>) => {
    const next = safeRead().map((e) => (e.id === id ? { ...e, ...patch } : e));
    safeWrite(next);
  }, []);

  const remove = useCallback((id: string) => {
    const next = safeRead().filter((e) => e.id !== id);
    safeWrite(next);
  }, []);

  const clear = useCallback(() => {
    safeWrite([]);
  }, []);

  return { entries, add, update, remove, clear };
}
