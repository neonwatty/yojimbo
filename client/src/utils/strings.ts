/**
 * Common filler words to filter out when generating short names
 */
const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'to', 'for', 'and', 'or', 'of', 'in', 'on', 'at', 'by',
  'with', 'from', 'as', 'is', 'are', 'be', 'was', 'were', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'please', 'just', 'also',
  'that', 'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
  'some', 'any', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
]);

/**
 * Generate a short, readable name from task text.
 * Filters out filler words, title-cases remaining words, and handles deduplication.
 *
 * @param taskText - The full task text to generate a name from
 * @param existingNames - List of existing names to avoid duplicates
 * @returns A short, unique name (max 30 chars, with numeric suffix if needed)
 */
export function generateShortName(taskText: string, existingNames: string[] = []): string {
  // Split into words, filter out filler and short words
  const words = taskText
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ') // Remove punctuation except hyphens
    .split(/\s+/)
    .filter(word => word.length > 1 && !FILLER_WORDS.has(word));

  if (words.length === 0) {
    return 'New Task';
  }

  // Take first 4 meaningful words and title case
  let baseName = words
    .slice(0, 4)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Truncate if too long
  if (baseName.length > 30) {
    baseName = baseName.slice(0, 27) + '...';
  }

  // Handle deduplication
  const lowerExisting = existingNames.map(n => n.toLowerCase());
  if (!lowerExisting.includes(baseName.toLowerCase())) {
    return baseName;
  }

  // Add numeric suffix to deduplicate
  let counter = 2;
  while (lowerExisting.includes(`${baseName.toLowerCase()} ${counter}`)) {
    counter++;
  }
  return `${baseName} ${counter}`;
}
