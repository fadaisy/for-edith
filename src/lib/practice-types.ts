import type { RotationId } from "@/content/rotations";

export interface SpotCard {
  id: string;
  rotation: RotationId;
  area: string;
  history: string;
  sign: string;
  answer: string;
  accept: string[];
  why: string;
  topic: string;
}

export interface SequenceItem {
  id: string;
  rotation: RotationId;
  area: string;
  title: string;
  prompt: string;
  /** In the correct order. */
  steps: string[];
  why: string;
}

export interface DataItem {
  id: string;
  rotation: RotationId;
  kind: string;
  stem: string;
  data: { k: string; v: string }[];
  q: string;
  opts: string[];
  answer: number;
  why: string;
}

export type DoseCompute =
  | { type: "perKg"; perKg: number }
  | { type: "tiered"; tiers: { belowKg?: number; perKg: number }[] }
  | { type: "holliday" }
  | { type: "fixed"; value: number }
  | { type: "ageBand"; bands: { belowMonths?: number; value: number }[] };

export interface DoseRule {
  id: string;
  rotation: RotationId;
  drug: string;
  indication: string;
  /** Patient description, e.g. "child with severe malaria". */
  who: string;
  ask: string;
  rule: string;
  unit: string;
  weight: { min: number; max: number; step: number } | null;
  age: { minMonths: number; maxMonths: number } | null;
  compute: DoseCompute;
  max: { value: number } | null;
}

export interface OsceStep {
  text: string;
  critical: boolean;
  /** "Done well when" column. */
  hint: string;
}

export interface QA {
  q: string;
  a: string;
}

export interface OsceStationLite {
  slug: string;
  title: string;
  kind: "Examination" | "Procedure" | "Skill";
  minutes: number;
  steps: number;
  critical: number;
}

export interface OsceStation extends OsceStationLite {
  scenario: string;
  stepList: OsceStep[];
  questions: QA[];
}

export interface VivaItem extends QA {
  id: string;
  topic: string;
  title: string;
}
