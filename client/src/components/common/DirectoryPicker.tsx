import { useState, useEffect, useRef } from 'react';
import { filesystemApi } from '../../api/client';
import { Icons } from './Icons';
import { Spinner } from './Spinner';
import type { DirectoryEntry } from '@cc-orchestrator/shared';

interface DirectoryPickerProps {
  value: string;
  onChange: (path: string) => void;
}

export function DirectoryPicker({ value, onChange }: DirectoryPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNavigatingRef = useRef(false);
  const [currentPath, setCurrentPath] = useState(value || '~');
  const [displayPath, setDisplayPath] = useState('~');
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasParent, setHasParent] = useState(false);
  const [parentPath, setParentPath] = useState<string | null>(null);

  const fetchDirectory = async (path: string, isUserNavigation = false) => {
    if (isUserNavigation) {
      isNavigatingRef.current = true;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await filesystemApi.list(path);
      if (response.data) {
        setCurrentPath(response.data.currentPath);
        setDisplayPath(response.data.displayPath);
        setEntries(response.data.entries);
        setHasParent(response.data.hasParent);
        setParentPath(response.data.parentPath);
        onChange(response.data.currentPath);
      }
    } catch {
      setError('Failed to load directory');
    } finally {
      setLoading(false);
      isNavigatingRef.current = false;
    }
  };

  useEffect(() => {
    fetchDirectory(value || '~');
  }, []);

  // Refresh directory listing when container gains focus from outside
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocus = () => {
      // Skip refresh if we're in the middle of user-initiated navigation
      // (clicking a directory button triggers both navigation and focusin)
      if (isNavigatingRef.current) {
        return;
      }
      fetchDirectory(currentPath);
    };

    container.addEventListener('focusin', handleFocus);
    return () => container.removeEventListener('focusin', handleFocus);
  }, [currentPath]);

  const handleNavigate = (path: string) => {
    fetchDirectory(path, true);
  };

  const handleGoUp = () => {
    if (parentPath) {
      fetchDirectory(parentPath, true);
    }
  };

  const handleGoHome = async () => {
    isNavigatingRef.current = true;
    try {
      const response = await filesystemApi.home();
      if (response.data) {
        fetchDirectory(response.data.path, true);
      }
    } catch {
      setError('Failed to get home directory');
      isNavigatingRef.current = false;
    }
  };

  return (
    <div ref={containerRef} data-testid="directory-picker" className="space-y-2">
      {/* Current path display */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-theme-primary font-mono truncate">
          {displayPath}
        </div>
        <button
          type="button"
          onMouseDown={() => { isNavigatingRef.current = true; }}
          onClick={handleGoHome}
          className="p-2 rounded-lg bg-surface-600 text-theme-muted hover:text-theme-primary hover:bg-surface-500 transition-colors"
          title="Go to home directory"
        >
          <Icons.home />
        </button>
        <button
          type="button"
          onMouseDown={() => { if (hasParent) isNavigatingRef.current = true; }}
          onClick={handleGoUp}
          disabled={!hasParent}
          className="p-2 rounded-lg bg-surface-600 text-theme-muted hover:text-theme-primary hover:bg-surface-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Go to parent directory"
        >
          <Icons.chevronUp />
        </button>
      </div>

      {/* Directory listing */}
      <div className="bg-surface-800 border border-surface-600 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-red-400 text-sm">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-theme-muted text-sm">
            No subdirectories
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            {entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onMouseDown={() => { isNavigatingRef.current = true; }}
                onClick={() => handleNavigate(entry.path)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-theme-primary hover:bg-surface-600 transition-colors text-left"
              >
                <Icons.folder />
                <span className="truncate">{entry.name}</span>
                <Icons.chevronRight />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected path hint */}
      <p className="text-xs text-theme-muted">
        Selected: <span className="font-mono">{currentPath}</span>
      </p>
    </div>
  );
}
