"use client";

import Link from "next/link";
import clsx from "clsx";
import { Calculator, ChartLine, ChevronRight, ClipboardCheck, ListOrdered, MessagesSquare, Stethoscope, Target, Timer, TrendingDown, Zap } from "lucide-react";
import type { OsceStationLite } from "@/lib/practice-types";
import { useStudy } from "@/lib/store/study-store";
import { useRotation } from "@/lib/use-rotation";
import { dayStreak, usePracticeData } from "@/lib/practice-store";
import { useNow } from "@/lib/use-now";
import { Label } from "./shared";

type Tone = "brand" | "accent" | "bad" | "steel" | "lilac" | "peach";
const TONE: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-text",
  accent: "bg-accent-soft text-accent-text",
  bad: "bg-bad-soft text-bad",
  steel: "bg-steel-soft text-steel-text",
  lilac: "bg-lilac-soft text-lilac-text",
  peach: "bg-peach-soft text-peach-text",
};

function Row({ href, icon: Icon, tone, title, sub, badge, hero }: { href: string; icon: typeof Zap; tone: Tone; title: string; sub: string; badge?: number; hero?: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition",
        hero ? "border-transparent bg-ink text-bg" : "card hover:border-brand-line",
      )}
    >
      <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", hero ? "bg-brand text-white" : TONE[tone])}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className={clsx("block text-[13px] leading-snug", hero ? "opacity-70" : "text-ink-3")}>{sub}</span>
      </span>
      {!!badge && <span className="rounded-full bg-bad-soft px-2 py-0.5 text-[12px] font-semibold text-bad tabular-nums">{badge}</span>}
      <ChevronRight size={16} className={hero ? "opacity-70" : "text-ink-3"} />
    </Link>
  );
}

function Stat({ n, label, bad }: { n: string; label: string; bad?: boolean }) {
  return (
    <div className="card px-3 py-2.5">
      <div className={clsx("text-[22px] font-semibold tabular-nums", bad && n !== "0" && "text-bad")}>{n}</div>
      <div className="text-[12px] text-ink-3">{label}</div>
    </div>
  );
}

export function PracticeHub({ stations }: { stations: OsceStationLite[] }) {
  const { state } = useStudy();
  const { slugs, rotation, id } = useRotation();
  const now = useNow();
  const { mistakes, stats } = usePracticeData();
  const wrongMcqs = Object.values(state.questions).filter((q) => q.lastCorrect === false && slugs.has(q.topic)).length;
  const toRedo = wrongMcqs + mistakes.filter((m) => m.rotation === id).length;
  const streak = now ? dayStreak(stats.days, now) : 0;
  const acc = stats.total ? `${Math.round((stats.right / stats.total) * 100)}%` : "–";
  const mine = stations.filter((s) => slugs.has(s.slug));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3" data-rot-scoped>
      <div className="grid grid-cols-3 gap-2">
        <Stat n={String(streak)} label="day streak" />
        <Stat n={acc} label="drill accuracy" />
        <Stat n={String(toRedo)} label="to redo" bad />
      </div>

      <Label className="mt-3">Quick drills · 2–5 minutes</Label>
      <Row hero href="/practice/spot" icon={Zap} tone="brand" title="Spot diagnosis" sub="30 seconds: one line of history + one sign" />
      <Row href="/practice/dose" icon={Calculator} tone="accent" title="Dose calculation" sub="A weight and a drug: work out the dose" />
      <Row
        href="/practice/sequences"
        icon={ListOrdered}
        tone="bad"
        title="Emergency sequences"
        sub={id === "paeds" ? "ETAT, newborn resuscitation, convulsions: put the steps in order" : "Eclampsia, PPH, newborn resuscitation: put the steps in order"}
      />
      <Row href="/practice/data" icon={ChartLine} tone="steel" title="Data interpretation" sub="CSF, growth charts, partographs, blood gases, FBC" />

      <Label className="mt-3">OSCE stations · from the skills notes</Label>
      <div className="card overflow-hidden">
        {mine.length === 0 && <div className="px-4 py-3 text-[14px] text-ink-3">No stations for {rotation.name} yet.</div>}
        {mine.map((s) => (
          <Link key={s.slug} href={`/practice/osce/${s.slug}`} className="flex items-center gap-2.5 border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2">
            <span className="min-w-0 flex-1 text-[14.5px] font-medium leading-snug">{s.title}</span>
            <span className="shrink-0 text-[12px] text-ink-3">{s.minutes} min</span>
          </Link>
        ))}
        <Link href="/practice/osce" className="flex items-center gap-2 bg-surface-2/60 px-4 py-2.5 text-[13px] font-medium text-brand-text">
          All stations <ChevronRight size={14} />
        </Link>
      </div>

      <Label className="mt-3">Ward round &amp; viva</Label>
      <Row href="/practice/viva" icon={MessagesSquare} tone="lilac" title="Ward-round rapid fire" sub="The questions seniors ask, 60 seconds each; reveal and rate yourself" />
      <Row href="/cases" icon={Stethoscope} tone="peach" title="Clinical cases" sub="Unfold a ward scenario one decision at a time" />

      <Label className="mt-3">Exams</Label>
      <Row href="/practice/exam" icon={Timer} tone="brand" title="Exam simulator" sub="Timed mixed paper: 30, 60 or 100 MCQs from the weeks so far" />
      <Row href="/practice/mistakes" icon={TrendingDown} tone="bad" title="Mistakes deck" sub="Everything you got wrong comes back until it sticks" badge={toRedo} />
      <Row href="/quiz" icon={ClipboardCheck} tone="accent" title="Quiz builder" sub="Pick topics, weeks and how many questions" />
      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <Target size={13} /> {rotation.name} · follows the rotation switch at the top.
      </p>
    </div>
  );
}
