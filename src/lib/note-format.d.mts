export type NoteFormat = "disease" | "skill" | "concept";
export interface ChapterDef {
  id: string;
  title: string;
  /** Label for the 4-column chapter tabs on a phone. */
  short: string;
  from: number;
  to: number;
}
export interface FormatSpec {
  sections: string[];
  chapters: ChapterDef[];
  required: Record<number, string[]>;
  expected: Record<number, string[]>;
  mermaidIn?: number;
}
export const NOTE_FORMATS: Record<NoteFormat, FormatSpec>;
export const FORMAT_NAMES: NoteFormat[];
export function normTitle(s: string): string;
export interface RawSection {
  heading: string;
  n: number | null;
  title: string;
  body: string;
}
export function splitSections(body: string): { preamble: string; sections: RawSection[] };
export function subheadings(body: string): string[];
export function chapterOf(format: NoteFormat, n: number): number;
export function isStructured(format: unknown, body: string): format is NoteFormat;
export const VERIFY_RE: RegExp;
export function countVerify(body: string): number;
