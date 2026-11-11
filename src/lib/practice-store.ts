"use client";

import { useSyncExternalStore } from "react";
import type { RotationId } from "@/content/rotations";

/** Missed drill items (not MCQs: those live in the study store) and simple drill stats, kept in localStorage. */
const KEY = "for-edith:practice:v1";

export type MistakeKind = "viva" | "spot" | "dose" | "sequence" | "data";

export interface Mistake {
  /** Unique per item, so a repeat miss does not duplicate it. */
  id: string;
  kind: MistakeKind;
  rotation: RotationId;
  /** What to ask when it comes back. */
  prompt: string;
  /** The model answer. */
  answer: string;
  /** Extra explanation. */
  why?: string;
  topic?: string;
  at: number;
}

interface Stats {
  /** YYYY-MM-DD of days with at least one drill item answered. */
  days: string[];
  right: number;
  total: number;
}

interface Data {
  mistakes: Mistake[];
  stats: Stats;
}

const EMPTY: Data = { mistakes: [], stats: { days: [], right: 0, total: 0 } };
let cache: Data | null = null;
const listeners = new Set<() => void>();

function read(): Data {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Data>;
      cache = {
        mistakes: Array.isArray(p.mistakes) ? p.mistakes : [],
        stats: { ...EMPTY.stats, ...(p.stats ?? {}) },
      };
      return cache;
    }
  } catch {}
  cache = EMPTY;
  return cache;
}

function write(next: Data) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
};

/** The saved data; empty on the server and before hydration. */
export function usePracticeData(): Data {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function addMistake(m: Omit<Mistake, "at">) {
  const d = read();
  if (d.mistakes.some((x) => x.id === m.id)) return;
  write({ ...d, mistakes: [{ ...m, at: Date.now() }, ...d.mistakes].slice(0, 300) });
}

export function removeMistake(id: string) {
  const d = read();
  write({ ...d, mistakes: d.mistakes.filter((x) => x.id !== id) });
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Counts one drill answer towards accuracy and the daily streak. */
export function recordDrill(correct: boolean) {
  const d = read();
  const today = dayKey(Date.now());
  write({
    ...d,
    stats: {
      days: d.stats.days.includes(today) ? d.stats.days : [...d.stats.days, today].slice(-60),
      right: d.stats.right + (correct ? 1 : 0),
      total: d.stats.total + 1,
    },
  });
}

/** Consecutive days with drill activity, ending today or yesterday. */
export function dayStreak(days: string[], now = Date.now()): number {
  const set = new Set(days);
  let t = now;
  if (!set.has(dayKey(t))) t -= 86400000;
  let n = 0;
  while (set.has(dayKey(t))) {
    n++;
    t -= 86400000;
  }
  return n;
}
