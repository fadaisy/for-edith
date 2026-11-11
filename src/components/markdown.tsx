import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import GithubSlugger from "github-slugger";
import type { Element, ElementContent, Root } from "hast";
import { rehypeCallouts } from "@/lib/rehype-callouts.mjs";
import { rehypeMermaid, rehypeVerify } from "@/lib/rehype-notes.mjs";
import clsx from "clsx";

const textOf = (n: ElementContent): string => (n.type === "text" ? n.value : n.type === "element" ? n.children.map(textOf).join("") : "");

/**
 * Like rehype-slug, but continues a slug sequence (the heading texts that come before this
 * fragment), so a section rendered on its own gets the ids it would have in the whole page.
 */
function rehypeSeededSlug(seed: string[]) {
  return () => (tree: Root) => {
    const slugger = new GithubSlugger();
    for (const t of seed) slugger.slug(t);
    const walk = (node: Root | Element) => {
      for (const child of node.children) {
        if (child.type !== "element") continue;
        if (/^h[1-6]$/.test(child.tagName)) {
          if (!child.properties.id) child.properties.id = slugger.slug(textOf(child));
        } else walk(child);
      }
    };
    walk(tree);
  };
}

export const CALLOUTS = {
  PEARL: { label: "Clinical pearl", icon: "💎", cls: "callout-pearl" },
  REDFLAG: { label: "Red flag", icon: "🚩", cls: "callout-redflag" },
  UGANDA: { label: "Uganda context", icon: "🇺🇬", cls: "callout-uganda" },
  DRUG: { label: "Drug dosing", icon: "💊", cls: "callout-drug" },
  EXAM: { label: "Exam favourite", icon: "📝", cls: "callout-exam" },
  NOTE: { label: "Note", icon: "📌", cls: "callout-note" },
} as const;

type CalloutType = keyof typeof CALLOUTS;

const components: Components = {
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => {
    const external = href?.startsWith("http");
    return (
      <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {children}
      </a>
    );
  },
  blockquote: ({ node, children }) => {
    const type = node?.properties?.dataCallout as CalloutType | undefined;
    if (!type) return <blockquote>{children}</blockquote>;
    const c = CALLOUTS[type];
    return (
      <aside className={clsx("callout", c.cls)}>
        <div className="callout-title">
          <span aria-hidden>{c.icon}</span> {c.label}
        </div>
        <div className="callout-body">{children}</div>
      </aside>
    );
  },
};

export function Markdown({
  children,
  className,
  headingIds = false,
  slugSeed,
}: {
  children: string;
  className?: string;
  headingIds?: boolean;
  /** With headingIds: the heading texts before this fragment in the full notes. */
  slugSeed?: string[];
}) {
  const slug = headingIds ? [slugSeed ? rehypeSeededSlug(slugSeed) : rehypeSlug] : [];
  return (
    <div className={clsx("prose-edith", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[...slug, rehypeCallouts, rehypeVerify, rehypeMermaid]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
