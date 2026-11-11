import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { PracticeHub } from "@/components/practice/hub";
import { osceStations } from "@/lib/practice";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Practice lab" };

export default function PracticePage() {
  const stations = osceStations().map(({ slug, title, kind, minutes, steps, critical }) => ({ slug, title, kind, minutes, steps, critical }));
  return (
    <>
      <PageHeader eyebrow="Drills · stations · mock exams" title="Practice lab">
        Quick drills for the bus, stations for the weekend, mock exams before tests.
      </PageHeader>
      <PracticeHub stations={stations} />
    </>
  );
}
