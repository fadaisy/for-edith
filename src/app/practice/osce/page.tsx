import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { OsceList } from "@/components/practice/osce";
import { osceStations } from "@/lib/practice";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "OSCE stations" };

export default function Page() {
  const stations = osceStations().map(({ slug, title, kind, minutes, steps, critical }) => ({ slug, title, kind, minutes, steps, critical }));
  return (
    <>
      <PageHeader eyebrow="Practice lab" title="OSCE stations">
        Each station is built from a skills topic&apos;s OSCE checklist: tick the steps against the clock, score yourself, then try the examiner&apos;s questions.
      </PageHeader>
      <OsceList stations={stations} />
    </>
  );
}
