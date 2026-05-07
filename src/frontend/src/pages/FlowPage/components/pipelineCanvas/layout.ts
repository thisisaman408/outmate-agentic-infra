// Pipeline layout engine.
// Reads a Langflow flow.data graph and emits a vertical pipeline tree.
// Branches are detected when a node has 2+ outgoing edges to distinct targets.
// We label them YES / NO heuristically by sourceHandle name (e.g.
// "true"/"false", "yes"/"no", or first-seen → YES, second → NO).

import type { Edge, Node } from "@xyflow/react";
import { inferKind } from "./nodeKind";

export type PipelineNode = {
  id: string;
  /**
   * Original Langflow node payload, used by node renderers / inspector.
   */
  raw: Node<any>;
};

export type PipelineBranch = {
  id: string; // sourceNodeId + outgoing handle key
  label: string; // "YES" / "NO" / handle name
  tone: "positive" | "negative" | "neutral";
  steps: PipelineStep[];
};

export type PipelineStep =
  | { kind: "node"; node: PipelineNode }
  | { kind: "split"; sourceNodeId: string; branches: PipelineBranch[] };

export type PipelineTree = {
  ok: true;
  rootId: string;
  steps: PipelineStep[];
  unreachableNodeIds: string[];
};

export type PipelineFailure = {
  ok: false;
  reason: string;
};

export type PipelineLayout = PipelineTree | PipelineFailure;

const POSITIVE_HANDLE_RE = /(true|yes|match|ok|on|pass|success|success_path)/i;
const NEGATIVE_HANDLE_RE = /(false|no|miss|skip|fail|failure|reject)/i;

/**
 * Read a branch-slot label off an edge. Preferred storage is on
 * `edge.data.branchLabel` (a free-form ReactFlow field Langflow's loader
 * doesn't introspect, so it's safe). For backward compat we also look at
 * `edge.sourceHandle` if it happens to contain a label.
 */
const branchLabelFromEdge = (edge: Edge | null | undefined): string | null => {
  if (!edge) return null;
  const data = (edge as any).data;
  if (data && typeof data.branchLabel === "string" && data.branchLabel) {
    return data.branchLabel;
  }
  const sh = edge.sourceHandle;
  if (typeof sh === "string" && sh) {
    // Legacy: bare "true"/"false" or our old JSON envelope.
    const trimmed = sh.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed?.label === "string") return parsed.label;
      } catch {
        /* ignore */
      }
    }
    return sh;
  }
  return null;
};

const toneFor = (
  label: string,
): { label: string; tone: PipelineBranch["tone"] } => {
  if (POSITIVE_HANDLE_RE.test(label)) {
    return { label: label.toUpperCase(), tone: "positive" };
  }
  if (NEGATIVE_HANDLE_RE.test(label)) {
    return { label: label.toUpperCase(), tone: "negative" };
  }
  return { label: label.toUpperCase(), tone: "neutral" };
};

const labelFromEdge = (
  edge: Edge,
  fallbackIndex: number,
): { label: string; tone: PipelineBranch["tone"] } => {
  const label = branchLabelFromEdge(edge);
  if (label) return toneFor(label);
  // Fallback: first edge → YES, second → NO, third+ → BRANCH N
  if (fallbackIndex === 0) return { label: "YES", tone: "positive" };
  if (fallbackIndex === 1) return { label: "NO", tone: "negative" };
  return { label: `BRANCH ${fallbackIndex + 1}`, tone: "neutral" };
};

/**
 * Walk forward from `startId`, collecting linear nodes and recursing into
 * branches. Returns the steps list and the set of node ids visited along
 * the way. Cycle-safe via the `visited` accumulator.
 */
const walk = (
  startId: string,
  nodesById: Map<string, Node<any>>,
  edgesBySource: Map<string, Edge[]>,
  visited: Set<string>,
): PipelineStep[] => {
  const steps: PipelineStep[] = [];
  let cursor: string | null = startId;

  while (cursor) {
    if (visited.has(cursor)) break;
    visited.add(cursor);

    const node = nodesById.get(cursor);
    if (!node) break;

    steps.push({ kind: "node", node: { id: cursor, raw: node } });

    const outgoing = edgesBySource.get(cursor) ?? [];
    if (outgoing.length === 0) {
      cursor = null;
      break;
    }
    if (outgoing.length === 1) {
      cursor = outgoing[0].target;
      continue;
    }

    // Branch: 2+ outgoing edges from same source.
    // Group edges by target so duplicates don't double-render.
    const seenTargets = new Set<string>();
    const branches: PipelineBranch[] = [];
    let i = 0;
    for (const e of outgoing) {
      if (seenTargets.has(e.target)) continue;
      seenTargets.add(e.target);
      const { label, tone } = labelFromEdge(e, i);
      const branchSteps = walk(e.target, nodesById, edgesBySource, visited);
      const branchKey = branchLabelFromEdge(e) ?? `b${i}`;
      branches.push({
        id: `${cursor}-${branchKey}`,
        label,
        tone,
        steps: branchSteps,
      });
      i++;
    }
    steps.push({ kind: "split", sourceNodeId: cursor, branches });
    cursor = null;
  }

  return steps;
};

const findRoots = (
  nodes: Node<any>[],
  edges: Edge[],
): string[] => {
  if (nodes.length === 0) return [];
  const incoming = new Set(edges.map((e) => e.target));
  const roots = nodes.filter((n) => !incoming.has(n.id));
  // Prefer trigger-kind nodes as the primary root so orphan tools
  // (which also have no incoming edges) don't hijack the walk.
  const triggers = roots.filter((n) => inferKind(n) === "trigger");
  const ordered = triggers.length > 0
    ? [...triggers, ...roots.filter((n) => inferKind(n) !== "trigger")]
    : roots;
  return ordered.map((n) => n.id);
};

/**
 * Tool attachments are stored on each agent's
 * `data.node.metadata.toolNodeIds` — an array of node IDs of tools wired in.
 * We DON'T use edges for this because Langflow's edge loader expects
 * sourceHandle/targetHandle to be JSON-encoded handle objects, and using
 * plain strings like "tool" / "tools" crashes the flow loader with
 * `SyntaxError: Unexpected token 'o', "tool" is not valid JSON`.
 */
export const getToolAttachments = (
  nodes: Node<any>[] | null | undefined,
): Map<string, string[]> => {
  // agentId -> [toolNodeId]
  const result = new Map<string, string[]>();
  for (const n of nodes ?? []) {
    const ids = (n?.data as any)?.node?.metadata?.toolNodeIds;
    if (Array.isArray(ids) && ids.length > 0) {
      result.set(n.id, ids.filter((x) => typeof x === "string"));
    }
  }
  return result;
};

/**
 * Sanitize a graph's edges before handing them to the layout / Langflow's
 * own cleanEdges loader. Two kinds of damage are healed in place:
 *
 * 1. Plain-string handles like "tool" / "tools" — Langflow's loader does
 *    `JSON.parse(handle)` and crashes. These edges are dropped.
 * 2. Our own legacy `{"label":"true"}` envelope on `sourceHandle` — Langflow
 *    parses it fine but then expects `fieldName/dataType/name/output_types`
 *    fields that aren't there, so its `cleanEdges` walks into a null and
 *    throws `Cannot read properties of null (reading 'fieldName')`. We
 *    migrate that label onto `edge.data.branchLabel` (a free-form field
 *    Langflow's loader doesn't introspect) and clear the bad sourceHandle.
 *
 * Returns the healed edges + a `cleaned` flag so the canvas can PATCH the
 * saved flow once and never revisit the corruption.
 */
export const sanitizeEdges = (
  rawEdges: Edge[] | null | undefined,
): { edges: Edge[]; cleaned: boolean } => {
  const edges = rawEdges ?? [];
  let cleaned = false;
  const out: Edge[] = [];

  // Real Langflow handles look like {"fieldName":...,"id":...,...}. Our
  // legacy envelope is just {"label":"true|false"}.
  const looksLikeLangflowHandle = (parsed: any): boolean =>
    parsed != null &&
    typeof parsed === "object" &&
    ("fieldName" in parsed ||
      "name" in parsed ||
      "dataType" in parsed ||
      "output_types" in parsed ||
      "inputTypes" in parsed);

  for (const e of edges) {
    let next: Edge = e;
    let edgeOk = true;

    for (const side of ["sourceHandle", "targetHandle"] as const) {
      const h = (next as any)[side];
      if (h == null || h === "") continue;
      if (typeof h !== "string") continue;
      const trimmed = h.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        // Plain non-JSON string handle — would crash Langflow's loader.
        edgeOk = false;
        cleaned = true;
        break;
      }
      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        edgeOk = false;
        cleaned = true;
        break;
      }
      if (looksLikeLangflowHandle(parsed)) continue;
      // Not a Langflow handle. If it has a `label`, migrate to data.
      if (side === "sourceHandle" && typeof parsed?.label === "string") {
        const data = { ...((next as any).data ?? {}), branchLabel: parsed.label };
        next = { ...next, data, sourceHandle: null } as Edge;
        cleaned = true;
      } else {
        // Unknown JSON envelope on a handle — strip it to avoid crashing
        // Langflow's loader, but keep the edge as a plain connection.
        next = { ...next, [side]: null } as Edge;
        cleaned = true;
      }
    }

    if (edgeOk) out.push(next);
  }
  return { edges: out, cleaned };
};

export const computePipelineLayout = (
  rawNodes: Node<any>[] | null | undefined,
  rawEdges: Edge[] | null | undefined,
): PipelineLayout => {
  const nodes = rawNodes ?? [];
  const { edges: flowEdges, cleaned } = sanitizeEdges(rawEdges);

  // eslint-disable-next-line no-console
  console.log("[FLOW_LOAD] computePipelineLayout ENTRY", {
    nodeCount: nodes.length,
    rawEdgeCount: rawEdges?.length ?? 0,
    sanitizedEdgeCount: flowEdges.length,
    sanitizerCleanedSomething: cleaned,
    nodes: nodes.map((n) => ({ id: n.id, type: n.type })),
    rawEdges: (rawEdges ?? []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
    sanitizedEdges: flowEdges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  });

  if (nodes.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[FLOW_LOAD] computePipelineLayout EXIT empty (no nodes)");
    return {
      ok: true,
      rootId: "",
      steps: [],
      unreachableNodeIds: [],
    };
  }

  const nodesById = new Map<string, Node<any>>();
  for (const n of nodes) nodesById.set(n.id, n);

  const edgesBySource = new Map<string, Edge[]>();
  for (const e of flowEdges) {
    const list = edgesBySource.get(e.source) ?? [];
    list.push(e);
    edgesBySource.set(e.source, list);
  }

  const roots = findRoots(nodes, flowEdges);
  // eslint-disable-next-line no-console
  console.log("[FLOW_LOAD] computePipelineLayout findRoots →", {
    roots,
    rootKinds: roots.map((id) => {
      const n = nodesById.get(id);
      return { id, kind: n ? inferKind(n) : "missing" };
    }),
  });
  if (roots.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[FLOW_LOAD] computePipelineLayout EXIT cycle");
    return {
      ok: false,
      reason: "This flow has cycles and can't be displayed as a pipeline yet.",
    };
  }

  const rootId = roots[0];
  const visited = new Set<string>();
  const steps = walk(rootId, nodesById, edgesBySource, visited);

  // Nodes that are tool-attached to a visited agent count as reachable.
  const toolAttachments = getToolAttachments(nodes);
  toolAttachments.forEach((toolIds, agentId) => {
    if (visited.has(agentId)) {
      for (const t of toolIds) visited.add(t);
    }
  });

  const unreachable = nodes
    .map((n) => n.id)
    .filter((id) => !visited.has(id));

  // eslint-disable-next-line no-console
  console.log("[FLOW_LOAD] computePipelineLayout EXIT ok", {
    rootId,
    visitedCount: visited.size,
    visitedIds: Array.from(visited),
    unreachableCount: unreachable.length,
    unreachableIds: unreachable,
    toolAttachments: Array.from(toolAttachments.entries()).map(([k, v]) => ({
      agent: k,
      tools: v,
    })),
  });

  return {
    ok: true,
    rootId,
    steps,
    unreachableNodeIds: unreachable,
  };
};
