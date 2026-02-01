/**
 * Model Normalizer Utility
 * 
 * Normalizes model IDs to a canonical format.
 * Specifically handles version separators: "4.5" -> "4-5"
 */

/**
 * Normalize a model ID string.
 * 
 * @param modelID - The model ID to normalize (e.g., "claude-sonnet-4.5")
 * @returns The normalized model ID (e.g., "claude-sonnet-4-5")
 */
export function normalizeModelID<T extends string | null | undefined>(modelID: T): T {
  if (!modelID) return modelID;
  
  // Normalize decimal version numbers to dashes
  // Match patterns like "4.5" or "5.2" but NOT "0905" (dates)
  // We use a regex that looks for a digit, a dot, and another digit.
  // This avoids matching longer numeric strings like dates.
  return modelID.replace(/(\d)\.(\d)/g, '$1-$2').replace(/(\d)\.(\d)/g, '$1-$2') as T;
}
