import type { Metadata } from "next";
import { SequenceGame } from "@/components/practice/sequences";
import { sequenceItems } from "@/lib/practice";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Emergency sequences" };

export default function Page() {
  return (
    <div className="mx-auto max-w-xl">
      <SequenceGame items={sequenceItems()} />
    </div>
  );
}
