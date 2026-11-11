#!/usr/bin/env node
// Validates every topic in content/topics against CONTENT_GUIDE.md.
// Usage: npm run validate [-- slug1 slug2 ...]   (--strict fails on missing topics)
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { studySchema, frontmatterSchema, structuredFrontmatterSchema } from "../src/lib/content-schema.mjs";
import { NOTE_FORMATS, FORMAT_NAMES, normTitle, splitSections, subheadings } from "../src/lib/note-format.mjs";
import { parseMermaid } from "../src/lib/rehype-notes.mjs";
import { topicHash, quickRefHash, readManifest } from "./pdf/hash.mjs";
import { TOPICS } from "../src/content/curriculum.ts";

const root = path.resolve(import.meta.dirname, "..");
// Every topic of every rotation (Obs & Gyn in curriculum.ts, Paediatrics in paeds-curriculum.ts).
const allSlugs = TOPICS.map((t) => t.slug);
const dupes = allSlugs.filter((s, i) => allSlugs.indexOf(s) !== i);

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const only = args.filter((a) => !a.startsWith("--"));
const slugs = only.length ? only : allSlugs;

const MIN = { flashcards: 20, mcqs: 12, cases: 2, references: 5, caseSteps: 4 };
// Old format (topics not yet converted). Structured notes (front-matter `format`) are
// checked by checkStructured() instead.
const REQUIRED_HEADINGS = [
  [/nutshell/i, "## In a nutshell"],
  [/clinical acumen/i, "## Clinical acumen"],
  [/management|procedure/i, "## Management"],
  [/clinical workup/i, "## Clinical workup"],
  [/high-yield summary/i, "## High-yield summary"],
];

let errors = 0;
let warnings = 0;
let missing = 0;
const err = (slug, msg) => (errors++, console.log(`  ✖ [${slug}] ${msg}`));
const warn = (slug, msg) => (warnings++, console.log(`  ⚠ [${slug}] ${msg}`));
const seenIds = new Map();
for (const d of new Set(dupes)) err(d, "slug is defined twice in the curriculum");

for (const slug of slugs) {
  if (!allSlugs.includes(slug)) {
    err(slug, "unknown slug (not in src/content/curriculum.ts or paeds-curriculum.ts)");
    continue;
  }
  const dir = path.join(root, "content/topics", slug);
  const notesPath = path.join(dir, "notes.md");
  const studyPath = path.join(dir, "study.json");
  if (!fs.existsSync(notesPath) && !fs.existsSync(studyPath)) {
    missing++;
    if (strict || only.length) err(slug, "topic has no content yet");
    continue;
  }

  // notes.md
  if (!fs.existsSync(notesPath)) err(slug, "missing notes.md");
  else {
    const raw = fs.readFileSync(notesPath, "utf8");
    const { data, content } = matter(raw);
    const structured = data.format !== undefined;
    const fm = (structured ? structuredFrontmatterSchema : frontmatterSchema).safeParse(data);
    if (!fm.success) err(slug, `front-matter: ${fm.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`);
    else if (fm.data.highYield.length < 10) warn(slug, `highYield has ${fm.data.highYield.length} items (want 10–12)`);
    if (structured) checkStructured(slug, data.format, content);
    else {
      const h2 = [...content.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
      for (const [re, label] of REQUIRED_HEADINGS)
        if (!h2.some((h) => re.test(h))) err(slug, `notes.md missing a "${label}" section`);
    }
    const words = content.split(/\s+/).filter(Boolean).length;
    if (words < 1500) warn(slug, `notes.md is only ${words} words (target 2,500–5,000)`);
    if (/<\/?[a-z][^>]*>/i.test(content.replace(/```[\s\S]*?```/g, "")))
      warn(slug, "notes.md appears to contain raw HTML (use Markdown only)");
    const badCallouts = [...content.matchAll(/^> \[!([A-Z]+)\]/gm)]
      .map((m) => m[1])
      .filter((t) => !["PEARL", "REDFLAG", "UGANDA", "DRUG", "EXAM", "NOTE"].includes(t));
    if (badCallouts.length) err(slug, `unknown callout types: ${[...new Set(badCallouts)].join(", ")}`);
  }

  // study.json
  if (!fs.existsSync(studyPath)) err(slug, "missing study.json");
  else {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(studyPath, "utf8"));
    } catch (e) {
      err(slug, `study.json is not valid JSON: ${e.message}`);
      continue;
    }
    const parsed = studySchema.safeParse(json);
    if (!parsed.success) {
      for (const i of parsed.error.issues.slice(0, 15)) err(slug, `study.json ${i.path.join(".")}: ${i.message}`);
      continue;
    }
    const s = parsed.data;
    if (s.slug !== slug) err(slug, `study.json slug "${s.slug}" does not match folder`);
    for (const k of ["flashcards", "mcqs", "cases", "references"])
      if (s[k].length < MIN[k]) err(slug, `${k}: ${s[k].length} (minimum ${MIN[k]})`);
    for (const c of s.cases)
      if (c.steps.length < MIN.caseSteps) err(slug, `case ${c.id} has ${c.steps.length} steps (minimum ${MIN.caseSteps})`);
    for (const item of [...s.flashcards, ...s.mcqs, ...s.cases]) {
      if (seenIds.has(item.id)) err(slug, `duplicate id "${item.id}" (also in ${seenIds.get(item.id)})`);
      seenIds.set(item.id, slug);
    }
    if (s.mcqs.length >= 8) {
      const dist = [0, 0, 0, 0, 0];
      s.mcqs.forEach((q) => dist[q.answer]++);
      if (Math.max(...dist) > s.mcqs.length * 0.5) warn(slug, `MCQ answers are clustered: ${dist.join("/")} (A/B/C/D/E)`);
    }
  }
}

// Downloadable PDFs must match the current content.
const manifest = readManifest();
const stale = TOPICS.filter(
  (t) => slugs.includes(t.slug) && fs.existsSync(path.join(root, "content/topics", t.slug, "notes.md")) && manifest[t.slug] !== topicHash(t.slug, t),
).map((t) => t.slug);
if (!only.length && fs.existsSync(path.join(root, "content/quick-reference.md")) && manifest["quick-reference"] !== quickRefHash()) stale.push("quick-reference");
if (stale.length) err("pdf", `${stale.length} PDF(s) out of date (${stale.join(", ")}). Run \`npm run pdf\` and commit public/pdf.`);

/** Structured notes: the exact numbered H2 list for the format, and its mandatory H3s. */
function checkStructured(slug, format, content) {
  const spec = NOTE_FORMATS[format];
  if (!spec) return err(slug, `front-matter format "${format}" is not one of ${FORMAT_NAMES.join(", ")}`);
  const { sections } = splitSections(content);
  const want = spec.sections.map((t, i) => `${i + 1}. ${t}`);
  const got = sections.map((s) => s.heading);
  const missing = want.filter((w) => !got.some((g) => normTitle(g) === normTitle(w)));
  const extra = got.filter((g) => !want.some((w) => normTitle(g) === normTitle(w)));
  for (const m of missing) err(slug, `notes.md missing "## ${m}" (format: ${format})`);
  for (const x of extra) err(slug, `notes.md has an unexpected H2 "## ${x}" (format ${format} allows only the numbered sections)`);
  if (!missing.length && !extra.length) {
    const i = got.findIndex((g, k) => normTitle(g) !== normTitle(want[k]));
    if (i >= 0 || got.length !== want.length) err(slug, `numbered sections are out of order or repeated (expected ${want.length}, in order; found "${got[i] ?? got.at(-1)}" at position ${i + 1})`);
  }
  const byN = new Map(sections.filter((s) => s.n !== null).map((s) => [s.n, s]));
  const has = (sec, sub) => subheadings(sec.body).some((h) => normTitle(h).startsWith(normTitle(sub)));
  for (const [rules, report] of [
    [spec.required, err],
    [spec.expected, warn],
  ])
    for (const [n, subs] of Object.entries(rules)) {
      const sec = byN.get(Number(n));
      if (!sec || /^\s*not applicable/i.test(sec.body)) continue;
      for (const sub of subs) if (!has(sec, sub)) report(slug, `"## ${n}. ${spec.sections[n - 1]}" has no "### ${sub}" subsection`);
    }
  // Mermaid blocks must be readable by the topic page's flowchart renderer.
  for (const m of content.matchAll(/^```mermaid\n([\s\S]*?)^```/gm))
    if (!parseMermaid(m[1])) err(slug, `a mermaid block could not be read (use "flowchart TD" with A["label"] --> B["label"] lines)`);
  if (spec.mermaidIn && !/^```mermaid/m.test(byN.get(spec.mermaidIn)?.body ?? "")) warn(slug, `"## ${spec.mermaidIn}. ${spec.sections[spec.mermaidIn - 1]}" has no mermaid flowchart`);
}

const done = slugs.length - missing;
console.log(`\n${done}/${slugs.length} topics present · ${errors} error(s) · ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
