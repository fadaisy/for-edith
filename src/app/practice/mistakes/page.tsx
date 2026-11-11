import type { Metadata } from "next";
import { MistakesDeck } from "@/components/practice/mistakes";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Mistakes deck" };

export default function Page() {
  return <MistakesDeck />;
}
