"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  ArrowLeftRight,
  BookOpen,
  Calculator,
  CalendarDays,
  CornerDownLeft,
  Home,
  Layers,
  ListChecks,
  Search,
  Stethoscope,
  Target,
  Timer,
  UserRound,
  Zap,
  Pill,
} from "lucide-react";
import { TOPICS, WEEKS, weekLabel } from "@/content/curriculum";
import { ROTATIONS, ROTATION_IDS, type RotationId } from "@/content/rotations";
import { useStudy } from "@/lib/store/study-store";
import { useNow } from "@/lib/use-now";
import { useRotation } from "@/lib/use-rotation";
import { cardsDue } from "@/lib/store/selectors";

const STUDY = [
  { href: "/", label: "Today", icon: Home },
  { href: "/topics", label: "Topics", icon: BookOpen },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/quiz", label: "Quiz", icon: ListChecks },
  { href: "/cases", label: "Cases", icon: Stethoscope },
  { href: "/practice", label: "Practice", icon: Target },
];
/** Reference links; the drug handbook is the active rotation's. */
const referenceLinks = (rotation: RotationId) => [
  { href: "/schedule", label: "Timetable", icon: CalendarDays },
  { href: "/quick-reference", label: "Quick reference", icon: Zap },
  { href: `/topics/${ROTATIONS[rotation].handbookSlug}`, label: "Drug handbook", icon: Pill },
  { href: "/calculators", label: "EDD calculator", icon: Calculator },
];
const MOBILE = [
  { href: "/", label: "Today", icon: Home },
  { href: "/topics", label: "Topics", icon: BookOpen },
  { href: "/schedule", label: "Calendar", icon: CalendarDays },
  { href: "/flashcards", label: "Cards", icon: Layers },
  { href: "/quiz", label: "Quiz", icon: ListChecks },
  { href: "/practice", label: "Practice", icon: Target },
];

const openCommand = () => window.dispatchEvent(new Event("open-command"));

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Segmented "Obs & Gyn | Paediatrics" switch for the active rotation. */
export function RotationSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { id, setRotation } = useRotation();
  return (
    <div
      role="radiogroup"
      aria-label="Rotation"
      data-rot-scoped
      className={clsx("grid shrink-0 grid-cols-2 gap-[3px] rounded-[10px] bg-surface-3 p-[3px]", className)}
    >
      {ROTATION_IDS.map((r) => {
        const on = r === id;
        return (
          <button
            key={r}
            role="radio"
            aria-checked={on}
            title={`Switch to ${ROTATIONS[r].name}`}
            onClick={() => setRotation(r)}
            className={clsx(
              "rounded-lg transition",
              compact ? "h-[30px] px-2.5 text-[12.5px]" : "h-[28px] px-2 text-[12.5px]",
              on ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {compact ? ROTATIONS[r].short : ROTATIONS[r].name}
          </button>
        );
      })}
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  const { rotation } = useRotation();
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="relative grid h-8 w-8 place-items-center rounded-[9px] bg-brand text-white">
        <span className="font-serif text-[19px] italic leading-none">E</span>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="h-logo block whitespace-nowrap">For Edith</span>
          <span data-rot-scoped className="hidden whitespace-nowrap text-[11.5px] text-ink-3 sm:block lg:block">
            {rotation.name} · UCU Year 3
          </span>
        </span>
      )}
    </Link>
  );
}

function NavItem({ href, label, icon: Icon, pathname, badge, count }: { href: string; label: string; icon: typeof Home; pathname: string; badge?: number; count?: number }) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      className={clsx(
        "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] font-medium transition",
        active ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/0.04)]" : "text-ink-2 hover:bg-surface-3/70 hover:text-ink",
      )}
    >
      <Icon size={16} className={clsx(active ? "text-brand" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={active ? 2.2 : 1.8} />
      {label}
      {!!badge && <span className="ml-auto rounded-full bg-brand px-1.5 text-[11px] font-semibold leading-[18px] text-white tabular-nums">{badge}</span>}
      {count !== undefined && !badge && <span className="ml-auto text-[11.5px] text-ink-3 tabular-nums">{count}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { state, sync } = useStudy();
  const now = useNow();
  const { rotation, slugs } = useRotation();
  const due = now ? cardsDue(state, now, slugs) : 0;
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface-2 lg:flex">
      <div className="flex h-14 items-center px-4">
        <Logo />
      </div>
      <div className="space-y-2.5 px-3">
        <RotationSwitch />
        <button
          onClick={openCommand}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-line bg-surface px-2 text-[13px] text-ink-3 shadow-[0_1px_2px_rgb(0_0_0/0.03)] hover:border-line-strong"
        >
          <Search size={14} /> Search
          <span className="ml-auto flex gap-0.5">
            <span className="kbd">⌘</span>
            <span className="kbd">K</span>
          </span>
        </button>
      </div>
      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          {STUDY.map((n) => (
            <NavItem
              key={n.href}
              {...n}
              pathname={pathname}
              badge={n.href === "/flashcards" ? due : undefined}
              count={n.href === "/topics" ? rotation.topics.length : undefined}
            />
          ))}
        </div>
        <div>
          <div className="mb-1 px-2 text-[11px] font-medium text-ink-3">Reference</div>
          <div className="space-y-0.5">
            {referenceLinks(rotation.id).map((n) => (
              <NavItem key={n.href} {...n} pathname={pathname} />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 px-2 text-[11px] font-medium text-ink-3">Weeks</div>
          <div data-rot-scoped className="space-y-2.5 px-2 pt-1">
            {WEEKS.map((w) => {
              const wt = rotation.topics.filter((t) => t.week === w);
              const done = wt.filter((t) => state.topics[t.slug]?.status === "done").length;
              return (
                <Link key={w} href={`/topics#week-${w}`} title={rotation.weekThemes[w]} className="group block">
                  <span className="flex items-center gap-2 text-[12.5px] text-ink-2 group-hover:text-ink">
                    <span className="truncate">
                      {w} · {rotation.weekThemes[w]}
                    </span>
                    <span className="ml-auto text-[11.5px] tabular-nums text-ink-3">
                      {done}/{wt.length}
                    </span>
                  </span>
                  <span className="mt-1 block h-[3px] rounded-full bg-surface-3">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${wt.length ? (done / wt.length) * 100 : 0}%` }} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <div className="border-t border-line p-3">
        <Link href="/account" className="flex items-center gap-2.5 rounded-md p-1.5 hover:bg-surface-3/70">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-lilac-soft text-[12px] font-semibold text-lilac">
            {(state.settings.displayName || "Edith")[0]}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium">{state.settings.displayName || "Edith"}</span>
            <span className="block truncate text-[11px] text-ink-3">
              {sync.email ? (sync.status === "error" ? "Sync error" : "Synced") : "Saved on this device"}
            </span>
          </span>
          <span className={clsx("h-2 w-2 rounded-full", sync.status === "synced" ? "bg-good" : sync.status === "error" ? "bg-bad" : "bg-line-strong")} />
        </Link>
      </div>
    </aside>
  );
}

const TITLES: Record<string, string> = {
  "/": "Today",
  "/topics": "Topics",
  "/flashcards": "Flashcards",
  "/quiz": "Quiz",
  "/cases": "Cases",
  "/practice": "Practice",
  "/schedule": "Timetable",
  "/quick-reference": "Quick reference",
  "/calculators": "Calculators",
  "/search": "Search",
  "/account": "Account",
};

export function TopBar() {
  const pathname = usePathname();
  const { sync } = useStudy();
  const { id } = useRotation();
  const section = "/" + (pathname.split("/")[1] ?? "");
  const topic = pathname.startsWith("/topics/") ? TOPICS.find((t) => pathname === `/topics/${t.slug}`) : null;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-10">
        <div className="sm:hidden">
          <Logo compact />
        </div>
        <div className="hidden sm:block lg:hidden">
          <Logo />
        </div>
        <RotationSwitch compact className="lg:hidden" />
        <nav className="hidden min-w-0 items-center gap-1.5 text-[13px] lg:flex">
          <span className="text-ink-3">For Edith</span>
          <span className="text-ink-3">/</span>
          {topic ? (
            <>
              <Link href="/topics" className="text-ink-3 hover:text-ink">
                Topics
              </Link>
              <span className="text-ink-3">/</span>
              <span className="truncate font-medium">{topic.title}</span>
            </>
          ) : (
            <span className="font-medium">{TITLES[section] ?? ""}</span>
          )}
        </nav>
        <div className="ml-auto flex items-center sm:gap-1">
          <button onClick={openCommand} aria-label="Search" className="grid h-9 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 sm:w-9 lg:hidden">
            <Search size={19} />
          </button>
          <Link href="/cases" aria-label="Clinical cases" className="grid h-9 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 sm:w-9 lg:hidden">
            <Stethoscope size={19} />
          </Link>
          {id === "obgyn" && (
            <Link href="/calculators" aria-label="EDD calculator" className="grid h-9 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 sm:w-9 lg:hidden">
              <Calculator size={19} />
            </Link>
          )}
          <Link href="/quick-reference" aria-label="Quick reference" className="grid h-9 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 sm:w-9 lg:hidden">
            <Zap size={19} />
          </Link>
          <Link href="/account" aria-label="Account & settings" className="relative grid h-9 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 sm:w-9 lg:hidden">
            <UserRound size={19} />
            {sync.status === "synced" && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-good ring-2 ring-bg" />}
          </Link>
          <Link href="/quiz?mode=exam" className="btn btn-outline hidden min-h-0 py-1.5 text-[13px] lg:inline-flex">
            <Timer size={14} /> Mock exam
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-md lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-6 px-0.5">
        {MOBILE.map((n) => {
          const active = isActive(pathname, n.href);
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} className="flex flex-col items-center gap-1 pb-1.5 pt-2 text-[10.5px] font-medium">
              <span className={clsx("grid h-7 w-12 place-items-center rounded-full transition", active ? "bg-brand-soft text-brand" : "text-ink-3")}>
                <Icon size={19} strokeWidth={active ? 2.3 : 1.8} />
              </span>
              <span className={active ? "text-ink" : "text-ink-3"}>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ── ⌘K command menu ─────────────────────────────────────────
interface Command {
  id: string;
  label: string;
  hint: string;
  /** Where to go, or what to do instead (`run`). */
  href?: string;
  run?: () => void;
  icon: typeof Home;
}

/** Commands for the active rotation: switching, pages, then its topics before the others'. */
function commandsFor(rotation: RotationId, setRotation: (r: RotationId) => void): Command[] {
  const other = ROTATION_IDS.filter((r) => r !== rotation);
  const topics = [...TOPICS.filter((t) => t.rotation === rotation), ...TOPICS.filter((t) => t.rotation !== rotation)];
  return [
    ...other.map((r) => ({ id: `rotation-${r}`, label: `Switch to ${ROTATIONS[r].name}`, hint: "Rotation", run: () => setRotation(r), icon: ArrowLeftRight })),
    ...[...STUDY, ...referenceLinks(rotation)].map((n) => ({ id: n.href, label: n.label, hint: "Go to", href: n.href, icon: n.icon })),
    { id: "practice-spot", label: "Spot diagnosis drill", hint: "Practice", href: "/practice/spot", icon: Target },
    { id: "practice-dose", label: "Dose calculation drill", hint: "Practice", href: "/practice/dose", icon: Calculator },
    { id: "practice-osce", label: "OSCE stations", hint: "Practice", href: "/practice/osce", icon: Stethoscope },
    { id: "practice-viva", label: "Ward-round rapid fire (viva)", hint: "Practice", href: "/practice/viva", icon: Zap },
    { id: "practice-mistakes", label: "Mistakes deck", hint: "Practice", href: "/practice/mistakes", icon: ListChecks },
    { id: "mock", label: "Start a mock progressive test", hint: "Action", href: "/quiz?mode=exam", icon: Timer },
    { id: "search", label: "Full-text search of all notes", hint: "Action", href: "/search", icon: Search },
    { id: "account", label: "Account & settings", hint: "Go to", href: "/account", icon: UserRound },
    ...topics.map((t) => ({
      id: t.slug,
      label: t.title,
      hint: `${ROTATIONS[t.rotation].short} · ${weekLabel(t.week)}`,
      href: `/topics/${t.slug}`,
      icon: BookOpen,
    })),
  ];
}

export function CommandMenu() {
  const router = useRouter();
  const { id: rotation, setRotation } = useRotation();
  const commands = useMemo(() => commandsFor(rotation, setRotation), [rotation, setRotation]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setSel(0);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !(e.target as HTMLElement)?.closest("input, textarea")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("open-command", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("open-command", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length ? commands.filter((c) => words.every((w) => `${c.label} ${c.hint}`.toLowerCase().includes(w))) : commands;
    const extra: Command[] = q.trim().length > 1 ? [{ id: "fts", label: `Search notes for “${q.trim()}”`, hint: "Full text", href: `/search?q=${encodeURIComponent(q.trim())}`, icon: Search }] : [];
    return [...list.slice(0, 12), ...extra];
  }, [q, commands]);

  const go = (c?: Command) => {
    if (!c) return;
    close();
    if (c.run) c.run();
    else if (c.href) router.push(c.href);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-3 pt-[12vh] backdrop-blur-[2px]" onMouseDown={close}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search size={16} className="text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(results.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") go(results[sel]);
              else if (e.key === "Escape") close();
            }}
            placeholder="Jump to a topic, page or action…"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3 focus-visible:shadow-none"
          />
          <span className="kbd">esc</span>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-1.5">
          {results.map((c, i) => {
            const Icon = c.icon;
            return (
              <li key={c.id}>
                <button
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(c)}
                  className={clsx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px]", i === sel ? "bg-brand-soft" : "")}
                >
                  <Icon size={16} className={i === sel ? "text-brand" : "text-ink-3"} />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="text-[11px] text-ink-3">{c.hint}</span>
                  {i === sel && <CornerDownLeft size={13} className="text-ink-3" />}
                </button>
              </li>
            );
          })}
          {!results.length && <li className="px-3 py-6 text-center text-sm text-ink-3">Nothing matches.</li>}
        </ul>
      </div>
    </div>
  );
}
