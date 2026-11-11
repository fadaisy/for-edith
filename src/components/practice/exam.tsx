"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Play } from "lucide-react";
import type { RotationId } from "@/content/curriculum";
import { forRotation } from "@/content/rotations";
import type { StudyData } from "@/lib/types";
import { shuffle } from "@/lib/dose";
import { useRotation } from "@/lib/use-rotation";
import { QuizRunner, type QuizQuestion } from "@/components/quiz-runner";
import { DrillHeader, EmptyNote, Label } from "./shared";

export interface ExamTopic {
  slug: string;
  title: string;
  week: number;
  mcqs: number;
  rotation: RotationId;
  sharedWith?: RotationId[];
}

const SIZES = [30, 60, 100];

export function ExamSimulator({ topics: all }: { topics: ExamTopic[] }) {
  const { rotation, info } = useRotation();
  const topics = useMemo(() => forRotation(all, rotation.id), [all, rotation.id]);
  const [size, setSize] = useState(30);
  const [scope, setScope] = useState<"sofar" | "all">("sofar");
  const [running, setRunning] = useState<{ questions: QuizQuestion[]; minutes: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const sofar = topics.filter((t) => info.phase === "after" || (info.week !== null && t.week <= info.week));
  const hasSofar = info.phase !== "before" && sofar.length > 0;
  const chosen = scope === "sofar" && hasSofar ? sofar : topics;
  const available = chosen.reduce((n, t) => n + t.mcqs, 0);
  const weeksLabel = chosen === sofar && info.phase === "during" ? `weeks 1–${info.week}` : "all weeks";

  const start = async () => {
    setLoading(true);
    setErr("");
    try {
      const data: (StudyData & { title: string })[] = await Promise.all(chosen.map((t) => fetch(`/data/topic/${t.slug}`).then((r) => r.json())));
      const pool: QuizQuestion[] = data.flatMap((d) => d.mcqs.map((q) => ({ ...q, topic: d.slug, topicTitle: d.title })));
      const questions = shuffle(pool).slice(0, size);
      if (!questions.length) {
        setErr("No questions match. Try all weeks.");
        return;
      }
      setRunning({ questions, minutes: Math.ceil(questions.length * 1.2) });
      window.scrollTo({ top: 0 });
    } catch {
      setErr("Could not load the questions. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (running)
    return (
      <div className="mx-auto max-w-3xl">
        <QuizRunner questions={running.questions} mode="exam" timeLimitMin={running.minutes} onExit={() => setRunning(null)} />
      </div>
    );

  return (
    <div className="mx-auto max-w-xl">
      <DrillHeader title="Exam simulator" />
      <div className="card flex flex-col gap-5 p-5" data-rot-scoped>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          A timed, mixed single-best-answer paper from {rotation.name}. 1.2 minutes a question; flag, move around and submit like the real test. Answers are saved to
          your mistakes deck.
        </p>
        <div>
          <Label className="mb-1.5">Questions</Label>
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map((n) => (
              <Chip key={n} on={size === n} onClick={() => setSize(n)}>
                {n} · {Math.ceil(n * 1.2)} min
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <Label className="mb-1.5">Weeks covered</Label>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={scope === "sofar" && hasSofar} disabled={!hasSofar} onClick={() => setScope("sofar")}>
              {info.phase === "during" ? `So far (weeks 1–${info.week})` : "So far"}
            </Chip>
            <Chip on={scope === "all" || !hasSofar} onClick={() => setScope("all")}>
              All weeks
            </Chip>
          </div>
        </div>
        <div className="text-[13px] text-ink-3">
          {available} questions available in {weeksLabel}
          {available < size && available > 0 ? `; the paper will have ${available}.` : "."}
        </div>
        {err && <div className="text-[13.5px] text-bad">{err}</div>}
        <button className="btn btn-pink min-h-12 text-[15px]" disabled={loading || !available} onClick={start}>
          <Play size={16} /> {loading ? "Loading…" : "Start exam"}
        </button>
      </div>
      {!available && <EmptyNote>No questions yet for this selection.</EmptyNote>}
    </div>
  );
}

function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        "rounded-lg border px-3 py-1.5 text-[13px] font-medium disabled:opacity-40",
        on ? "border-brand-line bg-brand-soft text-brand-text" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
