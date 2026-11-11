import type { Metadata } from "next";
import { DoseGame } from "@/components/practice/dose";
import { doseRules } from "@/lib/practice";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Dose calculation" };

export default function Page() {
  return (
    <div className="mx-auto max-w-xl">
      <DoseGame rules={doseRules()} />
    </div>
  );
}
