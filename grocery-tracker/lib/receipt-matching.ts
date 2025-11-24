interface MatchCandidate {
  generic_name: string | null;
  brand: string | null;
  variant: string | null;
  size: string | null;
  unit: string | null;
  category: string | null;
}

interface ParsedItem {
  receipt_text: string;
  item_name: string;
  brand: string | null;
  generic_name: string | null;
  variant: string | null;
  size: string | null;
  unit: string | null;
  category: string | null;
}

/**
 * Calculate similarity score between two strings
 * Returns a value between 0 (no match) and 1 (perfect match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Calculate Levenshtein distance ratio
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance (edit distance) between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Find the best match for a receipt text from historical items
 */
export function findBestMatch(
  receiptText: string,
  historicalItems: MatchCandidate[]
): MatchCandidate | null {
  if (!receiptText || historicalItems.length === 0) return null;

  let bestMatch: MatchCandidate | null = null;
  let bestScore = 0;

  for (const item of historicalItems) {
    // We need something to compare against - use generic_name or brand
    const compareText = item.generic_name || item.brand || item.variant || '';

    if (!compareText) continue;

    const score = calculateSimilarity(receiptText, compareText);

    // Consider it a match if similarity is above 70%
    if (score > bestScore && score >= 0.7) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}

/**
 * Enhance parsed items with data from historical matches
 * Returns enhanced items AND count of how many were enhanced
 */
export function enhanceWithMatches(
  parsedItems: ParsedItem[],
  historicalItems: MatchCandidate[]
): { items: ParsedItem[]; enhancedCount: number } {
  let enhancedCount = 0;

  const items = parsedItems.map((item) => {
    // Only try to match if we're missing key fields
    const needsEnhancement =
      !item.generic_name || !item.brand || !item.size || !item.unit;

    if (!needsEnhancement || !item.receipt_text) {
      return item;
    }

    // Find best match from historical items
    const match = findBestMatch(item.receipt_text, historicalItems);

    if (!match) {
      return item;
    }

    // Check if we're actually adding any new data
    const willEnhance =
      (!item.generic_name && match.generic_name) ||
      (!item.brand && match.brand) ||
      (!item.variant && match.variant) ||
      (!item.size && match.size) ||
      (!item.unit && match.unit) ||
      (!item.category && match.category);

    if (willEnhance) {
      enhancedCount++;
    }

    // Merge matched data with parsed data (prefer parsed data when available)
    return {
      ...item,
      generic_name: item.generic_name || match.generic_name,
      brand: item.brand || match.brand,
      variant: item.variant || match.variant,
      size: item.size || match.size,
      unit: item.unit || match.unit,
      category: item.category || match.category,
    };
  });

  return { items, enhancedCount };
}
