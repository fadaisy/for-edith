import type { Metadata } from "next";
import { topicSummaries } from "@/lib/content";
import { ExamSimulator } from "@/components/practice/exam";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Exam simulator" };

export default function Page() {
  const topics = topicSummaries().map((t) => ({
    slug: t.slug,
    title: t.title,
    week: t.week,
    mcqs: t.counts.mcqs,
    rotation: t.rotation,
    ...(t.sharedWith ? { sharedWith: t.sharedWith } : {}),
  }));
  return <ExamSimulator topics={topics} />;
}
