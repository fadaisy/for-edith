"use client";

import { useState } from "react";
import clsx from "clsx";
import type { SequenceItem } from "@/lib/practice-types";
import { shuffle } from "@/lib/dose";
import { addMistake, recordDrill, removeMistake } from "@/lib/practice-store";
import { Actions, DrillHeader, EmptyNote, Label, RoundSummary, StartCard, Verdict, usePool } from "./shared";

const ROUND = 5;

interface Item {
  s: SequenceItem;
  /** Step indices in the order they are offered. */
  offered: number[];
}

function prepare(s: SequenceItem): Item {
  const idx = s.steps.map((_, k) => k);
  let offered = shuffle(idx);
  for (let t = 0; t < 8 && offered.every((v, k) => v === k); t++) offered = shuffle(idx);
  return { s, offered };
}

export function SequenceGame({ items }: { items: SequenceItem[] }) {
  const pool = usePool(items);
  const [round, setRound] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!pool.length) return <EmptyNote>Emergency sequences for this rotation are being written.</EmptyNote>;
  const start = () => {
    setRound(shuffle(pool).slice(0, ROUND).map(prepare));
    setI(0);
    setOrder([]);
    setChecked(false);
    setScore(0);
    setFinished(false);
  };
  const total = round?.length ?? 0;
  const header = <DrillHeader title="Emergency sequences" right={round ? `${Math.min(i + 1, total)} / ${total}` : undefined} />;
  if (!round)
    return (
      <>
        {header}
        <StartCard title="Emergency sequences" count={pool.length} noun="emergencies" onStart={start}>
          Put the steps in the order you would do them. Tap a step to add it; tap a placed step to take it back.
        </StartCard>
      </>
    );
  if (finished) return <>{header}<RoundSummary score={score} total={total} onAgain={start} /></>;

  const { s, offered } = round[i];
  const right = order.length === s.steps.length && order.every((k, n) => k === n);
  const check = () => {
    setChecked(true);
    recordDrill(right);
    if (right) {
      setScore((x) => x + 1);
      removeMistake(`seq:${s.id}`);
    } else
      addMistake({ id: `seq:${s.id}`, kind: "sequence", rotation: s.rotation, prompt: `${s.title}. ${s.prompt}`, answer: s.steps.map((t, n) => `${n + 1}. ${t}`).join("\n"), why: s.why });
  };
  const next = () => {
    if (i >= total - 1) setFinished(true);
    else {
      setI(i + 1);
      setOrder([]);
      setChecked(false);
    }
  };
  const pickable = offered.filter((k) => !order.includes(k));
  return (
    <>
      {header}
      <div className="flex flex-col gap-3">
        <span className="chip self-start !border-transparent !bg-bad-soft !text-bad">{s.area}</span>
        <h2 className="font-serif text-[28px] leading-[1.1]">{s.title}</h2>
        <p className="text-[14.5px] leading-relaxed text-ink-2">{s.prompt}</p>
        <Label>Your order · tap the steps in order</Label>
        <ol className="flex min-h-10 flex-col gap-1.5">
          {order.map((k, n) => (
            <li key={k}>
              <button
                type="button"
                disabled={checked}
                onClick={() => setOrder(order.filter((x) => x !== k))}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[14px] leading-snug",
                  !checked && "border-line bg-surface",
                  checked && (k === n ? "border-good/30 bg-good-soft" : "border-bad/30 bg-bad-soft"),
                )}
              >
                <span className={clsx("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white", !checked ? "bg-brand" : k === n ? "bg-good" : "bg-bad")}>{n + 1}</span>
                <span className="flex-1">{s.steps[k]}</span>
              </button>
            </li>
          ))}
        </ol>
        {pickable.length > 0 && (
          <>
            <Label>Steps</Label>
            <div className="flex flex-col gap-1.5">
              {pickable.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOrder([...order, k])}
                  className="rounded-xl border border-dashed border-line-strong bg-surface px-3 py-2.5 text-left text-[14px] leading-snug hover:bg-surface-2"
                >
                  {s.steps[k]}
                </button>
              ))}
            </div>
          </>
        )}
        {checked && (
          <Verdict ok={right} title={right ? "Correct order" : "Not quite: the red steps are out of place."}>
            {!right && (
              <ol className="mb-2 list-decimal space-y-0.5 pl-5">
                {s.steps.map((t, n) => (
                  <li key={n}>{t}</li>
                ))}
              </ol>
            )}
            {s.why}
          </Verdict>
        )}
        <Actions>
          <button className="btn btn-outline min-h-12" disabled={checked} onClick={() => setOrder([])}>
            Reset
          </button>
          {!checked ? (
            <button className="btn btn-pink min-h-12 flex-1 text-[15px]" disabled={order.length < s.steps.length} onClick={check}>
              Check order
            </button>
          ) : (
            <button className="btn btn-primary min-h-12 flex-1 text-[15px]" onClick={next}>
              {i >= total - 1 ? "See score" : "Next emergency"}
            </button>
          )}
        </Actions>
      </div>
    </>
  );
}
