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
 * Format a date as a relative time string.
 * Returns: "just now", "5m ago", "2h ago", "3d ago", "Jan 15"
 *
 * @param dateString - ISO date string to format
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else if (diffDay < 7) {
    return `${diffDay}d ago`;
  } else {
    // Format as "Jan 15" for older dates
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

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
