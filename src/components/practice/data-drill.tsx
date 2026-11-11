"use client";

import { useState } from "react";
import clsx from "clsx";
import type { DataItem } from "@/lib/practice-types";
import { shuffle } from "@/lib/dose";
import { addMistake, recordDrill, removeMistake } from "@/lib/practice-store";
import { Actions, DrillHeader, EmptyNote, RoundSummary, StartCard, usePool } from "./shared";

const ROUND = 8;
const LETTERS = "ABCDEFG";

interface Item {
  d: DataItem;
  /** Original option indices in display order. */
  order: number[];
}

export function DataGame({ items }: { items: DataItem[] }) {
  const pool = usePool(items);
  const [round, setRound] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!pool.length) return <EmptyNote>Data-interpretation items for this rotation are being written.</EmptyNote>;
  const start = () => {
    setRound(shuffle(pool).slice(0, ROUND).map((d) => ({ d, order: shuffle(d.opts.map((_, k) => k)) })));
    setI(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };
  const total = round?.length ?? 0;
  const header = <DrillHeader title="Data interpretation" right={round ? `${score} / ${total}` : undefined} />;
  if (!round)
    return (
      <>
        {header}
        <StartCard title="Data interpretation" count={pool.length} noun="items" onStart={start}>
          CSF, growth charts, partographs, blood gases, FBC: read the numbers, then choose the best answer.
        </StartCard>
      </>
    );
  if (finished) return <>{header}<RoundSummary score={score} total={total} onAgain={start} /></>;

  const { d, order } = round[i];
  const answered = picked !== null;
  const choose = (orig: number) => {
    if (answered) return;
    setPicked(orig);
    const right = orig === d.answer;
    recordDrill(right);
    if (right) {
      setScore((s) => s + 1);
      removeMistake(`data:${d.id}`);
    } else addMistake({ id: `data:${d.id}`, kind: "data", rotation: d.rotation, prompt: `${d.stem} ${d.data.map((r) => `${r.k}: ${r.v}`).join("; ")}. ${d.q}`, answer: d.opts[d.answer], why: d.why });
  };
  return (
    <>
      {header}
      <div className="flex flex-col gap-3">
        <span className="chip self-start !border-transparent !bg-steel-soft !text-steel-text">{d.kind}</span>
        <p className="text-[15px] leading-relaxed">{d.stem}</p>
        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          {d.data.map((r) => (
            <div key={r.k} className="flex gap-3 border-b border-line px-3.5 py-2.5 text-[14px] last:border-0">
              <span className="text-ink-2">{r.k}</span>
              <span className="ml-auto text-right font-semibold tabular-nums">{r.v}</span>
            </div>
          ))}
        </div>
        <div className="text-[15px] font-semibold leading-snug">{d.q}</div>
        <div className="flex flex-col gap-1.5">
          {order.map((orig, n) => (
            <button
              key={orig}
              type="button"
              disabled={answered}
              onClick={() => choose(orig)}
              className={clsx(
                "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[14px] leading-snug",
                !answered && "border-line bg-surface hover:bg-surface-2",
                answered && orig === d.answer && "border-good/30 bg-good-soft",
                answered && orig === picked && orig !== d.answer && "border-bad/30 bg-bad-soft",
                answered && orig !== d.answer && orig !== picked && "border-line bg-surface opacity-70",
              )}
            >
              <b className="text-ink-3">{LETTERS[n]}</b>
              <span>{d.opts[orig]}</span>
            </button>
          ))}
        </div>
        {answered && <section className="rounded-2xl bg-surface-2 p-4 text-[14px] leading-relaxed">{d.why}</section>}
        {answered && (
          <Actions>
            <button
              className="btn btn-primary min-h-12 flex-1 text-[15px]"
              onClick={() => {
                if (i >= total - 1) setFinished(true);
                else {
                  setI(i + 1);
                  setPicked(null);
                }
              }}
            >
              {i >= total - 1 ? "See score" : "Next"}
            </button>
          </Actions>
        )}
      </div>
    </>
  );
}
