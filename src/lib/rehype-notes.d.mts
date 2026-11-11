import type { Root } from "hast";
export function rehypeVerify(): (tree: Root) => void;
export function rehypeMermaid(): (tree: Root) => void;
export interface FlowStep {
  id: string;
  label: string;
  via: string;
}
export function parseMermaid(src: string): { steps: FlowStep[][]; links: string[]; loops: { from: string; to: string; label: string }[] } | null;
export function mermaidText(src: string): string;
