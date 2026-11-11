// Shared schema for topic study material. Plain ESM so the validator script and
// the Next.js app can both import it.
import { z } from "zod";

export const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
});

export const mcqSchema = z.object({
  id: z.string().min(1),
  stem: z.string().min(10),
  options: z.array(z.string().min(1)).length(5),
  answer: z.number().int().min(0).max(4),
  explanation: z.string().min(10),
  difficulty: z.enum(["core", "advanced"]).default("core"),
});

export const caseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  presentation: z.string().min(10),
  steps: z
    .array(z.object({ prompt: z.string().min(1), answer: z.string().min(1) }))
    .min(1),
  takeaway: z.string().min(1),
});

export const referenceSchema = z.object({
  title: z.string().min(1),
  source: z.string().optional(),
  year: z.union([z.number(), z.string()]).optional(),
  url: z.string().url().optional(),
});

export const studySchema = z.object({
  slug: z.string(),
  flashcards: z.array(flashcardSchema),
  mcqs: z.array(mcqSchema),
  cases: z.array(caseSchema),
  references: z.array(referenceSchema),
});

export const frontmatterSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  highYield: z.array(z.string().min(1)).default([]),
});

// Structured notes (CONTENT_GUIDE.md): extra front-matter keys. YAML reads an unquoted
// 2026-11-11 as a Date, so last_reviewed accepts both and is normalised to YYYY-MM-DD.
const isoDate = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  z.date().transform((d) => d.toISOString().slice(0, 10)),
]);
export const SPECIALTIES = ["Obstetrics", "Gynaecology", "Paediatrics", "Neonatology"];
export const LEVELS = ["Core", "Advanced"];

/** Every key a structured topic must have (used by the validator). */
export const structuredFrontmatterSchema = frontmatterSchema.extend({
  format: z.enum(["disease", "skill", "concept"]),
  system: z.string().min(1),
  specialty: z.enum(SPECIALTIES),
  level: z.enum(LEVELS),
  tags: z.array(z.string().min(1)).min(1),
  last_reviewed: isoDate,
  sources: z.array(z.string().min(1)).min(1),
});

/** The same keys, read leniently by the site: a bad value is dropped, never fatal. */
export const noteMetaSchema = z.object({
  format: z.enum(["disease", "skill", "concept"]).optional().catch(undefined),
  system: z.string().optional().catch(undefined),
  specialty: z.string().optional().catch(undefined),
  level: z.string().optional().catch(undefined),
  tags: z.array(z.string()).optional().catch(undefined),
  last_reviewed: isoDate.optional().catch(undefined),
});
