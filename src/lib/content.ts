import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";
import { cache } from "react";
import { TOPICS, TOPIC_BY_SLUG, type Topic } from "@/content/curriculum";
import { frontmatterSchema, noteMetaSchema, studySchema } from "@/lib/content-schema.mjs";
import { NOTE_FORMATS, chapterOf, countVerify, isStructured, splitSections } from "@/lib/note-format.mjs";
import { mermaidText } from "@/lib/rehype-notes.mjs";
import type { StudyData, TopicContent, TopicSummary, Heading, SearchEntry, NoteMeta, StructuredNotes, NoteFormat } from "@/lib/types";
import { drugHandbook } from "@/lib/drug-handbook";

const CONTENT_DIR = path.join(process.cwd(), "content");
const TOPICS_DIR = path.join(CONTENT_DIR, "topics");

const EMPTY_STUDY = (slug: string): StudyData => ({
  slug,
  flashcards: [],
  mcqs: [],
  cases: [],
  references: [],
});

export function extractHeadings(markdown: string, depths: number[] = [2, 3]): Heading[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "");
  // Same slugger rehype-slug uses, so ids match the rendered headings.
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  for (const m of withoutCode.matchAll(/^(#{1,6}) (.+)$/gm)) {
    const text = m[2].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").trim();
    const id = slugger.slug(text);
    if (depths.includes(m[1].length)) headings.push({ depth: m[1].length, text, id });
  }
  return headings;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Groups structured notes into the format's four chapters. Null when the headings cannot be
 * matched up safely (the page then shows the notes as one long page).
 */
function structureNotes(format: NoteFormat, body: string): StructuredNotes | null {
  const { preamble, sections } = splitSections(body);
  const all = extractHeadings(body, [1, 2, 3, 4, 5, 6]);
  const h2 = all.flatMap((h, i) => (h.depth === 2 ? [i] : []));
  if (h2.length !== sections.length || !sections.length) return null;
  let chapter = 0;
  const out = sections.map((s, key) => {
    const at = h2[key];
    if (s.n !== null) chapter = chapterOf(format, s.n);
    return {
      key,
      n: s.n,
      title: s.title,
      id: all[at].id,
      body: s.body,
      chapter,
      words: words(s.body),
      slugSeed: all.slice(0, at + 1).map((h) => h.text),
      parts: all.slice(at + 1, h2[key + 1] ?? all.length).filter((h) => h.depth === 3),
    };
  });
  const chapters = NOTE_FORMATS[format].chapters.map((c, i) => ({
    id: c.id,
    title: c.title,
    short: c.short,
    minutes: Math.max(1, Math.round(out.filter((s) => s.chapter === i).reduce((n, s) => n + s.words, 0) / 200)),
  }));
  return { format, preamble, chapters, sections: out };
}

export const loadStudy = cache((slug: string): StudyData => {
  const file = path.join(TOPICS_DIR, slug, "study.json");
  if (!fs.existsSync(file)) return EMPTY_STUDY(slug);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    console.warn(`[content] study.json for ${slug} is not valid JSON`);
    return EMPTY_STUDY(slug);
  }
  const parsed = studySchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[content] invalid study.json for ${slug}`, parsed.error.issues.slice(0, 3));
    return EMPTY_STUDY(slug);
  }
  return parsed.data as StudyData;
});

export const loadTopic = cache((slug: string): TopicContent | null => {
  const topic = TOPIC_BY_SLUG[slug];
  if (!topic) return null;
  const file = path.join(TOPICS_DIR, slug, "notes.md");
  let body = "";
  let summary = topic.blurb;
  let highYield: string[] = [];
  let meta: NoteMeta = {};
  let structured: StructuredNotes | null = null;
  if (fs.existsSync(file)) {
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    const fm = frontmatterSchema.safeParse(data);
    if (fm.success) {
      summary = fm.data.summary;
      highYield = fm.data.highYield;
    }
    body = content;
    const m = noteMetaSchema.parse(data);
    meta = { system: m.system, specialty: m.specialty, level: m.level, tags: m.tags, lastReviewed: m.last_reviewed };
    // Reference topics (drug handbooks) keep their own chapter pages.
    if (topic.kind !== "reference" && isStructured(m.format, body)) structured = structureNotes(m.format, body);
  }
  return {
    topic,
    summary,
    highYield,
    body,
    headings: extractHeadings(body),
    wordCount: words(body),
    study: loadStudy(slug),
    meta,
    structured,
    verifyCount: countVerify(body),
  };
});

export const topicSummaries = cache((): TopicSummary[] =>
  TOPICS.map((t: Topic) => {
    const c = loadTopic(t.slug)!;
    return {
      ...t,
      summary: c.summary,
      highYield: c.highYield,
      hasNotes: c.body.length > 0,
      readMinutes: Math.max(1, Math.round(c.wordCount / 200)),
      counts: {
        flashcards: c.study.flashcards.length,
        mcqs: c.study.mcqs.length,
        cases: c.study.cases.length,
      },
    };
  }),
);

export const loadQuickReference = cache(() => {
  const file = path.join(CONTENT_DIR, "quick-reference.md");
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  return {
    title: (data.title as string) ?? "Quick reference",
    summary: (data.summary as string) ?? "",
    body: content,
    headings: extractHeadings(content),
  };
});

/** Split notes into plain-text chunks, one per H2/H3 heading, for full-text search. */
function sectionChunks(body: string, headings: Heading[]) {
  // Flowcharts are indexed as their steps ("A → B → C").
  const lines = body.replace(/^```mermaid\n([\s\S]*?)^```/gm, (_, src: string) => mermaidText(src)).split("\n");
  const chunks: { id: string; heading: string; text: string }[] = [];
  let hi = 0;
  let current: { id: string; heading: string; lines: string[] } | null = null;
  let inCode = false;
  for (const line of lines) {
    if (line.startsWith("```")) inCode = !inCode;
    const m = !inCode && line.match(/^(#{2,3}) (.+)$/);
    if (m && headings[hi]) {
      if (current) chunks.push({ id: current.id, heading: current.heading, text: current.lines.join(" ") });
      current = { id: headings[hi].id, heading: headings[hi].text, lines: [] };
      hi++;
    } else if (current) current.lines.push(line);
  }
  if (current) chunks.push({ id: current.id, heading: current.heading, text: current.lines.join(" ") });
  return chunks.map((c) => ({
    ...c,
    text: c.text
      .replace(/> \[![A-Z]+\]/g, "")
      .replace(/\[VERIFY[^\]]*\]/g, "")
      .replace(/[*_`>|#]/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/-{3,}/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  }));
}

/** Lightweight search index: titles, summaries, high-yield facts and headings. */
export const searchIndex = cache(() => {
  const qr = loadQuickReference();
  const qrEntries = qr
    ? sectionChunks(qr.body, qr.headings).map((sec) => ({
        slug: "quick-reference",
        title: "Quick reference",
        week: 0,
        kind: "section" as const,
        heading: sec.heading,
        text: sec.text,
        anchor: sec.id,
      }))
    : [];
  return [...qrEntries, ...topicEntries()];
});

const topicEntries = () =>
  TOPICS.flatMap((t) => {
    const c = loadTopic(t.slug)!;
    const entries: Omit<SearchEntry, "rotation" | "sharedWith">[] = [
      {
        slug: t.slug,
        title: t.title,
        week: t.week,
        kind: "topic" as const,
        text: `${c.summary} ${t.blurb}`,
        anchor: "",
      },
      ...c.highYield.map((h) => ({ slug: t.slug, title: t.title, week: t.week, kind: "fact" as const, text: h, anchor: "" })),
      ...(t.kind === "reference" && drugHandbook(t.slug).length
        ? drugHandbook(t.slug).flatMap((g) =>
            sectionChunks(g.body, g.headings).map((sec) => ({
              slug: t.slug,
              title: `Drug handbook · ${g.title}`,
              week: t.week,
              kind: "section" as const,
              heading: sec.heading,
              text: sec.text,
              anchor: sec.id,
              href: `/topics/${t.slug}/${g.slug}#${sec.id}`,
            })),
          )
        : sectionChunks(c.body, c.headings).map((sec) => ({
            slug: t.slug,
            title: t.title,
            week: t.week,
            kind: "section" as const,
            heading: sec.heading,
            text: sec.text,
            anchor: sec.id,
          }))),
      ...c.study.flashcards.map((f) => ({ slug: t.slug, title: t.title, week: t.week, kind: "card" as const, text: `${f.front} — ${f.back}`, anchor: "" })),
    ];
    return entries.map((e): SearchEntry => ({ ...e, rotation: t.rotation, ...(t.sharedWith ? { sharedWith: t.sharedWith } : {}) }));
  });

