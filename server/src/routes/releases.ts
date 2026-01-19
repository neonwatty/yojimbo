import { Router, Request, Response } from 'express';
import type { Release, ApiResponse } from '@cc-orchestrator/shared';

const router = Router();

// In-memory cache for releases
interface CacheEntry {
  data: Release[];
  timestamp: number;
}

let releasesCache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const GITHUB_REPO = 'neonwatty/yojimbo';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
const GITHUB_COMPARE_URL = `https://api.github.com/repos/${GITHUB_REPO}/compare`;

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
}

interface GitHubCompareResponse {
  commits: GitHubCommit[];
  ahead_by: number;
}

async function fetchUnreleasedChanges(latestTag: string): Promise<Release | null> {
  try {
    const response = await fetch(`${GITHUB_COMPARE_URL}/${latestTag}...main`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Yojimbo-Server',
      },
    });

    if (!response.ok) {
      console.error(`GitHub compare API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as GitHubCompareResponse;

    if (data.commits.length === 0) {
      return null; // No unreleased changes
    }

    // Format commits as markdown
    const commitLines = data.commits
      .reverse() // Show oldest first
      .map((commit) => {
        const firstLine = commit.commit.message.split('\n')[0];
        const shortSha = commit.sha.substring(0, 7);
        return `- ${firstLine} ([\`${shortSha}\`](${commit.html_url}))`;
      })
      .join('\n');

    const body = `## Unreleased Changes\n\nThese changes are on \`main\` but not yet in a release.\n\n${commitLines}`;

    return {
      version: 'Unreleased',
      name: 'Unreleased Changes',
      body,
      publishedAt: new Date().toISOString(),
      url: `https://github.com/${GITHUB_REPO}/compare/${latestTag}...main`,
      isPrerelease: true,
    };
  } catch (error) {
    console.error('Failed to fetch unreleased changes:', error);
    return null;
  }
}

async function fetchReleasesFromGitHub(): Promise<Release[]> {
  const response = await fetch(GITHUB_API_URL, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Yojimbo-Server',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as Array<{
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    html_url: string;
    prerelease: boolean;
  }>;

  const releases = data.map((release) => ({
    version: release.tag_name,
    name: release.name || release.tag_name,
    body: release.body || '',
    publishedAt: release.published_at,
    url: release.html_url,
    isPrerelease: release.prerelease,
  }));

  // If we have releases, fetch unreleased changes since the latest
  if (releases.length > 0) {
    const latestTag = releases[0].version;
    const unreleasedChanges = await fetchUnreleasedChanges(latestTag);
    if (unreleasedChanges) {
      return [unreleasedChanges, ...releases];
    }
  }

  return releases;
}

function isCacheValid(): boolean {
  if (!releasesCache) return false;
  const age = Date.now() - releasesCache.timestamp;
  return age < CACHE_TTL_MS;
}

// GET /api/releases - Get all releases
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Check if cache is valid
    if (isCacheValid() && releasesCache) {
      const response: ApiResponse<Release[]> = { success: true, data: releasesCache.data };
      return res.json(response);
    }

    // Fetch fresh data from GitHub
    const releases = await fetchReleasesFromGitHub();

    // Update cache
    releasesCache = {
      data: releases,
      timestamp: Date.now(),
    };

    const response: ApiResponse<Release[]> = { success: true, data: releases };
    res.json(response);
  } catch (error) {
    console.error('Failed to fetch releases:', error);

    // Fall back to stale cache if available
    if (releasesCache) {
      console.log('Returning stale cache due to GitHub API error');
      const response: ApiResponse<Release[]> = { success: true, data: releasesCache.data };
      return res.json(response);
    }

    const response: ApiResponse<Release[]> = {
      success: false,
      error: 'Failed to fetch releases from GitHub'
    };
    res.status(500).json(response);
  }
});

export default router;
