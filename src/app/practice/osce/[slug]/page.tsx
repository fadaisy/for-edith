import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OsceStationView } from "@/components/practice/osce";
import { osceStation, osceStations } from "@/lib/practice";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return osceStations().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(props: PageProps<"/practice/osce/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { title: `OSCE: ${osceStation(slug)?.title ?? "station"}` };
}

export default async function Page(props: PageProps<"/practice/osce/[slug]">) {
  const { slug } = await props.params;
  const station = osceStation(slug);
  if (!station) notFound();
  return <OsceStationView station={station} />;
}
