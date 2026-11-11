import type { z } from "zod";
export const flashcardSchema: z.ZodTypeAny;
export const mcqSchema: z.ZodTypeAny;
export const caseSchema: z.ZodTypeAny;
export const referenceSchema: z.ZodTypeAny;
export const studySchema: z.ZodType<{
  slug: string;
  flashcards: unknown[];
  mcqs: unknown[];
  cases: unknown[];
  references: unknown[];
}>;
export const frontmatterSchema: z.ZodType<{ title: string; summary: string; highYield: string[] }>;
export const SPECIALTIES: string[];
export const LEVELS: string[];
export const structuredFrontmatterSchema: z.ZodTypeAny;
export const noteMetaSchema: z.ZodType<{
  format?: "disease" | "skill" | "concept";
  system?: string;
  specialty?: string;
  level?: string;
  tags?: string[];
  last_reviewed?: string;
}>;
