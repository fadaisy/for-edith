import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { TOPICS } from "@/content/curriculum";
import { isRotationId } from "@/content/rotations";
import { splitSections } from "@/lib/note-format.mjs";
import type { DataItem, DoseRule, OsceStation, OsceStationLite, QA, SequenceItem, SpotCard, VivaItem } from "@/lib/practice-types";

const PRACTICE_DIR = path.join(process.cwd(), "content", "practice");
const TOPICS_DIR = path.join(process.cwd(), "content", "topics");

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isStrArr = (v: unknown, min = 1): v is string[] => Array.isArray(v) && v.length >= min && v.every(isStr);
const rec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads a content/practice JSON list, keeping only entries `ok` accepts (warns about the rest). */
function loadList<T>(file: string, ok: (v: Record<string, unknown>) => boolean): T[] {
  const p = path.join(PRACTICE_DIR, file);
  if (!fs.existsSync(p)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    console.warn(`[practice] ${file} is not valid JSON`);
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const list = raw.filter((v): v is Record<string, unknown> => rec(v) && ok(v));
  if (list.length !== raw.length) console.warn(`[practice] ${file}: skipped ${raw.length - list.length} invalid entries`);
  return list as T[];
}

const base = (v: Record<string, unknown>) => isStr(v.id) && isRotationId(v.rotation);

export const spotCards = cache(() =>
  loadList<SpotCard>("spot.json", (v) => base(v) && isStr(v.area) && isStr(v.history) && isStr(v.sign) && isStr(v.answer) && isStrArr(v.accept, 0) && isStr(v.why)),
);
export const sequenceItems = cache(() =>
  loadList<SequenceItem>("sequences.json", (v) => base(v) && isStr(v.title) && isStr(v.prompt) && isStrArr(v.steps, 3) && isStr(v.why)),
);
export const dataItems = cache(() =>
  loadList<DataItem>(
    "data.json",
    (v) =>
      base(v) &&
      isStr(v.stem) &&
      isStr(v.q) &&
      isStr(v.why) &&
      isStrArr(v.opts, 2) &&
      typeof v.answer === "number" &&
      Array.isArray(v.data) &&
      v.data.every((r) => rec(r) && isStr(r.k) && isStr(r.v)),
  ),
);
export const doseRules = cache(() =>
  loadList<DoseRule>("dose-rules.json", (v) => base(v) && isStr(v.drug) && isStr(v.unit) && rec(v.compute) && isStr(v.rule) && isStr(v.ask)),
);

// ── Notes parsing ────────────────────────────────────────────

const clean = (s: string) => s.replace(/\[VERIFY[^\]]*\]/g, "").replace(/\s+/g, " ").trim();

/** Cells of one markdown table row, honouring `\|`. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\\" && t[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (t[i] === "|") {
      out.push(cur.trim());
      cur = "";
    } else cur += t[i];
  }
  out.push(cur.trim());
  return out;
}

/** The OSCE checklist table (Step | Done well when | Critical?) of a section body, or null. */
export function parseChecklist(body: string) {
  const rows = body.split("\n").filter((l) => l.trim().startsWith("|"));
  if (rows.length < 3) return null;
  const head = cells(rows[0]).map((c) => c.toLowerCase());
  if (!head[0]?.startsWith("step") || !/^-+:?$|^:?-+:?$/.test(cells(rows[1])[0] ?? "")) return null;
  const critCol = head.findIndex((h) => h.startsWith("critical"));
  if (critCol < 1) return null;
  const steps = rows.slice(2).flatMap((r) => {
    const c = cells(r);
    const text = clean(c[0] ?? "");
    if (!text) return [];
    return [{ text, hint: critCol > 1 ? clean(c[1] ?? "").replace(/^[–-]$/, "") : "", critical: /^(yes|y|critical)\b/i.test((c[critCol] ?? "").replace(/\*/g, "").trim()) }];
  });
  return steps.length >= 3 ? steps : null;
}

/** Q/A pairs from the "### Questions seniors ask" list(s). Items look like `1. *Question?* Answer` or `- **Question?** Answer`. */
export function parseQuestions(body: string): QA[] {
  const m = body.match(/^###\s+Questions seniors ask\s*$([\s\S]*?)(?=^#{2,3}\s|(?![\s\S]))/m);
  if (!m) return [];
  const items: string[] = [];
  for (const line of m[1].split("\n")) {
    const start = line.match(/^(?:\d+[.)]|[-*])\s+(.*)$/);
    if (start) items.push(start[1]);
    else if (/^\s+\S/.test(line) && items.length) items[items.length - 1] += " " + line.trim();
  }
  const out: QA[] = [];
  for (const it of items) {
    const p =
      it.match(/^\*\*([\s\S]+?)\*\*\s*([\s\S]*)$/) ?? it.match(/^\*(?!\*)([\s\S]+?)\*\s*([\s\S]*)$/) ?? it.match(/^_([\s\S]+?)_\s*([\s\S]*)$/) ?? it.match(/^([\s\S]+?\?)\s+([\s\S]+)$/);
    if (!p) continue;
    const q = clean(p[1]);
    const a = clean(p[2]);
    if (q.length > 8 && a.length > 3) out.push({ q, a });
  }
  return out;
}

/** First paragraph of a section as plain text (a leading bullet marker is dropped). */
function firstParagraph(body: string): string {
  const para = body.split(/\n\s*\n/).find((p) => p.trim()) ?? "";
  const first = para.split("\n").find((l) => l.trim()) ?? "";
  return clean(first.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""));
}

function kindOf(slug: string): { kind: OsceStationLite["kind"]; minutes: number } {
  if (/exam|history/.test(slug)) return { kind: "Examination", minutes: 7 };
  if (/delivery|caesarean|mva|resuscitation|instruments|infection/.test(slug)) return { kind: "Procedure", minutes: 10 };
  return { kind: "Skill", minutes: 7 };
}

interface Parsed {
  stations: OsceStation[];
  viva: VivaItem[];
  skipped: { slug: string; reason: string }[];
}

const parseAll = cache((): Parsed => {
  const stations: OsceStation[] = [];
  const viva: VivaItem[] = [];
  const skipped: Parsed["skipped"] = [];
  for (const t of TOPICS) {
    const file = path.join(TOPICS_DIR, t.slug, "notes.md");
    if (!fs.existsSync(file)) continue;
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    const { sections } = splitSections(content);
    // Key Points is section 11 in skills notes and 14 in disease notes; find it by its heading.
    const sq = sections.find((s) => /^###\s+Questions seniors ask\s*$/m.test(s.body));
    const qs = sq ? parseQuestions(sq.body) : [];
    qs.forEach((qa, i) => viva.push({ id: `${t.slug}:${i}`, topic: t.slug, title: t.title, ...qa }));
    if (data.format !== "skill") continue;
    const s10 = sections.find((s) => s.n === 10 && /osce/i.test(s.title));
    const steps = s10 ? parseChecklist(s10.body) : null;
    if (!steps) {
      skipped.push({ slug: t.slug, reason: s10 ? "checklist table could not be parsed" : "no OSCE checklist section" });
      continue;
    }
    const s1 = sections.find((s) => s.n === 1);
    let scenario = (s1 && firstParagraph(s1.body)) || clean(String(data.summary ?? t.blurb));
    if (scenario.length > 360) scenario = clean(String(data.summary ?? "")) || scenario.slice(0, 360);
    const { kind, minutes } = kindOf(t.slug);
    stations.push({
      slug: t.slug,
      title: t.title,
      kind,
      minutes,
      steps: steps.length,
      critical: steps.filter((s) => s.critical).length,
      scenario,
      stepList: steps,
      questions: qs.slice(0, 5),
    });
  }
  if (skipped.length) console.warn("[practice] OSCE stations skipped:", skipped.map((s) => `${s.slug} (${s.reason})`).join(", "));
  return { stations, viva, skipped };
});

export const osceStations = () => parseAll().stations;
export const osceStation = (slug: string) => parseAll().stations.find((s) => s.slug === slug) ?? null;
export const vivaItems = () => parseAll().viva;
export const osceSkipped = () => parseAll().skipped;
