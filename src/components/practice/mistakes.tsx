"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { StudyData } from "@/lib/types";
import { useStudy } from "@/lib/store/study-store";
import { useRotation } from "@/lib/use-rotation";
import { shuffle } from "@/lib/dose";
import { removeMistake, usePracticeData, type MistakeKind } from "@/lib/practice-store";
import { QuizRunner, type QuizQuestion } from "@/components/quiz-runner";
import { DrillHeader, EmptyNote, Inline, Label } from "./shared";

const KIND: Record<MistakeKind, string> = { viva: "Viva", spot: "Spot diagnosis", dose: "Dose", sequence: "Sequence", data: "Data" };

export function MistakesDeck() {
  const { state } = useStudy();
  const { slugs, rotation, id } = useRotation();
  const { mistakes } = usePracticeData();
  const mine = mistakes.filter((m) => m.rotation === id);

  const wrongIds = useMemo(
    () => Object.entries(state.questions).filter(([, q]) => q.lastCorrect === false && slugs.has(q.topic)),
    [state.questions, slugs],
  );
  const wrongTopics = useMemo(() => [...new Set(wrongIds.map(([, q]) => q.topic))].sort(), [wrongIds]);
  const topicKey = wrongTopics.join(",");

  const [bank, setBank] = useState<QuizQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState<QuizQuestion[] | null>(null);

  useEffect(() => {
    let live = true;
    const slugsToLoad = topicKey ? topicKey.split(",") : [];
    Promise.all(slugsToLoad.map((s) => fetch(`/data/topic/${s}`).then((r) => r.json() as Promise<StudyData & { title: string }>)))
      .then((data) => {
        if (!live) return;
        setBank(data.flatMap((d) => d.mcqs.map((q) => ({ ...q, topic: d.slug, topicTitle: d.title }))));
        setLoaded(true);
      })
      .catch(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [topicKey]);

  const wrongSet = useMemo(() => new Set(wrongIds.map(([qid]) => qid)), [wrongIds]);
  const questions = useMemo(() => bank.filter((q) => wrongSet.has(q.id)), [bank, wrongSet]);
  const total = questions.length + mine.length;

  if (running)
    return (
      <div className="mx-auto max-w-3xl">
        <QuizRunner questions={running} mode="practice" onExit={() => setRunning(null)} />
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <DrillHeader title="Mistakes deck" right={total ? `${total} to redo` : undefined} />
      <p className="mb-4 text-[14.5px] leading-relaxed text-ink-2" data-rot-scoped>
        Everything you got wrong in {rotation.name} comes back here until you get it right.
      </p>
      {total === 0 && loaded && <EmptyNote>Nothing to redo. Questions and drill items you miss will appear here.</EmptyNote>}

      {questions.length > 0 && (
        <section className="card mb-5 flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{questions.length} wrong MCQs</div>
            <div className="text-[13px] text-ink-3">Redo them one by one with the explanation after each.</div>
          </div>
          <button className="btn btn-pink" onClick={() => setRunning(shuffle(questions))}>
            <RotateCcw size={15} /> Redo
          </button>
        </section>
      )}

      {mine.length > 0 && (
        <section className="space-y-3">
          <Label>Missed drill items</Label>
          {mine.map((m) => (
            <MistakeCard key={m.id} id={m.id} kind={KIND[m.kind]} prompt={m.prompt} answer={m.answer} why={m.why} topic={m.topic} />
          ))}
        </section>
      )}
    </div>
  );
}



function MistakeCard({ id, kind, prompt, answer, why, topic }: { id: string; kind: string; prompt: string; answer: string; why?: string; topic?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="card flex flex-col gap-2.5 p-4">
      <span className="chip self-start">{kind}</span>
      <p className="text-[15px] font-medium leading-snug">
        <Inline>{prompt}</Inline>
      </p>
      {shown ? (
        <>
          <div className="whitespace-pre-line rounded-xl bg-surface-2 p-3 text-[14px] leading-relaxed">
            <Inline>{answer}</Inline>
            {why && <div className="mt-2 text-ink-2"><Inline>{why}</Inline></div>}
            {topic && (
              <Link href={`/topics/${topic}`} className="mt-2 block text-[13px] font-medium text-brand-text">
                Open the notes
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-outline flex-1" onClick={() => setShown(false)}>
              Still shaky
            </button>
            <button className="btn btn-pink flex-1" onClick={() => removeMistake(id)}>
              Got it now
            </button>
          </div>
        </>
      ) : (
        <button className="btn btn-outline min-h-0 self-start py-1.5 text-[13px]" onClick={() => setShown(true)}>
          Show answer
        </button>
      )}
    </div>
  );
}
