import type { RotationId, Topic } from "@/content/curriculum";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface Mcq {
  id: string;
  stem: string;
  options: string[];
  answer: number;
  explanation: string;
  difficulty: "core" | "advanced";
}

export interface ClinicalCase {
  id: string;
  title: string;
  presentation: string;
  steps: { prompt: string; answer: string }[];
  takeaway: string;
}

export interface Reference {
  title: string;
  source?: string;
  year?: number | string;
  url?: string;
}

export interface StudyData {
  slug: string;
  flashcards: Flashcard[];
  mcqs: Mcq[];
  cases: ClinicalCase[];
  references: Reference[];
}

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

export type NoteFormat = "disease" | "skill" | "concept";

/** One numbered H2 section of structured notes. */
export interface NoteSection {
  /** Position in the notes (0-based); unique, unlike `n`. */
  key: number;
  /** The section number ("## 7. …"), null for an unnumbered H2. */
  n: number | null;
  title: string;
  /** The H2's id (same slugger as the search index and rehype-slug). */
  id: string;
  /** Markdown under the H2. */
  body: string;
  /** Index into `chapters`. */
  chapter: number;
  words: number;
  /** Every heading text up to and including this H2, to continue the page's slug sequence. */
  slugSeed: string[];
  /** H3 subsections. */
  parts: Heading[];
}

export interface NoteChapter {
  id: string;
  title: string;
  short: string;
  minutes: number;
}

/** Notes in the structured format (front-matter `format` + numbered H2s), read as chapters. */
export interface StructuredNotes {
  format: NoteFormat;
  preamble: string;
  chapters: NoteChapter[];
  sections: NoteSection[];
}

export interface NoteMeta {
  system?: string;
  specialty?: string;
  level?: string;
  tags?: string[];
  lastReviewed?: string;
}

export interface TopicContent {
  topic: Topic;
  summary: string;
  highYield: string[];
  body: string;
  headings: Heading[];
  wordCount: number;
  study: StudyData;
  meta: NoteMeta;
  /** Chapters view, when the notes use the structured format. */
  structured: StructuredNotes | null;
  /** Number of [VERIFY] markers in the notes. */
  verifyCount: number;
}

export interface TopicSummary extends Topic {
  summary: string;
  highYield: string[];
  hasNotes: boolean;
  readMinutes: number;
  counts: { flashcards: number; mcqs: number; cases: number };
}

export type SearchEntry = {
  slug: string;
  title: string;
  week: number;
  kind: "topic" | "fact" | "section" | "card";
  heading?: string;
  text: string;
  anchor: string;
  /** Overrides the default link (e.g. drug handbook chapters). */
  href?: string;
  /** The topic's rotation (absent for the quick reference). */
  rotation?: RotationId;
  sharedWith?: RotationId[];
};
