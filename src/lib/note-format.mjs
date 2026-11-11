// The structured notes format (front-matter `format: disease | skill | concept` and numbered
// H2 sections), shared by the validator, the PDF generator and the topic page. Plain ESM.

const DISEASE_KEY_POINTS = ["High-yield points", "Numbers & doses", "Exam traps", "Questions seniors ask"];
const KEY_POINTS_EXPECTED = [...DISEASE_KEY_POINTS, "Mnemonics", "OSCE tips"];

/**
 * Per format: the exact H2 titles (numbered 1…n, in order), how they group into the four
 * chapters of the topic page, the H3 subsections the validator requires (errors) and the
 * ones the content brief expects (warnings).
 */
export const NOTE_FORMATS = {
  disease: {
    sections: [
      "Definition",
      "Epidemiology",
      "Aetiology and Risk Factors",
      "Pathophysiology",
      "Classification / Staging",
      "Clinical Features",
      "Differential Diagnoses",
      "Clinical Workup",
      "Management",
      "Complications",
      "Prognosis",
      "Prevention",
      "Special Populations",
      "Key Points",
      "References",
    ],
    chapters: [
      { id: "overview", title: "Overview", short: "Overview", from: 1, to: 5 },
      { id: "diagnosis", title: "Diagnosis", short: "Diagnosis", from: 6, to: 8 },
      { id: "management", title: "Management", short: "Manage", from: 9, to: 13 },
      { id: "revision", title: "Revision", short: "Revision", from: 14, to: 15 },
    ],
    required: {
      6: ["History", "Examination", "Red flags", "Thinking like a clinician"],
      8: ["Putting it together"],
      9: ["Drug table"],
      14: DISEASE_KEY_POINTS,
    },
    expected: {
      8: ["Bedside", "Basic lab", "Imaging", "Specialised / referral-level"],
      9: ["Immediate / emergency", "Definitive", "Referral criteria", "Monitoring and follow-up"],
      14: KEY_POINTS_EXPECTED,
    },
    mermaidIn: 4,
  },
  skill: {
    sections: [
      "Purpose and Indications",
      "Contraindications and Precautions",
      "Relevant Anatomy and Normal Values",
      "Equipment and Preparation",
      "Procedure Step by Step",
      "Findings and Interpretation",
      "Clinical Acumen",
      "Complications and Troubleshooting",
      "Documentation and Presenting Findings",
      "OSCE Checklist",
      "Key Points",
      "References",
    ],
    chapters: [
      { id: "overview", title: "Overview", short: "Overview", from: 1, to: 4 },
      { id: "procedure", title: "Procedure", short: "Procedure", from: 5, to: 6 },
      { id: "acumen", title: "Acumen & management", short: "Acumen", from: 7, to: 9 },
      { id: "revision", title: "Revision", short: "Revision", from: 10, to: 12 },
    ],
    required: { 11: DISEASE_KEY_POINTS },
    expected: { 11: KEY_POINTS_EXPECTED },
  },
  concept: {
    sections: [
      "Definitions and Key Concepts",
      "Burden and Uganda Context",
      "Principles and Framework",
      "Application in Practice",
      "Clinical Acumen",
      "Common Problems and Their Management",
      "Guidelines, Policy and Law in Uganda",
      "Key Points",
      "References",
    ],
    chapters: [
      { id: "overview", title: "Overview", short: "Overview", from: 1, to: 3 },
      { id: "practice", title: "In practice", short: "Practice", from: 4, to: 5 },
      { id: "policy", title: "Management & policy", short: "Policy", from: 6, to: 7 },
      { id: "revision", title: "Revision", short: "Revision", from: 8, to: 9 },
    ],
    required: { 8: DISEASE_KEY_POINTS },
    expected: { 8: KEY_POINTS_EXPECTED },
  },
};

export const FORMAT_NAMES = Object.keys(NOTE_FORMATS);

/** "Numbers and doses" and "Numbers & doses" are the same subsection. */
export const normTitle = (s) =>
  String(s)
    .replace(/[*_`]/g, "")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Splits notes (front-matter removed) into the text before the first H2 and one entry per
 * H2. `n` is the section number of a "## 7. Title" heading (null when not numbered).
 */
export function splitSections(body) {
  const lines = body.split("\n");
  const preamble = [];
  const sections = [];
  let fence = null;
  for (const line of lines) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
    }
    const m = !fence && !f && line.match(/^## (.+?)\s*#*\s*$/);
    if (m) {
      const heading = m[1].trim();
      const num = heading.match(/^(\d+)\.\s+(.*)$/);
      sections.push({ heading, n: num ? Number(num[1]) : null, title: num ? num[2] : heading, lines: [] });
    } else (sections.length ? sections[sections.length - 1].lines : preamble).push(line);
  }
  return {
    preamble: preamble.join("\n").trim(),
    sections: sections.map(({ lines, ...s }) => ({ ...s, body: lines.join("\n").replace(/^\n+|\s+$/g, "") })),
  };
}

/** The H3 titles of a section body (outside code blocks). */
export function subheadings(body) {
  return [...body.replace(/^\s*```[\s\S]*?^\s*```/gm, "").matchAll(/^### (.+?)\s*#*\s*$/gm)].map((m) => m[1].trim());
}

/** Index (0-based) of the chapter holding section `n` (unknown numbers go to the last). */
export function chapterOf(format, n) {
  const chapters = NOTE_FORMATS[format].chapters;
  const i = chapters.findIndex((c) => n >= c.from && n <= c.to);
  return i < 0 ? chapters.length - 1 : i;
}

/** True when notes use the structured format: a known `format` and numbered H2 headings. */
export function isStructured(format, body) {
  return FORMAT_NAMES.includes(format) && splitSections(body).sections.some((s) => s.n !== null);
}

/** `[VERIFY]`, `[VERIFY: reason]` or `[VERIFY reason]`. */
export const VERIFY_RE = /\[VERIFY(?:[:\s]\s*([^\]]*))?\]/g;

/** Number of [VERIFY] markers in notes, ignoring code blocks. */
export function countVerify(body) {
  return (body.replace(/^\s*```[\s\S]*?^\s*```/gm, "").match(VERIFY_RE) ?? []).length;
}
