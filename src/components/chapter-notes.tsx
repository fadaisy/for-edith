"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import type { Heading, NoteChapter } from "@/lib/types";

/** What the client needs to know about a section (its rendered content is passed separately). */
export interface ChapterSection {
  key: number;
  n: number | null;
  title: string;
  id: string;
  chapter: number;
  minutes: number;
  parts: Heading[];
}

interface ChapterState {
  chapters: NoteChapter[];
  sections: ChapterSection[];
  current: number;
  open: Record<number, boolean>;
  read: number[];
  go: (i: number) => void;
  toggle: (key: number) => void;
  setChapterOpen: (chapter: number, open: boolean) => void;
  reveal: (id: string) => boolean;
  markRead: (i: number) => void;
}

const Ctx = createContext<ChapterState | null>(null);
const useChapters = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("Chapter components must be inside <ChapterProvider>");
  return c;
};

/** Tab names handled by TopicTabs (#quiz etc.), not section ids. */
const TAB_IDS = ["notes", "cards", "quiz", "cases", "mine", "sources"];
const storageKey = (slug: string) => `for-edith:chapters-read:${slug}`;

/**
 * Chapter state for structured notes: the open chapter, which sections are unfolded and which
 * chapters have been read (saved per topic on this device). Wraps both the notes and the aside.
 */
export function ChapterProvider({
  slug,
  chapters,
  sections,
  children,
}: {
  slug: string;
  chapters: NoteChapter[];
  sections: ChapterSection[];
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState(0);
  // The first section of every chapter starts unfolded.
  const [open, setOpen] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(chapters.map((_, i) => sections.find((s) => s.chapter === i)).flatMap((s) => (s ? [[s.key, true]] : []))),
  );
  const [read, setRead] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<{ id: string; seq: number } | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(slug)) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore this device's reading progress after hydration
      if (Array.isArray(saved)) setRead(saved.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < chapters.length));
    } catch {
      /* storage unavailable: progress is not remembered */
    }
    setLoaded(true);
  }, [slug, chapters.length]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify(read));
    } catch {
      /* storage unavailable */
    }
  }, [slug, read, loaded]);

  const markRead = useCallback((i: number) => setRead((r) => (r.includes(i) ? r : [...r, i].sort())), []);

  const go = useCallback(
    (i: number) => {
      if (i > current) markRead(current);
      setCurrent(i);
      // From the bottom of a chapter, go back up to the chapter tabs.
      const nav = document.getElementById("chapter-nav");
      if (nav && nav.getBoundingClientRect().top < 0) requestAnimationFrame(() => nav.scrollIntoView({ block: "start" }));
    },
    [current, markRead],
  );

  const toggle = useCallback((key: number) => setOpen((o) => ({ ...o, [key]: !o[key] })), []);
  const setChapterOpen = useCallback(
    (chapter: number, value: boolean) =>
      setOpen((o) => ({ ...o, ...Object.fromEntries(sections.filter((s) => s.chapter === chapter).map((s) => [s.key, value])) })),
    [sections],
  );

  /** Opens the chapter and section holding `id` (a section or subsection id) and scrolls to it. */
  const reveal = useCallback(
    (id: string) => {
      let target = id;
      let sec = sections.find((s) => s.id === id || s.parts.some((p) => p.id === id));
      if (!sec) {
        const host = document.getElementById(id)?.closest<HTMLElement>("[data-section]");
        if (host) sec = sections[Number(host.dataset.section)];
      }
      if (!sec) {
        // Old-style links such as "#management" name a section without its number.
        sec = sections.find((s) => s.id.replace(/^\d+-/, "").startsWith(id));
        if (sec) target = sec.id;
      }
      if (!sec) return false;
      const key = sec.key;
      setCurrent(sec.chapter);
      setOpen((o) => ({ ...o, [key]: true }));
      setScrollTarget((t) => ({ id: target, seq: (t?.seq ?? 0) + 1 }));
      return true;
    },
    [sections],
  );

  // Scroll once the chapter and section are visible.
  useEffect(() => {
    if (!scrollTarget) return;
    const raf = requestAnimationFrame(() => document.getElementById(scrollTarget.id)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(raf);
  }, [scrollTarget]);

  // Deep links: #section-id on load and on every hash change.
  useEffect(() => {
    const onHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && !TAB_IDS.includes(id)) reveal(id);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [reveal]);

  const value = useMemo(
    () => ({ chapters, sections, current, open, read, go, toggle, setChapterOpen, reveal, markRead }),
    [chapters, sections, current, open, read, go, toggle, setChapterOpen, reveal, markRead],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The four chapter tabs and the chapters-read progress bar. */
export function ChapterTabs() {
  const { chapters, current, read, go } = useChapters();
  const pct = Math.round((read.length / chapters.length) * 100);
  return (
    <div id="chapter-nav" className="mb-5 flex scroll-mt-28 flex-col gap-2.5">
      <nav aria-label="Chapters" className="grid grid-cols-4 gap-1 rounded-[14px] bg-surface-3/70 p-1">
        {chapters.map((c, i) => {
          const active = i === current;
          const done = read.includes(i);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => go(i)}
              aria-pressed={active}
              className={clsx(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-[10px] px-1 py-2 text-center transition sm:py-2.5",
                active ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.1)]" : "text-ink-2 hover:bg-surface/60 hover:text-ink",
              )}
            >
              <span
                className={clsx(
                  "inline-flex items-center gap-0.5 text-[10.5px] font-semibold leading-tight sm:text-[11px]",
                  done ? "text-good" : active ? "text-brand-text" : "text-ink-3",
                )}
              >
                {done ? (
                  <>
                    <Check size={11} strokeWidth={3} /> Read
                  </>
                ) : active ? (
                  "Reading"
                ) : (
                  `${c.minutes} min`
                )}
              </span>
              <span className="w-full truncate text-[13px] font-semibold leading-tight sm:text-[14.5px]">
                <span className="sm:hidden">{c.short}</span>
                <span className="hidden sm:inline">{c.title}</span>
              </span>
            </button>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 px-1 text-[12px] text-ink-3">
        <span className="shrink-0 tabular-nums">
          Chapters read <span className="font-semibold text-ink">{read.length}</span> of {chapters.length}
        </span>
        <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-label="Chapters read" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/** The chapters: folding numbered sections, with Prev / Next chapter buttons. */
export function ChapterBody({ contents, preamble }: { contents: React.ReactNode[]; preamble?: React.ReactNode }) {
  const { chapters, sections, current, open, read, go, toggle, setChapterOpen, markRead } = useChapters();
  return (
    <div>
      {preamble && <div className="mb-5">{preamble}</div>}
      <ChapterTabs />
      {chapters.map((c, i) => {
        const secs = sections.filter((s) => s.chapter === i);
        const allOpen = secs.every((s) => open[s.key]);
        const last = i === chapters.length - 1;
        return (
          <div key={c.id} hidden={i !== current} data-chapter={c.id}>
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Chapter {i + 1} · {c.title}
              </div>
              <button
                type="button"
                onClick={() => setChapterOpen(i, !allOpen)}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                {allOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
                {allOpen ? "Fold all" : "Open all"}
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {secs.map((s) => {
                const isOpen = !!open[s.key];
                return (
                  <section key={s.key} data-section={s.key} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                    <h2 id={s.id} className="m-0 scroll-mt-28">
                      <button
                        type="button"
                        onClick={() => toggle(s.key)}
                        aria-expanded={isOpen}
                        aria-controls={`${s.id}-body`}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2/60 sm:px-5"
                      >
                        <span
                          className={clsx(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums transition",
                            isOpen ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-2",
                          )}
                        >
                          {s.n ?? "•"}
                        </span>
                        <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug tracking-[-0.015em] sm:text-[17px]">{s.title}</span>
                        {!isOpen && (
                          <span className="hidden shrink-0 text-[12.5px] text-ink-3 sm:inline">
                            {s.parts.length > 1 ? `${s.parts.length} parts · ` : ""}
                            {s.minutes} min
                          </span>
                        )}
                        <ChevronDown size={18} className={clsx("shrink-0 text-ink-3 transition-transform", isOpen && "rotate-180")} />
                      </button>
                    </h2>
                    <div id={`${s.id}-body`} hidden={!isOpen} className="border-t border-line px-4 pb-5 pt-1 sm:px-5 md:pl-[60px] md:pr-7">
                      {contents[s.key]}
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="mt-5 flex gap-2.5">
              {i > 0 && (
                <button type="button" onClick={() => go(i - 1)} className="btn btn-outline !min-h-12 shrink-0 !rounded-xl">
                  <ArrowLeft size={16} /> <span className="hidden sm:inline">{chapters[i - 1].title}</span>
                  <span className="sm:hidden">Back</span>
                </button>
              )}
              {!last ? (
                <button type="button" onClick={() => go(i + 1)} className="btn btn-primary !min-h-12 min-w-0 flex-1 !rounded-xl">
                  <span className="truncate">Next: {chapters[i + 1].title}</span> <ArrowRight size={16} className="shrink-0" />
                </button>
              ) : read.includes(i) ? (
                <div className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-good-soft text-[14px] font-medium text-good">
                  <Check size={16} strokeWidth={2.4} /> All chapters read
                </div>
              ) : (
                <button type="button" onClick={() => markRead(i)} className="btn btn-pink !min-h-12 flex-1 !rounded-xl">
                  <Check size={16} strokeWidth={2.4} /> Mark revision as read
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "In this chapter": the open chapter's sections, for the aside. */
export function ChapterToc() {
  const { sections, current, open, reveal } = useChapters();
  return (
    <ul className="space-y-0.5 text-[13px]">
      {sections
        .filter((s) => s.chapter === current)
        .map((s) => (
          <li key={s.key}>
            <a
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                history.replaceState(null, "", `#${s.id}`);
                reveal(s.id);
              }}
              className={clsx(
                "flex gap-1.5 rounded-[7px] px-2.5 py-1.5 leading-snug transition",
                open[s.key] ? "bg-brand-soft font-medium text-brand-text" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              {s.n !== null && <span className="w-4 shrink-0 tabular-nums">{s.n}</span>}
              <span className="min-w-0">{s.title}</span>
            </a>
          </li>
        ))}
    </ul>
  );
}
