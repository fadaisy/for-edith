#!/usr/bin/env node
// Generates a printable PDF for every topic (notes + self-test) and the quick reference,
// into public/pdf/. Only files whose content changed are rebuilt.
// Usage: npm run pdf [-- slug1 slug2 ...] [--force]
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { chromium } from "playwright-core";
import { rehypeCallouts } from "../src/lib/rehype-callouts.mjs";
import { rehypeMermaid, rehypeVerify } from "../src/lib/rehype-notes.mjs";
import { TOPICS } from "../src/content/curriculum.ts";
import { ROTATIONS } from "../src/content/rotations.ts";
import { PDF_DIR, MANIFEST, topicHash, quickRefHash, readManifest } from "./pdf/hash.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

const CALLOUT_LABELS = {
  PEARL: "Clinical pearl",
  REDFLAG: "Red flag",
  UGANDA: "Uganda context",
  DRUG: "Drug dosing",
  EXAM: "Exam favourite",
  NOTE: "Note",
};

/** Renders callouts as titled boxes and turns site-internal links into plain text. */
function rehypePrint() {
  const walk = (node) => {
    node.children = node.children.map((child) => {
      if (child.type !== "element") return child;
      walk(child);
      const type = child.properties?.dataCallout;
      if (child.tagName === "blockquote" && type) {
        return {
          type: "element",
          tagName: "div",
          properties: { className: ["callout", `callout-${type.toLowerCase()}`] },
          children: [
            { type: "element", tagName: "div", properties: { className: ["callout-title"] }, children: [{ type: "text", value: CALLOUT_LABELS[type] }] },
            ...child.children,
          ],
        };
      }
      if (child.tagName === "a" && !String(child.properties?.href ?? "").startsWith("http"))
        return { type: "element", tagName: "span", properties: {}, children: child.children };
      return child;
    });
  };
  return (tree) => walk(tree);
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeCallouts)
  .use(rehypeVerify)
  .use(rehypeMermaid)
  .use(rehypePrint)
  .use(rehypeStringify);
const md = (s) => String(processor.processSync(s));
/** Inline markdown: drops the wrapping <p> of a single paragraph. */
const mdInline = (s) => md(s).trim().replace(/^<p>([\s\S]*)<\/p>$/, "$1");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LETTERS = "ABCDE";

const font = (file) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, "scripts/pdf/fonts", file)).toString("base64")}`;
const CSS = /* css */ `
@font-face { font-family: Geist; src: url(${font("geist-latin.woff2")}) format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Instrument Serif"; src: url(${font("instrument-serif-latin.woff2")}) format("woff2"); }
@font-face { font-family: "Instrument Serif"; font-style: italic; src: url(${font("instrument-serif-italic-latin.woff2")}) format("woff2"); }
:root { --brand: #d63d78; --brand-soft: #fcecf2; --brand-line: #f5cfdd; --brand-text: #b8325f; --ink: #1c1d1f; --ink-2: #45434a; --ink-3: #76727b; --line: #ebe6e4; --soft: #f7f3f2; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Geist, "DejaVu Sans", sans-serif; font-size: 10pt; line-height: 1.5; color: var(--ink); }
.serif { font-family: "Instrument Serif", "DejaVu Serif", serif; font-weight: 400; }
.eyebrow { font-size: 8.5pt; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--brand-text); }
.cover h1 { font-family: "Instrument Serif", "DejaVu Serif", serif; font-weight: 400; font-size: 34pt; line-height: 1.02; letter-spacing: -.01em; margin: 6pt 0 8pt; }
.meta { display: flex; flex-wrap: wrap; gap: 5pt; margin-bottom: 9pt; }
.chip { border: 1px solid var(--line); border-radius: 99px; padding: 1pt 7pt; font-size: 8.5pt; color: var(--ink-2); }
.chip.brand { background: var(--brand-soft); border-color: var(--brand-line); color: var(--brand-text); }
.summary { font-size: 11pt; color: var(--ink-2); margin: 0 0 12pt; }
.mustknow { border: 1px solid var(--brand-line); background: #fffafc; border-radius: 9pt; padding: 9pt 13pt 7pt; margin-bottom: 12pt; break-inside: avoid; }
.mustknow h2 { font-family: Geist, sans-serif; font-size: 9.5pt; font-weight: 650; color: var(--brand-text); margin: 0 0 4pt; border: 0; padding: 0; }
.mustknow ol { margin: 0; padding-left: 15pt; }
.mustknow li { margin: 2pt 0; }
.mustknow li::marker { color: var(--brand); font-weight: 650; }
.toc { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 8pt 0; margin-bottom: 6pt; columns: 2; column-gap: 20pt; font-size: 9pt; color: var(--ink-2); }
.toc div { break-inside: avoid; padding: 1pt 0; }
.toc b { color: var(--brand-text); font-weight: 600; display: inline-block; width: 16pt; }
h2 { font-family: "Instrument Serif", "DejaVu Serif", serif; font-weight: 400; font-size: 20pt; line-height: 1.1; margin: 18pt 0 6pt; padding-bottom: 4pt; border-bottom: 1.5px solid var(--brand-line); break-after: avoid; }
h3 { font-size: 11.5pt; font-weight: 650; margin: 12pt 0 4pt; break-after: avoid; }
h4 { font-size: 10pt; font-weight: 650; margin: 9pt 0 3pt; color: var(--ink-2); break-after: avoid; }
p { margin: 0 0 6pt; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 6pt; padding-left: 16pt; }
li { margin: 1.5pt 0; }
li > p { margin: 0; }
.contains-task-list { list-style: none; padding-left: 4pt; }
.task-list-item input { margin: 0 5pt 0 0; vertical-align: -1pt; }
strong { font-weight: 650; }
a { color: var(--brand-text); text-decoration: none; word-break: break-all; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 8.5pt; background: var(--soft); border-radius: 3pt; padding: 0 2pt; }
pre { background: var(--soft); border-radius: 6pt; padding: 7pt 9pt; font-size: 8pt; line-height: 1.35; white-space: pre-wrap; break-inside: avoid; }
pre code { background: none; padding: 0; }
hr { border: 0; border-top: 1px solid var(--line); margin: 10pt 0; }
table { width: 100%; border-collapse: collapse; margin: 4pt 0 9pt; font-size: 8.8pt; line-height: 1.4; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: var(--brand-soft); color: var(--ink); text-align: left; font-weight: 650; }
th, td { border: 1px solid var(--line); padding: 3.5pt 5pt; vertical-align: top; overflow-wrap: anywhere; }
td p { margin: 0; }
blockquote { margin: 0 0 8pt; padding: 2pt 10pt; border-left: 3px solid var(--line); color: var(--ink-2); }
.callout { border: 1px solid var(--line); border-left: 3.5pt solid var(--c); background: var(--bg); border-radius: 6pt; padding: 6pt 10pt 2pt; margin: 6pt 0 9pt; break-inside: avoid; }
.callout-title { font-size: 8pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--c); margin-bottom: 2pt; }
.callout-pearl { --c: #7c5ce0; --bg: #f5f2fd; }
.callout-redflag { --c: #c8323c; --bg: #fdf1f1; }
.callout-uganda { --c: #b7791f; --bg: #fdf7ea; }
.callout-drug { --c: #0e857a; --bg: #eef8f6; }
.callout-exam { --c: #d63d78; --bg: #fdf1f5; }
.callout-note { --c: #5b6b86; --bg: #f3f5f8; }
.part { break-before: page; }
.part-head { margin-bottom: 10pt; }
.part-head h2 { font-size: 26pt; border: 0; margin: 2pt 0 2pt; }
.part-head p { color: var(--ink-3); margin: 0; }
.cards td:first-child { width: 22pt; color: var(--ink-3); text-align: right; }
.cards td:nth-child(2) { width: 38%; font-weight: 500; }
.q { break-inside: avoid; margin: 0 0 10pt; }
.q-stem { margin: 0 0 3pt; }
.q-stem b { color: var(--brand-text); }
.q ol { list-style: none; padding-left: 14pt; margin: 0; }
.q ol li { margin: 1pt 0; }
.q ol li b { display: inline-block; width: 13pt; color: var(--ink-3); font-weight: 600; }
.tag { font-size: 7.5pt; color: var(--ink-3); border: 1px solid var(--line); border-radius: 99px; padding: 0 5pt; margin-left: 4pt; }
.answer { break-inside: avoid; margin: 0 0 8pt; padding-left: 10pt; border-left: 2px solid var(--brand-line); }
.answer .key { font-weight: 650; color: var(--brand-text); }
.case { margin-bottom: 14pt; }
.case h3 { margin-top: 0; }
.case .pres { background: var(--soft); border-radius: 6pt; padding: 7pt 10pt; margin-bottom: 6pt; }
.step { margin: 0 0 6pt; break-inside: avoid; }
.step-q { font-weight: 650; }
.step-a { padding-left: 10pt; border-left: 2px solid var(--line); }
.takeaway { border-left: 3.5pt solid var(--brand); background: #fdf1f5; border-radius: 6pt; padding: 5pt 10pt; }
.refs li { margin: 3pt 0; }
.verify { color: #8a5300; font-size: 8.5pt; }
.verify-chip { display: inline-block; border: 1px solid #f2d9b0; background: #fdf3e6; border-radius: 3pt; padding: 0 3pt; font-size: 7pt; font-weight: 650; letter-spacing: .03em; line-height: 1.35; }
.verify-note { font-style: italic; }
.flow { margin: 4pt 0 9pt; max-width: 125mm; break-inside: avoid; }
.flow-row { display: flex; flex-wrap: wrap; gap: 4pt; }
.flow-step { flex: 1 1 35mm; border: 1px solid var(--brand-line); background: #fffafc; border-radius: 5pt; padding: 3pt 7pt; font-size: 9pt; line-height: 1.35; }
.flow-via { display: block; font-size: 7.5pt; font-weight: 650; color: var(--brand-text); }
.flow-arrow { display: flex; gap: 5pt; align-items: center; padding-left: 9pt; color: var(--brand); font-size: 9pt; line-height: 1.3; }
.flow-edge { font-size: 8pt; color: var(--ink-2); }
.flow-loops { list-style: none; padding: 0; margin: 3pt 0 0; font-size: 8.5pt; color: var(--ink-2); }
.disclaimer { font-size: 8pt; color: var(--ink-3); margin-top: 14pt; border-top: 1px solid var(--line); padding-top: 6pt; }
`;

const footer = (title) => `
<div style="width:100%;font-family:'DejaVu Sans',sans-serif;font-size:7.5px;color:#9a959e;padding:0 15mm;display:flex;justify-content:space-between;">
  <span>For Edith · ${esc(title)}</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

const page = (title, body) =>
  `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;

function toc(body, numbered = false) {
  const h2 = [...body.replace(/```[\s\S]*?```/g, "").matchAll(/^## (.+)$/gm)].map((m) => {
    const h = m[1].replace(/[*_`]/g, "");
    // Structured notes number their own headings ("7. Differential Diagnoses").
    return numbered ? h.replace(/^\d+\.\s+/, "") : h;
  });
  return h2.length ? `<div class="toc">${h2.map((h, i) => `<div><b>${i + 1}</b>${esc(h)}</div>`).join("")}</div>` : "";
}

function topicHtml(topic, notes, study) {
  const { data, content } = matter(notes);
  const kindLabel = { lecture: "Lecture", tutorial: "Tutorial", skill: "Clinical skill", reference: "Drug handbook" }[topic.kind];
  const selfTest = [];
  if (study.flashcards.length)
    selfTest.push(
      `<section class="part"><div class="part-head"><div class="eyebrow">Self-test</div><h2>Flashcards</h2><p>${study.flashcards.length} cards. Cover the right-hand column and test yourself.</p></div>
      <table class="cards"><thead><tr><th>#</th><th>Question</th><th>Answer</th></tr></thead><tbody>
      ${study.flashcards.map((f, i) => `<tr><td>${i + 1}</td><td>${mdInline(f.front)}</td><td>${mdInline(f.back)}</td></tr>`).join("")}
      </tbody></table></section>`,
    );
  if (study.mcqs.length)
    selfTest.push(
      `<section class="part"><div class="part-head"><div class="eyebrow">Self-test</div><h2>Single best answer questions</h2><p>${study.mcqs.length} questions. The answers and explanations follow at the end.</p></div>
      ${study.mcqs
        .map(
          (q, i) => `<div class="q"><p class="q-stem"><b>${i + 1}.</b> ${mdInline(q.stem)}${q.difficulty === "advanced" ? '<span class="tag">Advanced</span>' : ""}</p>
          <ol>${q.options.map((o, k) => `<li><b>${LETTERS[k]}</b>${mdInline(o)}</li>`).join("")}</ol></div>`,
        )
        .join("")}
      <h3 style="margin-top:16pt">Answers &amp; explanations</h3>
      ${study.mcqs
        .map((q, i) => `<div class="answer"><p><span class="key">${i + 1}. ${LETTERS[q.answer]}</span> · ${mdInline(q.options[q.answer])}</p>${md(q.explanation)}</div>`)
        .join("")}
      </section>`,
    );
  if (study.cases.length)
    selfTest.push(
      `<section class="part"><div class="part-head"><div class="eyebrow">Self-test</div><h2>Clinical cases</h2><p>Work through each step before reading the model answer.</p></div>
      ${study.cases
        .map(
          (c, i) => `<div class="case"><h3>Case ${i + 1}: ${esc(c.title)}</h3><div class="pres">${md(c.presentation)}</div>
          ${c.steps.map((s, k) => `<div class="step"><p class="step-q">${k + 1}. ${mdInline(s.prompt)}</p><div class="step-a">${md(s.answer)}</div></div>`).join("")}
          ${c.takeaway ? `<div class="takeaway"><strong>Take-away:</strong> ${mdInline(c.takeaway)}</div>` : ""}</div>`,
        )
        .join("")}
      </section>`,
    );
  if (study.references.length)
    selfTest.push(
      `<section><h2>References</h2><ol class="refs">${study.references
        .map((r) => `<li>${esc(r.title)}. <em>${esc(r.source)}</em>${r.year ? `, ${r.year}` : ""}.${r.url ? ` <a href="${esc(r.url)}">${esc(r.url)}</a>` : ""}</li>`)
        .join("")}</ol></section>`,
    );

  return page(
    topic.title,
    `<header class="cover">
      <div class="eyebrow">For Edith · ${esc(ROTATIONS[topic.rotation].longName)} junior clerkship</div>
      <h1>${esc(topic.title)}</h1>
      <div class="meta">
        <span class="chip brand">${kindLabel}</span>
        ${topic.week ? `<span class="chip">Week ${topic.week} · ${esc(ROTATIONS[topic.rotation].weekThemes[topic.week] ?? "")}</span>` : ""}
        ${topic.week && topic.discipline !== "skills" ? `<span class="chip" style="text-transform:capitalize">${esc(topic.discipline)}</span>` : ""}
        ${topic.faculty?.length ? `<span class="chip">${esc(topic.faculty.join(", "))}</span>` : ""}
      </div>
      ${data.summary ? `<p class="summary">${mdInline(data.summary)}</p>` : ""}
    </header>
    ${data.highYield?.length ? `<section class="mustknow"><h2>Must know before the ward round</h2><ol>${data.highYield.map((h) => `<li>${mdInline(h)}</li>`).join("")}</ol></section>` : ""}
    ${toc(content, Boolean(data.format))}
    <main>${md(content)}</main>
    ${selfTest.join("")}
    <p class="disclaimer">A study aid, not a protocol. Check doses against the Uganda Clinical Guidelines 2023, your unit's protocol and a senior before you treat a patient.</p>`,
  );
}

function quickRefHtml(src) {
  const { data, content } = matter(src);
  return page(
    data.title ?? "Quick reference",
    `<header class="cover"><div class="eyebrow">For Edith · Ward cheat-sheet</div><h1>${esc(data.title ?? "Quick reference")}</h1>
    ${data.summary ? `<p class="summary">${mdInline(data.summary)}</p>` : ""}</header>${toc(content)}<main>${md(content)}</main>`,
  );
}

/** A topic's study.json, or an empty one while it is still being written. */
function readStudy(slug) {
  const file = path.join(root, "content/topics", slug, "study.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { flashcards: [], mcqs: [], cases: [], references: [] };
}

// ---- build ----
fs.mkdirSync(PDF_DIR, { recursive: true });
const manifest = readManifest();
const jobs = [];
for (const t of TOPICS) {
  if (only.length && !only.includes(t.slug)) continue;
  const notes = path.join(root, "content/topics", t.slug, "notes.md");
  if (!fs.existsSync(notes)) continue;
  const hash = topicHash(t.slug, t);
  const out = path.join(PDF_DIR, `${t.slug}.pdf`);
  if (!force && manifest[t.slug] === hash && fs.existsSync(out)) continue;
  jobs.push({
    key: t.slug,
    hash,
    out,
    title: t.title,
    html: () => topicHtml(t, fs.readFileSync(notes, "utf8"), readStudy(t.slug)),
  });
}
const qrFile = path.join(root, "content/quick-reference.md");
if (fs.existsSync(qrFile) && (!only.length || only.includes("quick-reference"))) {
  const hash = quickRefHash();
  const out = path.join(PDF_DIR, "quick-reference.pdf");
  if (force || manifest["quick-reference"] !== hash || !fs.existsSync(out))
    jobs.push({ key: "quick-reference", hash, out, title: "Quick reference", html: () => quickRefHtml(fs.readFileSync(qrFile, "utf8")) });
}

if (!jobs.length) {
  console.log("All PDFs are up to date.");
  process.exit(0);
}

// Prefer an explicit path, then the sandbox's preinstalled Chromium, then Playwright's own lookup.
const executablePath = process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const tab = await browser.newPage();
for (const job of jobs) {
  await tab.setContent(job.html(), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  await tab.pdf({
    path: job.out,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", bottom: "16mm", left: "15mm", right: "15mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: footer(job.title),
  });
  manifest[job.key] = job.hash;
  console.log(`  ✔ ${path.relative(root, job.out)} (${Math.round(fs.statSync(job.out).size / 1024)} KB)`);
}
await browser.close();

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + "\n");
console.log(`\nBuilt ${jobs.length} PDF(s).`);
