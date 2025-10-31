export function nullifyEmpty(str: string) {
  if (str == "") {
    return null;
  } else {
    return str;
  }
}

export function transformDateFormat(str: string) {
  if (!str) return str;
  const parts = str.split(/[\.\/]/);
  if (parts.length !== 3)
    throw new Error(
      `Unrecognized date format '${str}', it should be dd.mm.yyyy or dd/mm/yyyy`,
    );
  const [month, day, year] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Calculates the Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          Math.min(
            dp[i - 1][j - 1], // substitution
            dp[i - 1][j], // deletion
            dp[i][j - 1], // insertion
          ) + 1;
      }
    }
  }

  return dp[m][n];
}

/**
 * Checks if two strings are "close enough" by considering:
 * - Case differences
 * - Whitespace differences
 * - Small typos (using Levenshtein distance)
 *
 * @param str The string to compare
 * @param reference The reference string to compare against
 * @param threshold Optional similarity threshold (0 to 1, default 0.8)
 * @returns boolean indicating if the strings are close enough
 */
export function isStringCloseEnough(
  str: string,
  reference: string,
  threshold = 0.8,
): boolean {
  if (!str || !reference) return str === reference;

  // Normalize strings by converting to lowercase and removing extra whitespace
  const normalizedStr = str.toLowerCase().trim().replace(/\s+/g, " ");
  const normalizedRef = reference.toLowerCase().trim().replace(/\s+/g, " ");

  // If strings are identical after normalization, return true
  if (normalizedStr === normalizedRef) return true;

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedStr, normalizedRef);

  // Calculate similarity ratio (1 - distance/maxLength)
  const maxLength = Math.max(normalizedStr.length, normalizedRef.length);
  const similarity = 1 - distance / maxLength;

  return similarity >= threshold;
}

export const normalizeStrings =
  (canonicalValues: string[]) => (str: string) => {
    for (const canonicalValue of canonicalValues) {
      if (isStringCloseEnough(str, canonicalValue)) {
        return canonicalValue;
      }
    }
    return str;
  };
