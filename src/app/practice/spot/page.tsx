import type { Metadata } from "next";
import { SpotGame } from "@/components/practice/spot";
import { spotCards } from "@/lib/practice";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Spot diagnosis" };

export default function Page() {
  return (
    <div className="mx-auto max-w-xl">
      <SpotGame cards={spotCards()} />
    </div>
  );
}
