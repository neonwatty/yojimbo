import { useState, useEffect, useCallback, useRef } from 'react';
import { useHtmlFilesStore } from '../../store/htmlFilesStore';
import { htmlFilesApi } from '../../api/client';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';
import { toast } from '../../store/toastStore';
import type { HtmlFile } from '@cc-orchestrator/shared';

interface HtmlFilesPanelProps {
  instanceId: string;
  isOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export function HtmlFilesPanel({ instanceId, isOpen, onClose, width, onWidthChange }: HtmlFilesPanelProps) {
  const { instanceHtmlFiles, setInstanceHtmlFiles } = useHtmlFilesStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const htmlFiles = instanceHtmlFiles[instanceId];
  const files = htmlFiles?.files || [];

  // Fetch files on mount and when panel opens
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await htmlFilesApi.list(instanceId);
      if (response.data) {
        setInstanceHtmlFiles(instanceId, response.data);
      }
    } catch {
      // Error toast handled by API layer
    } finally {
      setIsLoading(false);
    }
  }, [instanceId, setInstanceHtmlFiles]);

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen, fetchFiles]);

  // Fetch file content when selection changes
  useEffect(() => {
    if (!selectedFileId) {
      setFileContent(null);
      return;
    }

    const fetchContent = async () => {
      setIsLoadingContent(true);
      try {
        const response = await htmlFilesApi.getContent(instanceId, selectedFileId);
        if (response.data) {
          setFileContent(response.data.content);
        }
      } catch {
        setFileContent(null);
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchContent();
  }, [instanceId, selectedFileId]);

  // Handle removing a file
  const handleRemoveFile = async (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await htmlFilesApi.remove(instanceId, fileId);
      // If this was the selected file, clear selection
      if (selectedFileId === fileId) {
        setSelectedFileId(null);
        setFileContent(null);
      }
      // Refresh the list
      await fetchFiles();
      toast.success('File removed');
    } catch {
      // Error toast handled by API layer
    }
  };

  // Handle file picker selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    e.target.value = '';

    setIsAdding(true);
    try {
      // Read file content
      const content = await file.text();

      // Upload to server
      const response = await htmlFilesApi.upload(instanceId, file.name, content);
      if (response.data) {
        await fetchFiles();
        setSelectedFileId(response.data.id);
        toast.success('File added');
      }
    } catch {
      toast.error('Failed to add file');
    } finally {
      setIsAdding(false);
    }
  };

  // Panel resize handling
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 360), 900);
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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
            <span className="text-sm font-semibold text-theme-primary flex-shrink-0">HTML Files</span>
            {isLoading && <Spinner size="sm" className="text-accent flex-shrink-0" />}
            {!isLoading && files.length > 0 && (
              <span className="text-xs text-theme-muted font-normal">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-surface-700 text-theme-muted hover:text-theme-primary transition-colors"
            title="Close panel"
          >
            <Icons.close />
          </button>
        </div>

        {/* Main content area - split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left side - file list */}
          <div className="w-48 flex-shrink-0 flex flex-col border-r border-surface-600">
            {/* Add file input */}
            <div className="p-2 border-b border-surface-600">
              {/* Hidden file input for picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAdding}
                className="w-full px-3 py-2 bg-frost-4/20 border border-frost-4/30 text-frost-2 text-xs font-medium rounded hover:bg-frost-4/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                title="Browse for HTML file"
              >
                {isAdding ? <Spinner size="sm" /> : <Icons.folder />}
                <span>{isAdding ? 'Adding...' : 'Browse...'}</span>
              </button>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Spinner size="sm" className="text-accent" />
                </div>
              ) : files.length === 0 ? (
                <div className="p-3 text-center text-theme-muted">
                  <p className="text-xs">No files added</p>
                  <p className="text-xs opacity-75 mt-1">Enter an HTML file path above</p>
                </div>
              ) : (
                <div className="p-1 space-y-0.5">
                  {files.map((file) => (
                    <FileListItem
                      key={file.id}
                      file={file}
                      isSelected={selectedFileId === file.id}
                      onSelect={() => setSelectedFileId(file.id)}
                      onRemove={(e) => handleRemoveFile(file.id, e)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side - preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-surface-900">
            {!selectedFileId ? (
              <div className="flex-1 flex items-center justify-center text-theme-muted">
                <div className="text-center">
                  <Icons.code />
                  <p className="mt-2 text-sm">Select a file to preview</p>
                </div>
              </div>
            ) : isLoadingContent ? (
              <div className="flex-1 flex items-center justify-center">
                <Spinner size="md" className="text-accent" />
              </div>
            ) : fileContent ? (
              <iframe
                srcDoc={fileContent}
                className="flex-1 w-full bg-white"
                sandbox="allow-scripts allow-same-origin"
                title="HTML Preview"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-theme-muted">
                <div className="text-center">
                  <Icons.warning />
                  <p className="mt-2 text-sm">Failed to load file content</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FileListItemProps {
  file: HtmlFile;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
}

function FileListItem({ file, isSelected, onSelect, onRemove }: FileListItemProps) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
        isSelected
          ? 'bg-frost-4/20 text-frost-2'
          : 'text-theme-secondary hover:bg-surface-700 hover:text-theme-primary'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <Icons.file />
        <span className="text-xs truncate" title={file.path}>
          {file.name}
        </span>
      </div>
      <button
        onClick={onRemove}
        className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
          isSelected
            ? 'hover:bg-frost-4/30 text-frost-3'
            : 'hover:bg-surface-600 text-theme-muted hover:text-theme-primary'
        }`}
        title="Remove file"
      >
        <Icons.close />
      </button>
    </div>
  );
}
