"use client";

import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import clsx from "clsx";
import type { SpotCard } from "@/lib/practice-types";
import { shuffle } from "@/lib/dose";
import { addMistake, recordDrill, removeMistake } from "@/lib/practice-store";
import { Actions, DrillHeader, EmptyNote, Label, RoundSummary, StartCard, TimerRing, TopicLink, Verdict, useCountdown, usePool } from "./shared";

const LIMIT = 30;
const ROUND = 10;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Does the typed diagnosis match the answer or anything on its accept list? */
export function matches(guess: string, card: Pick<SpotCard, "answer" | "accept">): boolean {
  const g = norm(guess);
  if (!g) return false;
  return [card.answer, ...card.accept].map(norm).some((a) => a && (g === a || ` ${g} `.includes(` ${a} `) || (a.includes(g) && g.length >= 5)));
}

type Phase = "ask" | "right" | "wrong" | "timeout" | "reveal";

/** Longest run of right answers and the run still going at the end. */
function streaks(results: (boolean | undefined)[]) {
  let cur = 0;
  let best = 0;
  for (const r of results) {
    cur = r ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return { cur, best };
}

export function SpotGame({ cards }: { cards: SpotCard[] }) {
  const pool = usePool(cards);
  const [round, setRound] = useState<SpotCard[] | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const start = () => {
    setRound(shuffle(pool).slice(0, ROUND));
    setI(0);
    setResults([]);
    setFinished(false);
  };
  const { cur, best } = streaks(results);

  if (!pool.length) return <EmptyNote>Spot-diagnosis cards for this rotation are being written. Try another drill.</EmptyNote>;

  const header = <DrillHeader title="Spot diagnosis" right={<span className="inline-flex items-center gap-1"><Flame size={15} />Streak {cur}</span>} />;
  if (!round)
    return (
      <>
        {header}
        <StartCard title="Spot diagnosis" count={pool.length} noun="cards" onStart={start}>
          You get 30 seconds, one line of history and one sign. Type the diagnosis and check it. {Math.min(ROUND, pool.length)} cards a round.
        </StartCard>
      </>
    );
  if (finished)
    return (
      <>
        {header}
        <RoundSummary score={results.filter(Boolean).length} total={round.length} onAgain={start}>
          <div className="text-[15px] text-ink-2">
            Best streak this round: <b className="text-ink">{best}</b>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
            {round.map((c, k) => (
              <div key={c.id} className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5 text-[14px] last:border-0">
                <span className={clsx("w-5 text-center font-bold", results[k] ? "text-good" : "text-bad")}>{results[k] ? "✓" : "✗"}</span>
                <span className="flex-1">{c.answer}</span>
              </div>
            ))}
          </div>
        </RoundSummary>
      </>
    );

  const card = round[i];
  const resolve = (right: boolean) => {
    recordDrill(right);
    if (!right)
      addMistake({ id: `spot:${card.id}`, kind: "spot", rotation: card.rotation, prompt: `${card.history} ${card.sign}`, answer: card.answer, why: card.why, topic: card.topic });
    else removeMistake(`spot:${card.id}`);
    setResults((r) => {
      const n = [...r];
      n[i] = right;
      return n;
    });
  };
  const override = () => {
    removeMistake(`spot:${card.id}`);
    setResults((r) => r.map((x, k) => (k === i ? true : x)));
  };
  return (
    <>
      {header}
      <SpotCardView
        key={card.id}
        card={card}
        pos={i + 1}
        total={round.length}
        last={i >= round.length - 1}
        onResolve={resolve}
        onOverride={override}
        onNext={() => (i >= round.length - 1 ? setFinished(true) : setI(i + 1))}
      />
    </>
  );
}

function SpotCardView({
  card,
  pos,
  total,
  last,
  onResolve,
  onOverride,
  onNext,
}: {
  card: SpotCard;
  pos: number;
  total: number;
  last: boolean;
  onResolve: (right: boolean) => void;
  onOverride: () => void;
  onNext: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [guess, setGuess] = useState("");
  const asking = phase === "ask";
  const left = useCountdown(LIMIT, asking, () => {
    setPhase("timeout");
    onResolve(false);
  });
  const finish = (p: Phase) => {
    setPhase(p);
    onResolve(p === "right");
  };
  const check = () => {
    if (!norm(guess)) return;
    finish(matches(guess, card) ? "right" : "wrong");
  };
  const titles = useMemo(
    () => ({
      right: `Correct · ${card.answer}`,
      wrong: `Not quite · it is ${card.answer}`,
      timeout: `Time's up · it is ${card.answer}`,
      reveal: `Answer · ${card.answer}`,
      ask: "",
    }),
    [card.answer],
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-soft">
          <div className="h-full bg-brand transition-all" style={{ width: `${((pos - 1 + (asking ? 0 : 1)) / total) * 100}%` }} />
        </div>
        <span className="text-[12.5px] text-ink-3 tabular-nums">
          {pos} / {total}
        </span>
      </div>
      <section className="card flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="chip !border-transparent !bg-lilac-soft !text-lilac-text">{card.area}</span>
          <span className="ml-auto">
            <TimerRing left={asking ? left : phase === "timeout" ? 0 : left} total={LIMIT} />
          </span>
        </div>
        <Label>History</Label>
        <p className="-mt-1.5 text-[18px] font-medium leading-snug">{card.history}</p>
        <Label>Sign</Label>
        <p className="-mt-1.5 text-[18px] font-medium leading-snug">{card.sign}</p>
      </section>

      {asking && (
        <div className="flex flex-col gap-2">
          <label htmlFor="spot-guess" className="text-[13px] font-medium text-ink-2">
            Your diagnosis
          </label>
          <input
            id="spot-guess"
            className="input h-12 text-[16px]"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder="Type it, then Check"
          />
        </div>
      )}
      {!asking && (
        <Verdict ok={phase === "right"} title={titles[phase]}>
          {card.why}
          <div className="mt-2">
            <TopicLink slug={card.topic} />
          </div>
        </Verdict>
      )}
      <Actions>
        {asking ? (
          <>
            <button className="btn btn-outline min-h-12" onClick={() => finish("reveal")}>
              Reveal
            </button>
            <button className="btn btn-pink min-h-12 flex-1 text-[15px]" onClick={check}>
              Check
            </button>
          </>
        ) : (
          <>
            {phase === "wrong" && (
              <button
                className="btn btn-outline min-h-12"
                onClick={() => {
                  setPhase("right");
                  onOverride();
                }}
              >
                I meant that
              </button>
            )}
            <button className="btn btn-primary min-h-12 flex-1 text-[15px]" onClick={onNext}>
              {last ? "See score" : "Next case"}
            </button>
          </>
        )}
      </Actions>
    </div>
  );
}
