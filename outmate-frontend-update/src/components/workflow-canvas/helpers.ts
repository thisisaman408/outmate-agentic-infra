import type { WfNode } from "./types";

export function findNode(nodes: WfNode[], id: string): WfNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.yesBranch) { const f = findNode(n.yesBranch, id); if (f) return f; }
    if (n.noBranch) { const f = findNode(n.noBranch, id); if (f) return f; }
  }
  return null;
}

export function countNodes(nodes: WfNode[]): number {
  let c = 0;
  for (const n of nodes) { c++; if (n.yesBranch) c += countNodes(n.yesBranch); if (n.noBranch) c += countNodes(n.noBranch); }
  return c;
}
