import type { Metadata } from "next";
import { DataGame } from "@/components/practice/data-drill";
import { dataItems } from "@/lib/practice";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Data interpretation" };

export default function Page() {
  return (
    <div className="mx-auto max-w-xl">
      <DataGame items={dataItems()} />
    </div>
  );
}
