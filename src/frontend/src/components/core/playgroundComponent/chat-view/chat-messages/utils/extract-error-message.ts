/**
 * Maps common HTTP error codes to user-friendly messages.
 */
const FRIENDLY_ERROR_MAP: Record<number, string> = {
  400: "The request wasn't formatted correctly. Please check your inputs and try again.",
  401: "Authentication failed — please check your API keys in the flow settings.",
  403: "Access denied — you don't have permission to access this resource.",
  404: "Couldn't find the requested information. Please verify the details and try again.",
  408: "The request timed out. Please try again in a moment.",
  429: "Too many requests — please wait a moment and try again.",
  500: "Something went wrong on the server side. Please try again.",
  502: "The service is temporarily unavailable. Please try again in a moment.",
  503: "The service is currently overloaded. Please try again later.",
};

/**
 * Extracts the error message from a reason string that may contain JSON-like structures.
 * Returns a user-friendly message instead of raw technical details.
 *
 * @param reason - The error reason string that may contain JSON with error details
 * @returns The extracted friendly error message, or null if extraction fails
 */
export function extractErrorMessage(reason: string | undefined): string | null {
  if (!reason) return null;

  try {
    // Try to extract HTTP error code
    const codeMatch = reason.match(/Error code:\s*(\d{3})/i);
    if (codeMatch) {
      const code = parseInt(codeMatch[1], 10);
      const friendly = FRIENDLY_ERROR_MAP[code];
      if (friendly) return friendly;
    }

    // Try to find JSON-like structure in the reason string
    const jsonMatch = reason.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0].replace(/'/g, '"');
      const parsed = JSON.parse(jsonStr);

      // Extract the actual message
      const rawMessage = parsed?.error?.message || parsed?.message;
      if (rawMessage) {
        // Try to map based on code inside the JSON
        const jsonCode = parsed?.error?.code || parsed?.code;
        if (typeof jsonCode === "number" && FRIENDLY_ERROR_MAP[jsonCode]) {
          return FRIENDLY_ERROR_MAP[jsonCode];
        }
        // Return the extracted message as-is if it's already readable
        return rawMessage;
      }
    }

    // Check for common error patterns in the text itself
    if (/credit balance|insufficient.*funds|billing/i.test(reason)) {
      return "Your account balance is too low. Please check your billing settings.";
    }
    if (/rate.?limit|too many requests|throttl/i.test(reason)) {
      return "Too many requests — please wait a moment and try again.";
    }
    if (/timeout|timed?\s*out/i.test(reason)) {
      return "The request timed out. Please try again.";
    }
    if (/unauthorized|authentication|auth.*fail|invalid.*key|api.?key/i.test(reason)) {
      return "Authentication failed — please check your API keys.";
    }
    if (/not\s*found/i.test(reason)) {
      return "The requested resource was not found.";
    }
    if (/connection.*refused|ECONNREFUSED|network/i.test(reason)) {
      return "Couldn't connect to the service. Please check your network and try again.";
    }
  } catch {
    // If parsing fails, fall through
  }

  return null;
}

/**
 * Returns a short, friendly summary for an error — suitable for the collapsed error header.
 */
export function getFriendlyErrorSummary(reason: string | undefined): string {
  const extracted = extractErrorMessage(reason);
  if (extracted) return extracted;

  // If we couldn't parse anything specific, return a generic friendly message
  return "Something went wrong. Expand for details.";
}
