import type { Metadata } from "next";
import { VivaGame } from "@/components/practice/viva";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Ward round & viva" };

export default function Page() {
  return (
    <div className="mx-auto max-w-xl">
      <VivaGame />
    </div>
  );
}
