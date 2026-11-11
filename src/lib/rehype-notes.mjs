// Rehype plugins for study notes, shared by the site's <Markdown> and the PDF generator:
// - rehypeVerify turns "[VERIFY: reason]" markers into a small amber "Verify" chip;
// - rehypeMermaid draws ```mermaid flowcharts as a simple vertical chain of steps (no Mermaid
//   runtime), falling back to the code block when the chart cannot be read.
import { VERIFY_RE } from "./note-format.mjs";

const el = (tagName, className, children, props = {}) => ({
  type: "element",
  tagName,
  properties: { ...(className ? { className: [className] } : {}), ...props },
  children,
});
const text = (value) => ({ type: "text", value });

export function rehypeVerify() {
  const walk = (node) => {
    if (!node.children) return;
    const out = [];
    for (const child of node.children) {
      if (child.type === "element") {
        if (child.tagName !== "code" && child.tagName !== "pre") walk(child);
        out.push(child);
        continue;
      }
      if (child.type !== "text" || !child.value.includes("[VERIFY")) {
        out.push(child);
        continue;
      }
      let last = 0;
      for (const m of child.value.matchAll(VERIFY_RE)) {
        const before = child.value.slice(last, m.index);
        if (before) out.push(text(before));
        const reason = (m[1] ?? "").trim();
        out.push(
          el(
            "span",
            "verify",
            [el("span", "verify-chip", [text("Verify")]), ...(reason ? [text(" "), el("span", "verify-note", [text(reason)])] : [])],
            { title: reason ? `To verify: ${reason}` : "To verify" },
          ),
        );
        last = m.index + m[0].length;
      }
      const rest = child.value.slice(last);
      if (rest) out.push(text(rest));
    }
    node.children = out;
  };
  return (tree) => walk(tree);
}

// ── Mermaid flowcharts ─────────────────────────────────────────
const SKIP_LINE = /^(flowchart|graph|subgraph|end\b|classDef|class\s|style\s|linkStyle|click\s|direction\s|%%)/;
const OPEN = /^(\[\[|\[\(|\(\(\(|\(\(|\(\[|\[\/|\[\\|\{\{|\[|\(|\{|>)/;
const CLOSE = /(\]\]|\)\]|\)\)\)|\)\)|\]\)|\/\]|\\\]|\}\}|\]|\)|\})$/;
// Edge operators: -->, ---, ==>, -.->, <-->, --o, --x, with an optional |label|.
const EDGE = /\s*(<?(?:-{2,}|={2,}|-\.+-?)(?:>|o|x)?)\s*(?:\|([^|]*)\|)?\s*/;

const cleanLabel = (s) =>
  s
    .trim()
    .replace(/^"(.*)"$/s, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/#quot;/g, '"')
    .replace(/#amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Replaces quoted strings, bracketed shapes and |edge labels| by placeholders. */
function mask(line) {
  const store = [];
  const keep = (s) => (store.push(s), `\u0000${store.length - 1}\u0000`);
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    let j = -1;
    if (c === '"') j = line.indexOf('"', i + 1);
    else if (c === "|") {
      j = line.indexOf("|", i + 1);
      if (j > i) {
        out += `|${keep(line.slice(i + 1, j))}|`;
        i = j;
        continue;
      }
    } else if ("[({".includes(c)) {
      let depth = 0;
      for (let k = i; k < line.length; k++) {
        const d = line[k];
        if (d === '"') {
          const q = line.indexOf('"', k + 1);
          if (q < 0) break;
          k = q;
        } else if ("[({".includes(d)) depth++;
        else if ("])}".includes(d) && --depth === 0) {
          j = k;
          break;
        }
      }
    }
    if (j > i) {
      out += keep(line.slice(i, j + 1));
      i = j;
    } else out += c;
  }
  return { masked: out, unmask: (s) => s.replace(/\u0000(\d+)\u0000/g, (_, k) => store[Number(k)]) };
}

/**
 * Reads a Mermaid flowchart into rows of steps (by longest path from the start), the labels
 * of edges between single-step rows, and the edges that loop back. Null when unreadable.
 */
export function parseMermaid(src) {
  const nodes = new Map();
  const edges = [];
  const node = (part) => {
    const m = part.trim().match(/^([A-Za-z0-9_][\w.-]*)\s*(.*)$/s);
    if (!m) return null;
    const [, id, rest] = m;
    if (!nodes.has(id)) nodes.set(id, { id, label: id, order: nodes.size });
    const shape = rest.trim().replace(/:::\w+$/, "");
    if (shape && OPEN.test(shape) && CLOSE.test(shape)) {
      const label = cleanLabel(shape.replace(OPEN, "").replace(CLOSE, ""));
      if (label) nodes.get(id).label = label;
    }
    return id;
  };
  for (const raw of src.split(/\n|;/)) {
    if (!raw.trim() || SKIP_LINE.test(raw.trim())) continue;
    // Hide labels ("…", […], |…|) so "&" and "--" inside them are not read as syntax.
    const { masked, unmask } = mask(raw.trim());
    // "A -- text --> B" is the same as "A -->|text| B".
    const line = masked.replace(/(?:--|==)\s+([^-=|>][^>]*?)\s+(-->|==>|---)/g, "$2|$1|");
    const parts = line.split(EDGE);
    // parts: node, op, label, node, op, label, node …
    let prev = null;
    for (let i = 0; i < parts.length; i += 3) {
      const ids = (parts[i] ?? "")
        .split(/\s*&\s*/)
        .map((p) => node(unmask(p)))
        .filter(Boolean);
      if (!ids.length) return null;
      if (prev) for (const a of prev) for (const b of ids) edges.push({ from: a, to: b, label: cleanLabel(unmask(parts[i - 1] ?? "")) });
      prev = ids;
    }
  }
  if (!nodes.size) return null;

  // Longest-path levels over the edges that do not close a cycle (DFS order).
  const out = new Map([...nodes.keys()].map((k) => [k, []]));
  for (const e of edges) out.get(e.from).push(e);
  const state = new Map();
  const back = new Set();
  const visit = (id) => {
    state.set(id, 1);
    for (const e of out.get(id)) {
      if (state.get(e.to) === 1) back.add(e);
      else if (!state.has(e.to)) visit(e.to);
    }
    state.set(id, 2);
  };
  const hasIncoming = new Set(edges.map((e) => e.to));
  for (const id of nodes.keys()) if (!hasIncoming.has(id) && !state.has(id)) visit(id);
  for (const id of nodes.keys()) if (!state.has(id)) visit(id);
  const forward = edges.filter((e) => !back.has(e));
  const level = new Map([...nodes.keys()].map((k) => [k, 0]));
  for (let pass = 0; pass < nodes.size; pass++) {
    let changed = false;
    for (const e of forward)
      if (level.get(e.to) < level.get(e.from) + 1) {
        level.set(e.to, level.get(e.from) + 1);
        changed = true;
      }
    if (!changed) break;
  }
  const rows = [];
  for (const n of [...nodes.values()].sort((a, b) => a.order - b.order)) (rows[level.get(n.id)] ??= []).push(n);
  const steps = rows.filter(Boolean).map((row) =>
    row.map((n) => {
      // A labelled edge into a step in a row of several (e.g. "Yes" / "No") is shown on the step.
      const into = forward.filter((e) => e.to === n.id && e.label);
      return { id: n.id, label: n.label, via: row.length > 1 && into.length === 1 ? into[0].label : "" };
    }),
  );
  const links = steps.slice(0, -1).map((row, i) => {
    const next = steps[i + 1];
    if (row.length !== 1 || next.length !== 1) return "";
    return forward.find((e) => e.from === row[0].id && e.to === next[0].id)?.label ?? "";
  });
  const label = (id) => nodes.get(id).label;
  const loops = [...back].map((e) => ({ from: label(e.from), to: label(e.to), label: e.label }));
  return { steps, links, loops };
}

/** Plain-text version of a flowchart ("A → B → C"), e.g. for the search index. */
export function mermaidText(src) {
  const g = parseMermaid(src);
  return g ? g.steps.map((row) => row.map((s) => s.label).join(" / ")).join(" → ") : "";
}

export function rehypeMermaid() {
  const walk = (node) => {
    if (!node.children) return;
    node.children = node.children.map((child) => {
      if (child.type !== "element") return child;
      const code = child.tagName === "pre" && child.children.find((c) => c.type === "element" && c.tagName === "code");
      const cls = code?.properties?.className;
      if (code && Array.isArray(cls) && cls.includes("language-mermaid")) {
        const src = code.children.map((c) => (c.type === "text" ? c.value : "")).join("");
        const g = parseMermaid(src);
        if (g) return flowchart(g);
        return child;
      }
      walk(child);
      return child;
    });
  };
  return (tree) => walk(tree);
}

function flowchart({ steps, links, loops }) {
  const children = [];
  steps.forEach((row, i) => {
    if (i > 0)
      children.push(
        el("div", "flow-arrow", [el("span", "flow-arrow-icon", [text("↓")], { ariaHidden: "true" }), ...(links[i - 1] ? [el("span", "flow-edge", [text(links[i - 1])])] : [])]),
      );
    children.push(
      el(
        "div",
        "flow-row",
        row.map((s) => el("div", "flow-step", [...(s.via ? [el("span", "flow-via", [text(s.via)])] : []), text(s.label)])),
      ),
    );
  });
  if (loops.length)
    children.push(
      el(
        "ul",
        "flow-loops",
        loops.map((l) => el("li", null, [text(`↻ From “${l.from}” back to “${l.to}”${l.label ? ` (${l.label})` : ""}`)])),
      ),
    );
  return el("figure", "flow", children, { ariaLabel: "Flow chart" });
}
