// Determine GTM "kind" for a Langflow node, used to pick the right card
// renderer. Falls back to "action" for anything we don't recognize.

import type { Node } from "@xyflow/react";

export type GtmKind = "trigger" | "action" | "branch" | "wait" | "exit" | "agent";

const TRIGGER_RE = /(trigger|webhook|signal|chat[ _-]?input|input|schedule|cron|timer)/i;
const BRANCH_RE = /(if|else|condition|branch|switch|router|true.?false|conditional)/i;
const WAIT_RE = /(wait|delay|sleep|pause|interval)/i;
const EXIT_RE = /(exit|end|stop|chat[ _-]?output|terminate)/i;
const AGENT_RE = /(agent|ai|llm|gpt|claude|model)/i;

const probe = (val: unknown): string => {
  if (typeof val !== "string") return "";
  return val.toLowerCase();
};

const collectIdentifiers = (raw: Node<any>): string[] => {
  const ids: string[] = [];
  const data: any = raw?.data;
  if (data?.type) ids.push(probe(data.type));
  if (data?.node?.display_name) ids.push(probe(data.node.display_name));
  if (data?.node?.type) ids.push(probe(data.node.type));
  if (data?.id) ids.push(probe(data.id));
  if (raw?.type) ids.push(probe(raw.type as any));
  return ids.filter(Boolean);
};

export const inferKind = (raw: Node<any>): GtmKind => {
  const ids = collectIdentifiers(raw);
  for (const id of ids) {
    if (BRANCH_RE.test(id)) return "branch";
    if (WAIT_RE.test(id)) return "wait";
    if (EXIT_RE.test(id)) return "exit";
    if (TRIGGER_RE.test(id)) return "trigger";
    if (AGENT_RE.test(id)) return "agent";
  }
  return "action";
};

export const nodeDisplayName = (raw: Node<any>): string => {
  const data: any = raw?.data;
  return (
    data?.node?.display_name ??
    data?.type ??
    data?.id ??
    raw?.id ??
    "Node"
  );
};

export const nodeDescription = (raw: Node<any>): string => {
  const data: any = raw?.data;
  return (
    data?.node?.description ??
    data?.description ??
    ""
  );
};

/**
 * Return up to N short "tag" strings extracted from node config — used as
 * the sub-pills under a Trigger card or provider chips inside an Enrich card.
 */
export const nodeSubTags = (raw: Node<any>, max = 6): string[] => {
  const data: any = raw?.data;
  const template = data?.node?.template ?? {};
  const tags: string[] = [];

  for (const key of Object.keys(template)) {
    const field = template[key];
    if (!field || typeof field !== "object") continue;
    const value = field.value;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === "string" && v.length < 30) tags.push(v);
        if (tags.length >= max) break;
      }
    } else if (
      typeof value === "string" &&
      value.length > 0 &&
      value.length < 30 &&
      !value.startsWith("{")
    ) {
      // Skip references and long strings.
      if (!/^http/i.test(value)) tags.push(value);
    }
    if (tags.length >= max) break;
  }
  return tags.slice(0, max);
};
