"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Bookmark, BookOpen, Check, Download, ExternalLink, Layers, ListChecks, NotebookPen, Stethoscope, Library, List } from "lucide-react";
import { topicPrep, type TopicCounts } from "@/lib/prep";
import { addDays, formatDay } from "@/lib/dates";
import { effectiveSessions } from "@/lib/schedule";
import type { RotationId, Session } from "@/content/curriculum";
import { rotationInfoFor } from "@/lib/use-rotation";
import type { ClinicalCase, Heading, Reference } from "@/lib/types";
import { useStudy, type TopicStatus } from "@/lib/store/study-store";
import { FlashcardDeck, type DeckCard } from "@/components/flashcard-deck";
import { QuizRunner, type QuizQuestion } from "@/components/quiz-runner";
import { CaseRunner } from "@/components/case-runner";

const STATUSES: { v: TopicStatus; label: string }[] = [
  { v: "not_started", label: "To do" },
  { v: "in_progress", label: "Studying" },
  { v: "done", label: "Done" },
];

/** Save + Mark as done, shown in the record header. */
export function TopicHeaderActions({ slug, title }: { slug: string; title: string }) {
  const { state, setTopicStatus, toggleBookmark } = useStudy();
  const t = state.topics[slug];
  const done = t?.status === "done";
  return (
    <div className="flex items-center gap-2">
      <a
        href={`/pdf/${slug}.pdf`}
        download={`For Edith - ${title}.pdf`}
        className="btn btn-outline !min-h-9 !py-1.5 text-[13px]"
        title="Download notes, flashcards, questions and cases as a PDF"
      >
        <Download size={15} /> PDF
      </a>
      <button
        onClick={() => toggleBookmark(slug)}
        className={clsx("btn btn-outline !min-h-9 !py-1.5 text-[13px]", t?.bookmarked && "!border-brand-line !text-brand-text")}
        aria-pressed={!!t?.bookmarked}
      >
        <Bookmark size={15} className={clsx(t?.bookmarked && "fill-brand text-brand")} /> {t?.bookmarked ? "Saved" : "Save"}
      </button>
      <button
        onClick={() => setTopicStatus(slug, done ? "in_progress" : "done")}
        className={clsx("btn !min-h-9 !py-1.5 text-[13px]", done ? "btn-ghost !text-good" : "btn-primary")}
      >
        <Check size={15} strokeWidth={2.4} /> {done ? "Done" : "Mark as done"}
      </button>
    </div>
  );
}


/** Attio-style record panel: session facts, status, mastery and confidence. */
export function TopicDetails({
  slug,
  counts,
  sessions,
  rotation,
  faculty,
  weekLabel,
}: {
  slug: string;
  counts: TopicCounts;
  sessions: Session[];
  /** The topic's own rotation (its sessions are dated from that rotation's start). */
  rotation: RotationId;
  faculty: string[];
  weekLabel: string;
}) {
  const { state, setTopicStatus, setConfidence } = useStudy();
  const t = state.topics[slug];
  const status = t?.status ?? "not_started";
  const prep = topicPrep(state, slug, counts);
  const { start } = rotationInfoFor(state.settings, rotation);
  const rows: [string, React.ReactNode][] = [
    ...effectiveSessions(sessions, state.overrides)
      .filter((s) => !s.ghostOf)
      .map((s, i): [string, React.ReactNode] => [
        i === 0 ? "Session" : "",
        <span key={s.key}>
          {formatDay(addDays(start, s.day), { weekday: "short", day: "numeric", month: "short" })} · {s.time.split("–")[0]} · {s.mode}
          {s.presenting && <span className="ml-1.5 inline-block whitespace-nowrap rounded-md bg-brand-soft px-1.5 py-px text-[11.5px] font-medium text-brand-text">You&apos;re presenting</span>}
          {s.movedFrom && <span className="ml-1.5 rounded-md bg-peach-soft px-1.5 py-px text-[11.5px] font-medium text-peach-text">Moved</span>}
        </span>,
      ]),
    ...(faculty.length ? [[faculty.length > 1 ? "Faculty" : "Facilitator", faculty.join(", ")] as [string, React.ReactNode]] : []),
    ["Week", weekLabel],
  ];
  const bars = [
    { label: "MCQs correct", value: prep.correct, total: counts.mcqs, cls: "bg-brand", track: "bg-brand-soft" },
    { label: "Flashcards seen", value: prep.cardsSeen, total: counts.flashcards, cls: "bg-lilac", track: "bg-lilac-soft" },
    { label: "Cases", value: prep.casesDone, total: counts.cases, cls: "bg-accent", track: "bg-accent-soft" },
  ];
  return (
    <div className="flex flex-col gap-6 text-[13px]">
      <div className="flex flex-col gap-3">
        <div className="text-[12px] font-medium text-ink-3">Details</div>
        <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-2 gap-y-2.5">
          {rows.map(([k, v], i) => (
            <div key={i} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd className="m-0">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="text-[12px] font-medium text-ink-3">Status</div>
        <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-surface-2 p-[3px]">
          {STATUSES.map((s) => (
            <button
              key={s.v}
              onClick={() => setTopicStatus(slug, s.v)}
              className={clsx(
                "h-[30px] rounded-lg text-[12.5px] transition",
                status === s.v
                  ? clsx("bg-surface font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.06)]", s.v === "done" ? "text-good" : s.v === "in_progress" ? "text-lilac-text" : "text-ink")
                  : "text-ink-2 hover:text-ink",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="text-[12px] font-medium text-ink-3">Your mastery</div>
        {bars.map((b) => (
          <div key={b.label} className="flex flex-col gap-1.5">
            <div className="flex">
              <span>{b.label}</span>
              <span className="ml-auto font-semibold tabular-nums">
                {b.value}/{b.total}
              </span>
            </div>
            <div className={clsx("h-[5px] rounded-full", b.track)}>
              <div className={clsx("h-full rounded-full", b.cls)} style={{ width: `${b.total ? (b.value / b.total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-[12px] font-medium text-ink-3">Confidence</div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setConfidence(slug, n)}
              aria-label={`Confidence ${n} of 5`}
              className={clsx("h-2.5 flex-1 rounded-full transition", (t?.confidence ?? 0) >= n ? "bg-brand" : "bg-surface-3 hover:bg-brand-line")}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <a href="#quiz" className="btn btn-pink w-full">
          Test me on this topic
        </a>
        <a href="#cases" className="btn btn-outline w-full">
          Work through a case
        </a>
      </div>
    </div>
  );
}

export function TableOfContents({ headings }: { headings: Heading[] }) {
  const h2 = headings.filter((h) => h.depth === 2);
  const [active, setActive] = useState<string>();
  useEffect(() => {
    const els = h2.map((h) => document.getElementById(h.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [h2]);
  if (!h2.length) return null;
  return (
    <ul className="space-y-0.5 text-[13px]">
      {h2.map((h) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            className={clsx(
              "block rounded-[7px] px-2.5 py-1.5 leading-snug transition",
              active === h.id ? "bg-brand-soft font-medium text-brand-text" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

type Tab = "notes" | "cards" | "quiz" | "cases" | "mine" | "sources";

export function TopicTabs({
  slug,
  topicTitle,
  cards,
  questions,
  cases,
  references,
  toc,
  children,
}: {
  slug: string;
  topicTitle: string;
  cards: DeckCard[];
  questions: QuizQuestion[];
  cases: ClinicalCase[];
  references: Reference[];
  /** The phone's "Jump to section" list (none for chaptered notes, which have chapter tabs). */
  toc?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("notes");
  const [quizKey, setQuizKey] = useState(0);
  const [caseIdx, setCaseIdx] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const { state } = useStudy();

  useEffect(() => {
    const TABS = ["cards", "quiz", "cases", "mine", "sources"];
    // "#management" may name a heading like "management-the-e-motive-bundle".
    const findSection = (id: string) =>
      document.getElementById(id) ?? document.querySelector<HTMLElement>(`.prose-edith h2[id^="${CSS.escape(id)}"]`);
    const h = decodeURIComponent(window.location.hash.slice(1));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the tab named in the URL hash
    if (TABS.includes(h)) setTab(h as Tab);
    else if (h && !document.getElementById(h)) requestAnimationFrame(() => findSection(h)?.scrollIntoView());
    // Section links must show the notes tab before scrolling; tab links (#quiz) switch tabs.
    const onHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      if (TABS.includes(id)) {
        setTab(id as Tab);
        document.getElementById("topic-tabs")?.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      setTab("notes");
      requestAnimationFrame(() => findSection(id)?.scrollIntoView());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const select = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "notes" ? window.location.pathname : `#${t}`);
    document.getElementById("topic-tabs")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "notes", label: "Notes", icon: <BookOpen size={16} /> },
    { id: "cards", label: "Flashcards", icon: <Layers size={16} />, count: cards.length },
    { id: "quiz", label: "MCQs", icon: <ListChecks size={16} />, count: questions.length },
    { id: "cases", label: "Cases", icon: <Stethoscope size={16} />, count: cases.length },
    { id: "mine", label: "My notes", icon: <NotebookPen size={16} /> },
    { id: "sources", label: "Sources", icon: <Library size={16} />, count: references.length },
  ];

  return (
    <div id="topic-tabs" className="scroll-mt-16 pb-16 lg:pb-0">
      <div className="no-scrollbar sticky top-14 z-20 -mx-4 mb-6 flex gap-0.5 overflow-x-auto border-b border-line bg-bg/95 px-4 backdrop-blur sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => select(t.id)}
            className={clsx(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[13.5px] font-medium transition",
              tab === t.id ? "border-brand text-ink" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-[11.5px] tabular-nums text-ink-2">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Notes stay mounted so server-rendered markdown isn't lost between tabs */}
      <div className={clsx(tab !== "notes" && "hidden")}>
        <div>
          <div className="min-w-0">
            {toc && (
              <div className="mb-4 xl:hidden">
                <button className="btn btn-outline w-full justify-between" onClick={() => setTocOpen((o) => !o)}>
                  <span className="flex items-center gap-2">
                    <List size={16} /> Jump to section
                  </span>
                  <span className="text-ink-3">{tocOpen ? "▲" : "▼"}</span>
                </button>
                {tocOpen && (
                  <div className="card mt-2 p-2" onClick={() => setTocOpen(false)}>
                    {toc}
                  </div>
                )}
              </div>
            )}
            {children}
            {/* Phone: floating test-me bar above the tab bar */}
            <div className="safe-bottom fixed inset-x-3 bottom-[4.9rem] z-20 flex gap-2 rounded-2xl bg-[#1c1d1f]/95 p-2 shadow-pop backdrop-blur lg:hidden">
              <button onClick={() => select("quiz")} className="btn btn-pink flex-1 !min-h-11">
                Test me · {questions.length} MCQs
              </button>
              <button onClick={() => select("cards")} className="btn !min-h-11 bg-white/10 text-white">
                {cards.length} cards
              </button>
            </div>
            <div className="card mt-10 flex flex-col items-center gap-3 p-6 text-center">
              <div className="font-semibold">Finished reading? Test yourself.</div>
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn btn-primary" onClick={() => select("quiz")}>
                  <ListChecks size={16} /> {questions.length} MCQs
                </button>
                <button className="btn btn-outline" onClick={() => select("cards")}>
                  <Layers size={16} /> {cards.length} flashcards
                </button>
                <button className="btn btn-outline" onClick={() => select("cases")}>
                  <Stethoscope size={16} /> {cases.length} cases
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {tab === "cards" && (
        <div className="mx-auto max-w-2xl">
          <FlashcardDeck cards={cards} newLimit={cards.length} />
        </div>
      )}

      {tab === "quiz" && (
        <div className="mx-auto max-w-3xl">
          <QuizRunner key={quizKey} questions={questions} mode="practice" onExit={() => setQuizKey((k) => k + 1)} />
        </div>
      )}

      {tab === "cases" && (
        <div className="mx-auto max-w-3xl">
          {cases.length === 0 ? (
            <div className="card p-6 text-center text-ink-3">No cases yet.</div>
          ) : (
            <>
              <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
                {cases.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => setCaseIdx(i)}
                    className={clsx(
                      "shrink-0 rounded-lg border px-2.5 py-1 text-[13px] font-medium",
                      i === caseIdx ? "border-brand-line bg-brand-soft text-brand" : "border-line bg-surface",
                    )}
                  >
                    {state.cases[c.id]?.completed && "✓ "}Case {i + 1}
                  </button>
                ))}
              </div>
              <h3 className="mb-3 h-section">{cases[caseIdx].title}</h3>
              <CaseRunner key={cases[caseIdx].id} c={cases[caseIdx]} topic={slug} />
            </>
          )}
        </div>
      )}

      {tab === "mine" && <PersonalNotes slug={slug} topicTitle={topicTitle} />}

      {tab === "sources" && (
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm text-ink-2">
            These notes were compiled from the sources below. Where Ugandan practice differs from international guidance, follow the
            Uganda Clinical Guidelines and your consultants.
          </p>
          <ol className="space-y-2">
            {references.map((r, i) => (
              <li key={i} className="card flex gap-3 p-4">
                <span className="text-sm font-bold text-ink-3">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-snug">{r.title}</div>
                  <div className="text-sm text-ink-3">{[r.source, r.year].filter(Boolean).join(" · ")}</div>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 break-all text-sm text-brand hover:underline">
                      <ExternalLink size={13} className="shrink-0" /> {r.url.replace(/^https?:\/\//, "").slice(0, 70)}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function PersonalNotes({ slug, topicTitle }: { slug: string; topicTitle: string }) {
  const { state, saveNote, hydrated, sync } = useStudy();
  const saved = state.notes[slug];
  const [body, setBody] = useState<string | null>(null);
  const value = body ?? saved?.body ?? "";
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm text-ink-2">
        Your own notes for <strong>{topicTitle}</strong>: things consultants emphasised, cases you clerked, mnemonics that work for you.
        {sync.status === "synced" ? " Synced to your account." : " Saved on this device (sign in to sync)."}
      </p>
      <textarea
        className="input min-h-[50vh] font-mono text-sm leading-relaxed"
        disabled={!hydrated}
        value={value}
        placeholder={"e.g.\n- Dr Nanzira: always check the bladder before calling it obstructed labour\n- Clerked Mrs A, G4P3, PPH from atony: responded to 2nd dose of oxytocin…"}
        onChange={(e) => {
          setBody(e.target.value);
          saveNote(slug, e.target.value);
        }}
      />
      {saved?.updatedAt && <div className="mt-2 text-xs text-ink-3">Last saved {new Date(saved.updatedAt).toLocaleString("en-GB")}</div>}
    </div>
  );
}
