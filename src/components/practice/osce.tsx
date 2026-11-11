"use client";

import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { ChevronRight, X } from "lucide-react";
import type { OsceStation, OsceStationLite } from "@/lib/practice-types";
import { useRotation } from "@/lib/use-rotation";
import { EmptyNote, Inline, Label, Verdict, mmss, useCountdown } from "./shared";

export function OsceList({ stations }: { stations: OsceStationLite[] }) {
  const { slugs, rotation } = useRotation();
  const mine = stations.filter((s) => slugs.has(s.slug));
  if (!mine.length) return <EmptyNote>No stations for {rotation.name} yet.</EmptyNote>;
  return (
    <div className="grid gap-3 md:grid-cols-2" data-rot-scoped>
      {mine.map((s) => (
        <Link key={s.slug} href={`/practice/osce/${s.slug}`} className="card flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-snug">{s.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
              <span className="chip !border-transparent !bg-peach-soft !text-peach-text">{s.kind}</span>
              <span>
                {s.minutes} min · {s.steps} steps · {s.critical} critical
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-ink-3" />
        </Link>
      ))}
    </div>
  );
}

export function OsceStationView({ station }: { station: OsceStation }) {
  const [attempt, setAttempt] = useState(0);
  return <Station key={attempt} station={station} onRetry={() => setAttempt((a) => a + 1)} />;
}

type Phase = "brief" | "running" | "result";

function Station({ station: o, onRetry }: { station: OsceStation; onRetry: () => void }) {
  const total = o.minutes * 60;
  const [phase, setPhase] = useState<Phase>("brief");
  const [on, setOn] = useState<Record<number, boolean>>({});
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const left = useCountdown(total, phase === "running", () => setPhase("result"));

  const done = o.stepList.filter((_, k) => on[k]).length;
  const n = o.stepList.length;
  const need = Math.ceil(n * 0.75);
  const missedCrit = o.stepList.some((s, k) => s.critical && !on[k]);
  const pass = done >= need && !missedCrit;
  const missed = o.stepList.filter((_, k) => !on[k]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center gap-1">
        <Link href="/practice/osce" aria-label="Leave station" className="-ml-2 grid h-10 w-10 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
          <X size={20} />
        </Link>
        <span className="flex-1 text-[15px] font-semibold">OSCE station</span>
        <span
          role="timer"
          className={clsx("rounded-full px-3 py-1 text-[14px] font-semibold tabular-nums", left <= 60 && phase === "running" ? "bg-bad text-white" : "bg-ink text-bg")}
        >
          {mmss(left)}
        </span>
      </div>

      <section className="card flex flex-col gap-1.5 p-4">
        <div className="flex gap-1.5">
          <span className="chip !border-transparent !bg-peach-soft !text-peach-text">{o.kind}</span>
          <span className="chip">{o.minutes} minutes</span>
        </div>
        <h2 className="font-serif text-[28px] leading-[1.05] tracking-tight">{o.title}</h2>
        <p className="text-[14px] leading-relaxed">
          <Inline>{o.scenario}</Inline>
        </p>
      </section>

      {phase === "brief" && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            Do the station out loud on a classmate or a doll. Tick each step as you do it, as the examiner would. The clock runs for {o.minutes} minutes. Pass
            mark: {need} of {n} steps, with every critical step.
          </p>
          <button className="btn btn-pink min-h-[50px] text-[15px]" onClick={() => setPhase("running")}>
            Start station
          </button>
        </div>
      )}

      {phase === "running" && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline">
            <Label>Checklist</Label>
            <span className="ml-auto text-[12px] font-medium text-brand-text">
              {done} of {n} done
            </span>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
            {o.stepList.map((s, k) => (
              <label
                key={k}
                className={clsx("flex cursor-pointer items-start gap-3 border-b border-line px-3.5 py-2.5 text-[14px] leading-snug last:border-0", s.critical && !on[k] && "bg-brand-soft/40")}
              >
                <input
                  type="checkbox"
                  checked={!!on[k]}
                  onChange={() => setOn((p) => ({ ...p, [k]: !p[k] }))}
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--brand)]"
                />
                <span className={on[k] ? "text-ink-3" : ""}>
                  <Inline>{s.text}</Inline>
                  {s.critical && <span className="mt-0.5 block text-[12px] font-semibold text-brand-text">Critical step</span>}
                </span>
              </label>
            ))}
          </div>
          <div className="sticky bottom-20 z-10 mt-4 rounded-2xl bg-ink/95 p-2 shadow-pop lg:bottom-4">
            <button className="btn btn-pink min-h-11 w-full text-[14px] font-semibold" onClick={() => setPhase("result")}>
              Finish &amp; score
            </button>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="mt-4 flex flex-col gap-3">
          <Verdict ok={pass} title={pass ? "Pass" : missedCrit ? "Fail · a critical step was missed" : "Borderline · below the pass mark"}>
            <div className="font-serif text-[44px] leading-none">
              {done} / {n}
            </div>
            <div className="mt-1 text-[13px] text-ink-2">
              Time used {mmss(total - left)} · pass is {need}+ steps with every critical step
            </div>
          </Verdict>
          {missed.length > 0 && (
            <>
              <Label>Steps you missed</Label>
              <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
                {missed.map((s, k) => (
                  <div key={k} className={clsx("border-b border-line px-3.5 py-2.5 text-[14px] leading-snug last:border-0", s.critical && "text-bad")}>
                    {s.critical && <b>Critical: </b>}
                    <Inline>{s.text}</Inline>
                    {s.hint && <div className="mt-0.5 text-[12.5px] text-ink-3">Done well when: <Inline>{s.hint}</Inline></div>}
                  </div>
                ))}
              </div>
            </>
          )}
          {o.questions.length > 0 && <Label>Examiner&apos;s questions</Label>}
          {o.questions.map((q, k) => (
            <div key={k} className="card flex flex-col gap-2 p-3.5">
              <div className="text-[14.5px] font-semibold leading-snug">
                <Inline>{q.q}</Inline>
              </div>
              {shown[k] ? (
                <div className="text-[14px] leading-relaxed">
                  <Inline>{q.a}</Inline>
                </div>
              ) : (
                <button className="btn btn-outline min-h-0 self-start py-1.5 text-[13px]" onClick={() => setShown((p) => ({ ...p, [k]: true }))}>
                  Show model answer
                </button>
              )}
            </div>
          ))}
          <button className="btn btn-primary min-h-12 text-[15px]" onClick={onRetry}>
            Try again
          </button>
          <Link href={`/topics/${o.slug}`} className="text-center text-[14px] font-medium text-brand-text">
            Open the full notes
          </Link>
        </div>
      )}
    </div>
  );
}
