"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronLeft } from "lucide-react";
import { ROTATIONS } from "@/content/rotations";
import { TOPIC_BY_SLUG } from "@/content/curriculum";
import { useRotation } from "@/lib/use-rotation";

/** Back link, drill name and a right-hand status (score, streak, clock). */
export function DrillHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-1">
      <Link href="/practice" aria-label="Back to practice" className="-ml-2 grid h-10 w-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
        <ChevronLeft size={20} />
      </Link>
      <h1 className="flex-1 text-[15px] font-semibold">{title}</h1>
      {right && <div className="text-[13px] font-semibold text-brand-text tabular-nums">{right}</div>}
    </div>
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3", className)}>{children}</div>;
}

/** Green or red result box with an explanation under a headline. */
export function Verdict({ ok, title, children }: { ok: boolean; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section
      role="status"
      className={clsx("flex flex-col gap-1.5 rounded-2xl border p-4", ok ? "border-good/30 bg-good-soft" : "border-bad/30 bg-bad-soft")}
    >
      <div className={clsx("text-[14px] font-semibold", ok ? "text-good" : "text-bad")}>{title}</div>
      {children && <div className="text-[14px] leading-relaxed text-ink">{children}</div>}
    </section>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-ink-3">{children}</div>;
}

/** Start screen shared by the drills: what it is, the rotation, a big start button. */
export function StartCard({ title, children, count, noun, onStart }: { title: string; children: React.ReactNode; count: number; noun: string; onStart: () => void }) {
  const { rotation } = useRotation();
  return (
    <div className="card flex flex-col gap-3 p-5" data-rot-scoped>
      <h2 className="font-serif text-[30px] leading-none">{title}</h2>
      <p className="text-[14.5px] leading-relaxed text-ink-2">{children}</p>
      <p className="text-[13px] text-ink-3">
        {rotation.name} · {count} {noun}
      </p>
      <button className="btn btn-pink min-h-12 text-[15px]" onClick={onStart} disabled={!count}>
        Start round
      </button>
    </div>
  );
}

export function RoundSummary({ score, total, children, onAgain }: { score: number; total: number; children?: React.ReactNode; onAgain: () => void }) {
  return (
    <div className="flex flex-col gap-3.5 py-2">
      <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-brand-text">Round complete</div>
      <div className="font-serif text-[56px] leading-none">
        {score} / {total}
      </div>
      {children}
      <button className="btn btn-primary min-h-12 text-[15px]" onClick={onAgain}>
        New round
      </button>
      <Link href="/practice" className="text-center text-[14px] font-medium text-brand-text">
        Back to practice
      </Link>
    </div>
  );
}

/** Link to a topic's notes when the slug exists. */
export function TopicLink({ slug }: { slug?: string }) {
  const t = slug ? TOPIC_BY_SLUG[slug] : undefined;
  if (!t) return null;
  return (
    <Link href={`/topics/${t.slug}`} className="text-[13px] font-medium text-brand-text">
      Read: {t.title}
    </Link>
  );
}

export const rotationName = (id: keyof typeof ROTATIONS) => ROTATIONS[id].name;

export const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/**
 * Seconds left while `running`; calls `onExpire` once when it reaches 0. Deadline-based, so it stays
 * right when the tab is in the background. Remount (change `key`) to restart.
 */
export function useCountdown(seconds: number, running: boolean, onExpire: () => void) {
  const [left, setLeft] = useState(seconds);
  const leftRef = useRef(seconds);
  const cb = useRef(onExpire);
  useEffect(() => {
    cb.current = onExpire;
  });
  useEffect(() => {
    if (!running) return;
    const end = Date.now() + leftRef.current * 1000;
    const t = setInterval(() => {
      const l = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      leftRef.current = l;
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        cb.current();
      }
    }, 250);
    return () => clearInterval(t);
  }, [running]);
  return left;
}

/** The 30-second ring: a conic gradient with the seconds in the middle. */
export function TimerRing({ left, total }: { left: number; total: number }) {
  const low = left <= Math.min(10, total / 3);
  return (
    <span
      role="timer"
      aria-label={`${left} seconds left`}
      className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${low ? "var(--bad)" : "var(--brand)"} ${Math.round((left / total) * 360)}deg, var(--brand-line) 0)` }}
    >
      <span className={clsx("grid h-[38px] w-[38px] place-items-center rounded-full bg-surface text-[15px] font-semibold tabular-nums", low ? "text-bad" : "text-ink")}>{left}</span>
    </span>
  );
}

/** Sticky-ish bottom action row, kept above the phone's bottom nav. */
export function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex gap-2">{children}</div>;
}

/** Pool filtered to the active rotation (with a fallback note when it is empty). */
export function usePool<T extends { rotation: string }>(items: T[]): T[] {
  const { id } = useRotation();
  return useMemo(() => items.filter((i) => i.rotation === id), [items, id]);
}

/** Renders **bold**, *italic* and `code` from notes text inline (no block markdown). */
export function Inline({ children }: { children: string }) {
  const parts = children.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
        ) : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded bg-surface-3 px-1 text-[0.9em]">{p.slice(1, -1)}</code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
