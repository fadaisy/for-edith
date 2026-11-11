import type { DoseRule } from "@/lib/practice-types";

export interface DoseQuestion {
  rule: DoseRule;
  weight: number | null;
  ageMonths: number | null;
  answer: number;
  working: string;
}

const round = (n: number) => Math.round(n * 100) / 100;
export const fmtNum = (n: number) => (Number.isInteger(n) ? n : round(n)).toLocaleString("en-GB");

export function fmtAge(m: number): string {
  if (m < 24) return `${m}-month-old`;
  const y = Math.floor(m / 12);
  return `${y}-year-old`;
}

/** "9 months", "3 years". */
export const ageText = (m: number) => (m < 24 ? `${m} months` : `${Math.floor(m / 12)} years`);

function pick(min: number, max: number, step: number): number {
  const n = Math.floor((max - min) / step + 1e-9);
  return round(min + Math.floor(Math.random() * (n + 1)) * step);
}

/** Computes the correct dose and a worked explanation for a rule at a weight/age. */
export function solve(rule: DoseRule, weight: number | null, ageMonths: number | null): { answer: number; working: string } {
  const c = rule.compute;
  const u = rule.unit;
  let answer: number;
  let working: string;
  switch (c.type) {
    case "perKg": {
      if (weight === null) throw new Error("weight needed");
      answer = round(weight * c.perKg);
      working = `${fmtNum(weight)} kg × ${fmtNum(c.perKg)} ${u}/kg = ${fmtNum(answer)} ${u}.`;
      break;
    }
    case "tiered": {
      if (weight === null) throw new Error("weight needed");
      const tier = c.tiers.find((t) => t.belowKg === undefined || weight < t.belowKg) ?? c.tiers[c.tiers.length - 1];
      answer = round(weight * tier.perKg);
      working = `${fmtNum(weight)} kg is ${tier.belowKg !== undefined ? `under ${tier.belowKg} kg` : `${c.tiers[0].belowKg} kg or more`}, so ${fmtNum(tier.perKg)} ${u}/kg: ${fmtNum(weight)} × ${fmtNum(tier.perKg)} = ${fmtNum(answer)} ${u}.`;
      break;
    }
    case "holliday": {
      if (weight === null) throw new Error("weight needed");
      const a = Math.min(weight, 10);
      const b = Math.min(Math.max(weight - 10, 0), 10);
      const d = Math.max(weight - 20, 0);
      answer = round(a * 100 + b * 50 + d * 20);
      const parts = [`${fmtNum(a)} × 100 = ${fmtNum(a * 100)}`];
      if (b) parts.push(`${fmtNum(b)} × 50 = ${fmtNum(b * 50)}`);
      if (d) parts.push(`${fmtNum(d)} × 20 = ${fmtNum(d * 20)}`);
      working = `${parts.join(" + ")} = ${fmtNum(answer)} mL in 24 h (about ${fmtNum(Math.round(answer / 24))} mL/h).`;
      break;
    }
    case "fixed": {
      answer = c.value;
      working = `Fixed dose, not weight-based: ${fmtNum(answer)} ${u}.`;
      break;
    }
    case "ageBand": {
      if (ageMonths === null) throw new Error("age needed");
      const band = c.bands.find((b) => b.belowMonths === undefined || ageMonths < b.belowMonths) ?? c.bands[c.bands.length - 1];
      answer = band.value;
      working = `At ${ageMonths} months the band gives ${fmtNum(answer)} ${u}.`;
      break;
    }
  }
  if (rule.max && answer > rule.max.value) {
    working += ` That is above the maximum of ${fmtNum(rule.max.value)} ${u}, so give ${fmtNum(rule.max.value)} ${u}.`;
    answer = rule.max.value;
  } else if (rule.max) working += ` Under the maximum of ${fmtNum(rule.max.value)} ${u}.`;
  if (rule.id === "ors-plan-b") working += ` Over 4 hours that is about ${fmtNum(Math.round(answer / 4))} mL/h.`;
  return { answer, working };
}

export function makeQuestion(rule: DoseRule): DoseQuestion {
  const weight = rule.weight ? pick(rule.weight.min, rule.weight.max, rule.weight.step) : null;
  const ageMonths = rule.age ? pick(rule.age.minMonths, rule.age.maxMonths, 1) : null;
  return { rule, weight, ageMonths, ...solve(rule, weight, ageMonths) };
}

/** Is the typed answer within 5% of the correct one? */
export const isClose = (typed: number, answer: number) => Number.isFinite(typed) && Math.abs(typed - answer) <= Math.abs(answer) * 0.05;

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
