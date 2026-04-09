import type { APIDataType } from "@/types/api";
import { normalizeString } from "./normalize-string";
import { searchInMetadata } from "./search-on-metadata";

export const traditionalSearchMetadata = (
  data: APIDataType,
  searchTerm: string,
) => {
  return Object.fromEntries(
    Object.entries(data).map(([category, items]) => {
      const filteredItems = Object.fromEntries(
        Object.entries(items).filter(([key, item]) => {
          // Search in display_name and description (most common search targets)
          const displayName = normalizeString(item.display_name || "");
          const description = normalizeString(item.description || "");
          const keyNorm = normalizeString(key);

          return (
            displayName.includes(searchTerm) ||
            description.includes(searchTerm) ||
            keyNorm.includes(searchTerm) ||
            (item.metadata && searchInMetadata(item.metadata, searchTerm))
          );
        }),
      );
      return [category, filteredItems];
    }),
  );
};
