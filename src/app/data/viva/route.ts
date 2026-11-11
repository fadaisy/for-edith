import { vivaItems } from "@/lib/practice";

export const dynamic = "force-static";

/** Every "Questions seniors ask" Q&A from all topics; the viva page filters to the active rotation. */
export async function GET() {
  return Response.json(vivaItems());
}
