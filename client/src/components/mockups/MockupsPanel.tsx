import { useState, useEffect, useCallback } from 'react';
import { mockupsApi } from '../../api/client';
import { useUIStore } from '../../store/uiStore';
import { toast } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';
import type { Mockup } from '@cc-orchestrator/shared';

interface MockupsPanelProps {
  workingDir: string;
  isOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

const MIN_BROWSER_WIDTH = 48;
const MAX_BROWSER_WIDTH = 300;

export function MockupsPanel({ workingDir, isOpen, onClose, width, onWidthChange }: MockupsPanelProps) {
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [hasMockupsDir, setHasMockupsDir] = useState(true);
  const [selectedMockup, setSelectedMockup] = useState<Mockup | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    mockupsBrowserWidth,
    mockupsBrowserCollapsed,
    setMockupsBrowserWidth,
    toggleMockupsBrowserCollapsed,
  } = useUIStore();

  // Fetch mockups when working directory changes
  const fetchMockups = useCallback(async () => {
    if (!workingDir) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await mockupsApi.list(workingDir);
      if (response.data) {
        setMockups(response.data);
      }
      setHasMockupsDir((response as { hasMockupsDir?: boolean }).hasMockupsDir !== false);
    } catch {
      setError('Failed to load mockups');
    } finally {
      setIsLoading(false);
    }
  }, [workingDir]);

  useEffect(() => {
    if (isOpen) {
      fetchMockups();
    }
  }, [isOpen, fetchMockups]);

  // Clear selected mockup when working directory changes
  useEffect(() => {
    setSelectedMockup(null);
  }, [workingDir]);

  // Group mockups by folder
  const groupedMockups = mockups.reduce(
    (acc, mockup) => {
      const folder = mockup.folder || '';
      if (!acc[folder]) {
        acc[folder] = [];
      }
      acc[folder].push(mockup);
      return acc;
    },
    {} as Record<string, Mockup[]>
  );

  const folders = Object.keys(groupedMockups).filter((f) => f !== '');
  const rootMockups = groupedMockups[''] || [];

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const handleSelectMockup = async (mockup: Mockup) => {
    try {
      const response = await mockupsApi.get(mockup.id);
      if (response.data) {
        setSelectedMockup(response.data);
      }
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleCreateDirectory = async () => {
    try {
      const response = await mockupsApi.init(workingDir);
      if (response.data?.created) {
        toast.success('Created mockups/ folder');
        await fetchMockups();
      }
    } catch {
      // Error toast shown by API layer
    }
  };

  // Panel resize handling
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 280), 800);
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Browser resize handling
  const handleBrowserResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = mockupsBrowserWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, MIN_BROWSER_WIDTH), MAX_BROWSER_WIDTH);
      setMockupsBrowserWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const browserWidth = mockupsBrowserCollapsed ? MIN_BROWSER_WIDTH : mockupsBrowserWidth;

  if (!isOpen) return null;

  return (
    <div className="flex flex-shrink-0 h-full" style={{ width }}>
      {/* Resize handle */}
      <div
        className="w-1 bg-surface-600 hover:bg-accent cursor-col-resize flex-shrink-0"
        onMouseDown={handleResizeStart}
      />

      <div className="flex-1 flex flex-col bg-surface-800 border-l border-surface-600 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-surface-600 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <Icons.code />
            <span className="text-sm font-semibold text-theme-primary flex-shrink-0">Mockups</span>
            {isLoading && <Spinner size="sm" className="text-accent flex-shrink-0" />}
            {!isLoading && (
              <span className="text-xs text-theme-muted font-normal truncate min-w-0" title={`${workingDir}/mockups`}>
                · {workingDir}/mockups
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-surface-700 text-theme-muted hover:text-theme-primary transition-colors"
              title="Close panel"
            >
              <Icons.close />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* File browser */}
          <div
            className="border-r border-surface-600 overflow-hidden flex-shrink-0 flex flex-col transition-all duration-200 ease-out"
            style={{ width: browserWidth }}
          >
            {/* Browser header with collapse toggle */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-surface-700 flex-shrink-0">
              {!mockupsBrowserCollapsed && (
                <span className="text-xs text-theme-muted font-medium truncate">Files</span>
              )}
              <button
                onClick={toggleMockupsBrowserCollapsed}
                className="p-1 rounded hover:bg-surface-700 text-theme-muted hover:text-theme-primary transition-colors ml-auto"
                title={mockupsBrowserCollapsed ? 'Expand file browser' : 'Collapse file browser'}
              >
                {mockupsBrowserCollapsed ? <Icons.panelLeftOpen /> : <Icons.panelLeftClose />}
              </button>
            </div>

            {/* Browser content */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size="md" className="text-accent" />
                </div>
              ) : error ? (
                <div className="p-4 text-red-400 text-sm">{error}</div>
              ) : !hasMockupsDir ? (
                <div className="p-4 text-center text-theme-muted">
                  <div className="opacity-50 mb-2">
                    <Icons.folder />
                  </div>
                  {!mockupsBrowserCollapsed && (
                    <>
                      <p className="text-xs">No mockups folder</p>
                      <button
                        onClick={handleCreateDirectory}
                        className="mt-2 px-3 py-1.5 text-xs bg-accent/20 text-accent hover:bg-accent/30 rounded transition-colors"
                      >
                        Create mockups/
                      </button>
                    </>
                  )}
                </div>
              ) : mockups.length === 0 ? (
                <div className="p-4 text-center text-theme-muted">
                  <div className="opacity-50 mb-2">
                    <Icons.code />
                  </div>
                  {!mockupsBrowserCollapsed && (
                    <p className="text-xs">No mockups yet</p>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  {/* Root mockups */}
                  {rootMockups.map((mockup) => (
                    <button
                      key={mockup.id}
                      onClick={() => handleSelectMockup(mockup)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
                        ${selectedMockup?.id === mockup.id ? 'bg-accent/20 text-theme-primary' : 'text-theme-secondary hover:bg-surface-700'}`}
                      title={mockupsBrowserCollapsed ? mockup.name : undefined}
                    >
                      <Icons.code />
                      {!mockupsBrowserCollapsed && (
                        <span className="truncate flex-1">{mockup.name}</span>
                      )}
                    </button>
                  ))}

                  {/* Folders */}
                  {folders.map((folder) => (
                    <div key={folder}>
                      <button
                        onClick={() => toggleFolder(folder)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-theme-secondary hover:bg-surface-700 transition-colors"
                        title={mockupsBrowserCollapsed ? folder : undefined}
                      >
                        {!mockupsBrowserCollapsed && (expandedFolders.has(folder) ? <Icons.chevronDown /> : <Icons.chevronRight />)}
                        {expandedFolders.has(folder) ? <Icons.folderOpen /> : <Icons.folder />}
                        {!mockupsBrowserCollapsed && <span className="truncate">{folder}</span>}
                      </button>
                      {expandedFolders.has(folder) && !mockupsBrowserCollapsed && (
                        <div className="ml-4">
                          {groupedMockups[folder].map((mockup) => (
                            <button
                              key={mockup.id}
                              onClick={() => handleSelectMockup(mockup)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
                                ${selectedMockup?.id === mockup.id ? 'bg-accent/20 text-theme-primary' : 'text-theme-secondary hover:bg-surface-700'}`}
                            >
                              <Icons.code />
                              <span className="truncate flex-1">{mockup.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Browser resize handle */}
          {!mockupsBrowserCollapsed && (
            <div
              className="w-1 bg-transparent hover:bg-accent/50 cursor-col-resize flex-shrink-0 transition-colors"
              onMouseDown={handleBrowserResizeStart}
            />
          )}

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {selectedMockup ? (
              <>
                {/* Preview toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-surface-600 bg-surface-800 flex-shrink-0">
                  <span className="text-sm text-theme-primary font-medium">{selectedMockup.name}</span>
                  <button
                    onClick={() => {
                      // Open in new tab
                      const blob = new Blob([selectedMockup.content], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-surface-700 text-theme-secondary hover:bg-surface-600 transition-colors"
                    title="Open in new tab"
                  >
                    <Icons.externalLink />
                    Open
                  </button>
                </div>

                {/* Iframe preview */}
                <div className="flex-1 overflow-hidden">
                  <iframe
                    srcDoc={selectedMockup.content}
                    className="w-full h-full border-0"
                    title={selectedMockup.name}
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-theme-muted text-sm bg-surface-800">
                Select a mockup to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
