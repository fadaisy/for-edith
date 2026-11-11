"use client";

import { useState } from "react";
import { ROTATIONS } from "@/content/rotations";
import type { DoseRule } from "@/lib/practice-types";
import { ageText, fmtAge, fmtNum, isClose, makeQuestion, shuffle, type DoseQuestion } from "@/lib/dose";
import { addMistake, recordDrill } from "@/lib/practice-store";
import { useRotation } from "@/lib/use-rotation";
import { Actions, DrillHeader, EmptyNote, RoundSummary, StartCard, Verdict } from "./shared";

const ROUND = 8;

/** Questions for a round: the active rotation's rules; if there are few, the other rotation's fill the round. */
function buildRound(rules: DoseRule[], active: string): DoseQuestion[] {
  const own = rules.filter((r) => r.rotation === active);
  const pool = own.length >= 5 ? own : [...own, ...shuffle(rules.filter((r) => r.rotation !== active))];
  return shuffle(pool)
    .slice(0, ROUND)
    .map((r) => makeQuestion(r));
}

export function DoseGame({ rules }: { rules: DoseRule[] }) {
  const { id, rotation } = useRotation();
  const [round, setRound] = useState<DoseQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const own = rules.filter((r) => r.rotation === id).length;
  if (!rules.length) return <EmptyNote>Dose rules are being written.</EmptyNote>;
  const start = () => {
    setRound(buildRound(rules, id));
    setI(0);
    setVal("");
    setChecked(null);
    setScore(0);
    setFinished(false);
  };
  const total = round?.length ?? 0;
  const header = <DrillHeader title="Dose calculation" right={round ? `${score} / ${total}` : undefined} />;

  if (!round)
    return (
      <>
        {header}
        <StartCard title="Dose calculation" count={own} noun="drug rules" onStart={start}>
          A weight and a drug: work out the dose. Answers within 5% count as right, and the working is always shown.
          {own < 5 && ` ${rotation.name} has few weight-based rules, so paediatric drugs are mixed in.`}
        </StartCard>
      </>
    );
  if (finished)
    return (
      <>
        {header}
        <RoundSummary score={score} total={total} onAgain={start}>
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            Always write the dose in mg (and mL of the preparation), state the maximum, and have a second person check high-risk drugs.
          </p>
        </RoundSummary>
      </>
    );

  const q = round[i];
  const check = () => {
    const v = parseFloat(val.replace(",", "."));
    if (Number.isNaN(v)) return;
    const right = isClose(v, q.answer);
    setChecked(right);
    if (right) setScore((s) => s + 1);
    else addMistake({ id: `dose:${q.rule.id}:${q.weight ?? q.ageMonths ?? 0}`, kind: "dose", rotation: q.rule.rotation, prompt: `${promptLine(q)} ${q.rule.ask}`, answer: `${fmtNum(q.answer)} ${q.rule.unit}`, why: `${q.rule.rule} ${q.working}` });
    recordDrill(right);
  };
  const next = () => {
    if (i >= total - 1) setFinished(true);
    else {
      setI(i + 1);
      setVal("");
      setChecked(null);
    }
  };
  return (
    <>
      {header}
      <div className="flex flex-col gap-3.5">
        <div className="text-[12.5px] text-ink-3">
          Question {i + 1} of {total} · {ROTATIONS[q.rule.rotation].short}
        </div>
        <section className="card flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            {q.weight !== null && <span className="font-serif text-[30px] leading-none">{fmtNum(q.weight)} kg</span>}
            {q.ageMonths !== null && <span className="font-serif text-[30px] leading-none">{ageText(q.ageMonths)}</span>}
            <span className="text-[13px] text-ink-3">{q.rule.who}</span>
          </div>
          <p className="text-[17px] font-medium leading-snug">{q.rule.ask}</p>
          <div className="rounded-[10px] bg-surface-2 px-2.5 py-2 text-[13px] text-ink-2">Rule: {q.rule.rule}</div>
        </section>
        <label htmlFor="dose-in" className="-mb-1.5 text-[13px] font-medium text-ink-2">
          Your answer ({q.rule.unit})
        </label>
        <input
          id="dose-in"
          className="input h-[52px] text-[20px]"
          type="number"
          inputMode="decimal"
          step="any"
          value={val}
          disabled={checked !== null}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (checked === null ? check() : next())}
        />
        {checked !== null && (
          <Verdict ok={checked} title={checked ? `Correct · ${fmtNum(q.answer)} ${q.rule.unit}` : `The answer is ${fmtNum(q.answer)} ${q.rule.unit}`}>
            {q.working}
          </Verdict>
        )}
        <Actions>
          {checked === null ? (
            <button className="btn btn-pink min-h-12 flex-1 text-[15px]" onClick={check}>
              Check
            </button>
          ) : (
            <button className="btn btn-primary min-h-12 flex-1 text-[15px]" onClick={next}>
              {i >= total - 1 ? "See score" : "Next question"}
            </button>
          )}
        </Actions>
      </div>
    </>
  );
}

function promptLine(q: DoseQuestion) {
  const bits = [q.ageMonths !== null ? fmtAge(q.ageMonths) : "", q.weight !== null ? `${fmtNum(q.weight)} kg` : "", q.rule.who].filter(Boolean);
  return `${bits.join(", ")}.`;
}
