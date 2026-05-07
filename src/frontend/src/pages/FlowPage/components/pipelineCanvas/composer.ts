// Compose a Langflow-shaped node from a CatalogEntry. The result is appended
// to flow.data.nodes so the existing run engine, persistence, and inspector
// work unchanged. We persist the catalog id under data.metadata.catalogId so
// the canvas can re-render the curated GTM card and the inspector can show
// the right config schema.

import type { Node } from "@xyflow/react";
import type { CatalogEntry } from "./catalog";

const newId = (entry: CatalogEntry) =>
  `${entry.id}-${Math.random().toString(36).slice(2, 8)}`;

export const composeLangflowNode = (entry: CatalogEntry): Node<any> => {
  const id = newId(entry);
  return {
    id,
    type: "genericNode",
    position: { x: 0, y: 0 }, // pipeline view ignores positions; advanced editor will auto-layout
    data: {
      id,
      type: entry.langflowType ?? entry.id,
      node: {
        display_name: entry.name,
        description: entry.description,
        // Hint the renderer about which curated catalog this came from so it
        // can show the right card art + config form.
        metadata: {
          catalogId: entry.id,
          kind: entry.kind,
          category: entry.category,
        },
        template: entry.defaults
          ? Object.fromEntries(
              Object.entries(entry.defaults).map(([k, v]) => [
                k,
                { type: "str", value: v, name: k },
              ]),
            )
          : {},
      },
    },
  };
};
