"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { VivaItem } from "@/lib/practice-types";
import { shuffle } from "@/lib/dose";
import { addMistake, recordDrill, removeMistake } from "@/lib/practice-store";
import { useRotation } from "@/lib/use-rotation";
import { ROTATIONS } from "@/content/rotations";
import { TOPIC_BY_SLUG } from "@/content/curriculum";
import { Actions, DrillHeader, EmptyNote, Inline, RoundSummary, StartCard, TimerRing, TopicLink, useCountdown } from "./shared";

const LIMIT = 60;
const ROUND = 10;
type Rating = "got" | "partly" | "missed";

export function VivaGame() {
  const { slugs, id } = useRotation();
  const [all, setAll] = useState<VivaItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState<VivaItem[] | null>(null);
  const [i, setI] = useState(0);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/data/viva")
      .then((r) => r.json())
      .then((d: VivaItem[]) => live && setAll(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const pool = (all ?? []).filter((v) => slugs.has(v.topic));
  const start = () => {
    setRound(shuffle(pool).slice(0, ROUND));
    setI(0);
    setRatings([]);
    setFinished(false);
  };
  const header = <DrillHeader title="Ward round & viva" right={round ? `${Math.min(i + 1, round.length)} / ${round.length}` : undefined} />;

  if (failed) return <>{header}<EmptyNote>Could not load the questions. Check your connection and reload.</EmptyNote></>;
  if (!all) return <>{header}<EmptyNote>Loading questions…</EmptyNote></>;
  if (!pool.length) return <>{header}<EmptyNote>No questions for {ROTATIONS[id].name} yet.</EmptyNote></>;
  if (!round)
    return (
      <>
        {header}
        <StartCard title="Ward-round rapid fire" count={pool.length} noun="questions seniors ask" onStart={start}>
          A question a senior might ask on the ward round. You get 60 seconds to answer out loud, then reveal the model answer and rate yourself. Missed ones go
          to your mistakes deck.
        </StartCard>
      </>
    );
  if (finished) {
    const got = ratings.filter((r) => r === "got").length;
    return (
      <>
        {header}
        <RoundSummary score={got} total={round.length} onAgain={start}>
          <p className="text-[14.5px] text-ink-2">
            {ratings.filter((r) => r === "partly").length} partly right · {ratings.filter((r) => r === "missed").length} missed (saved to the mistakes deck).
          </p>
          <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
            {round.map((v, k) => (
              <div key={v.id} className="flex items-start gap-2.5 border-b border-line px-3.5 py-2.5 text-[14px] leading-snug last:border-0">
                <span className={clsx("w-5 text-center font-bold", ratings[k] === "got" ? "text-good" : ratings[k] === "partly" ? "text-warn" : "text-bad")}>
                  {ratings[k] === "got" ? "✓" : ratings[k] === "partly" ? "~" : "✗"}
                </span>
                <span className="flex-1"><Inline>{v.q}</Inline></span>
              </div>
            ))}
          </div>
        </RoundSummary>
      </>
    );
  }

  const v = round[i];
  const rate = (r: Rating) => {
    recordDrill(r === "got");
    const mid = `viva:${v.id}`;
    if (r === "missed")
      addMistake({ id: mid, kind: "viva", rotation: TOPIC_BY_SLUG[v.topic]?.rotation ?? id, prompt: v.q, answer: v.a, topic: v.topic });
    else if (r === "got") removeMistake(mid);
    setRatings((x) => [...x, r]);
    if (i >= round.length - 1) setFinished(true);
    else setI(i + 1);
  };
  return (
    <>
      {header}
      <VivaCard key={v.id} item={v} onRate={rate} last={i >= round.length - 1} />
    </>
  );
}

function VivaCard({ item, onRate, last }: { item: VivaItem; onRate: (r: Rating) => void; last: boolean }) {
  const [shown, setShown] = useState(false);
  const left = useCountdown(LIMIT, !shown, () => setShown(true));
  return (
    <div className="flex flex-col gap-3">
      <section className="card flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="chip !border-transparent !bg-lilac-soft !text-lilac-text">{item.title}</span>
          <span className="ml-auto">
            <TimerRing left={left} total={LIMIT} />
          </span>
        </div>
        <p className="text-[18px] font-medium leading-snug">
          <Inline>{item.q}</Inline>
        </p>
      </section>
      {shown ? (
        <>
          <section className="rounded-2xl bg-surface-2 p-4 text-[14.5px] leading-relaxed">
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">Model answer</div>
            <Inline>{item.a}</Inline>
            <div className="mt-2">
              <TopicLink slug={item.topic} />
            </div>
          </section>
          <div className="text-[13px] font-medium text-ink-2">How did you do{last ? " (last question)" : ""}?</div>
          <Actions>
            <button className="btn btn-outline min-h-12 flex-1 !border-bad/40 text-bad" onClick={() => onRate("missed")}>
              Missed
            </button>
            <button className="btn btn-outline min-h-12 flex-1" onClick={() => onRate("partly")}>
              Partly
            </button>
            <button className="btn btn-pink min-h-12 flex-1" onClick={() => onRate("got")}>
              Got it
            </button>
          </Actions>
        </>
      ) : (
        <Actions>
          <button className="btn btn-primary min-h-12 flex-1 text-[15px]" onClick={() => setShown(true)}>
            Reveal answer
          </button>
        </Actions>
      )}
    </div>
  );
}
