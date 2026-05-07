// Reorder helpers — move a node one step earlier/later in the linear chain
// by rewiring its incoming/outgoing edges. Only sensible inside a linear
// pipeline (each node has 0/1 in, 0/1 out). For nodes inside branches the
// helpers return null and the UI disables the buttons.

import type { Edge, Node } from "@xyflow/react";

type Graph = {
  nodes: Node<any>[];
  edges: Edge[];
};

const _findIncoming = (edges: Edge[], target: string) =>
  edges.filter((e) => e.target === target);

const _findOutgoing = (edges: Edge[], source: string) =>
  edges.filter((e) => e.source === source);

const _isLinearStep = (edges: Edge[], nodeId: string) => {
  const incoming = _findIncoming(edges, nodeId);
  const outgoing = _findOutgoing(edges, nodeId);
  return incoming.length <= 1 && outgoing.length <= 1;
};

/**
 * Returns a new edges array with `nodeId` swapped one step earlier in
 * the chain. Returns null if the move is invalid (already at top, or
 * inside a branched section).
 */
export const moveNodeUp = (graph: Graph, nodeId: string): Edge[] | null => {
  const { edges } = graph;
  if (!_isLinearStep(edges, nodeId)) return null;

  const incoming = _findIncoming(edges, nodeId)[0];
  if (!incoming) return null; // already root

  const prevId = incoming.source;
  // Note: predecessor doesn't need to be strictly linear. We only swap the
  // edges connecting prev <-> current; any extra outgoing from prev (e.g.
  // to disconnected nodes) is preserved as-is.

  const prevIncoming = _findIncoming(edges, prevId)[0]; // may be undefined (prev is root)
  const myOutgoing = _findOutgoing(edges, nodeId)[0]; // may be undefined (we are last)

  // Drop the three edges we're rewiring.
  const drop = new Set<string>([incoming.id]);
  if (prevIncoming) drop.add(prevIncoming.id);
  if (myOutgoing) drop.add(myOutgoing.id);

  const newEdges = edges.filter((e) => !drop.has(e.id));

  // Build the rewired edges: prevIncoming.source → me, me → prev, prev → myOutgoing.target
  if (prevIncoming) {
    newEdges.push({
      ...prevIncoming,
      id: `${prevIncoming.source}-${nodeId}-${Math.random().toString(36).slice(2, 6)}`,
      target: nodeId,
    });
  }
  newEdges.push({
    ...incoming,
    id: `${nodeId}-${prevId}-${Math.random().toString(36).slice(2, 6)}`,
    source: nodeId,
    target: prevId,
  });
  if (myOutgoing) {
    newEdges.push({
      ...myOutgoing,
      id: `${prevId}-${myOutgoing.target}-${Math.random().toString(36).slice(2, 6)}`,
      source: prevId,
    });
  }
  return newEdges;
};

export const moveNodeDown = (graph: Graph, nodeId: string): Edge[] | null => {
  const { edges } = graph;
  if (!_isLinearStep(edges, nodeId)) return null;

  const outgoing = _findOutgoing(edges, nodeId)[0];
  if (!outgoing) return null; // already last

  const nextId = outgoing.target;
  // Reverse: moving X down by one = moving the node after X up by one.
  return moveNodeUp(graph, nextId);
};

export const canMoveNodeUp = (graph: Graph, nodeId: string): boolean => {
  // Loosened: only require this node itself to be linear (1 in / 1 out).
  // Neighbors having extra edges (disconnected nodes elsewhere in the graph)
  // doesn't disqualify reorder.
  const { edges } = graph;
  if (!_isLinearStep(edges, nodeId)) return false;
  const incoming = _findIncoming(edges, nodeId)[0];
  return !!incoming;
};

export const canMoveNodeDown = (graph: Graph, nodeId: string): boolean => {
  const { edges } = graph;
  if (!_isLinearStep(edges, nodeId)) return false;
  const outgoing = _findOutgoing(edges, nodeId)[0];
  return !!outgoing;
};

/**
 * Remove a node and re-stitch its predecessor to its successor (if both exist).
 * Returns updated nodes + edges, or null if the node isn't found.
 */
export const deleteNode = (
  graph: Graph,
  nodeId: string,
): { nodes: Node<any>[]; edges: Edge[] } | null => {
  const { nodes, edges } = graph;
  if (!nodes.some((n) => n.id === nodeId)) return null;

  const incoming = _findIncoming(edges, nodeId);
  const outgoing = _findOutgoing(edges, nodeId);

  // Drop all edges touching the node.
  const remaining = edges.filter(
    (e) => e.source !== nodeId && e.target !== nodeId,
  );

  // Re-stitch: for each (predecessor → node), connect it to each (node → successor).
  // Preserves the sourceHandle of the predecessor so YES/NO branch labels survive.
  const stitched: Edge[] = [];
  for (const inE of incoming) {
    for (const outE of outgoing) {
      stitched.push({
        id: `${inE.source}-${outE.target}-${Math.random().toString(36).slice(2, 6)}`,
        source: inE.source,
        target: outE.target,
        sourceHandle: inE.sourceHandle,
      });
    }
  }

  const nextNodes = nodes.filter((n) => n.id !== nodeId);
  return { nodes: nextNodes, edges: [...remaining, ...stitched] };
};
