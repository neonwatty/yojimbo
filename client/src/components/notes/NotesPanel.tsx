import { useState, useEffect, useCallback, useRef } from 'react';
import { notesApi } from '../../api/client';
import { useUIStore } from '../../store/uiStore';
import { toast } from '../../store/toastStore';
import { useFileChangesStore } from '../../store/fileChangesStore';
import { useFileWatcher } from '../../hooks/useFileWatcher';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';
import { MDXNoteEditor, type MDXNoteEditorRef } from './MDXNoteEditor';
import type { Note } from '@cc-orchestrator/shared';

interface NotesPanelProps {
  workingDir: string;
  isOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

const MIN_BROWSER_WIDTH = 48;
const MAX_BROWSER_WIDTH = 300;

export function NotesPanel({ workingDir, isOpen, onClose, width, onWidthChange }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [hasNotesDir, setHasNotesDir] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [sourceContent, setSourceContent] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<MDXNoteEditorRef>(null);

  const {
    notesBrowserWidth,
    notesBrowserCollapsed,
    setNotesBrowserWidth,
    toggleNotesBrowserCollapsed,
  } = useUIStore();

  // File watcher for external changes
  useFileWatcher();
  const { changes, clearChange, dismissChange } = useFileChangesStore();

  // Check if selected note has external changes
  const selectedNoteChange = selectedNote
    ? Array.from(changes.values()).find(
        (c) => c.filePath === selectedNote.path && c.fileType === 'note' && !c.dismissed
      )
    : null;

  // Fetch notes when working directory changes
  const fetchNotes = useCallback(async () => {
    if (!workingDir) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await notesApi.list(workingDir);
      if (response.data) {
        setNotes(response.data);
      }
      // Check if notes directory exists (from API response)
      setHasNotesDir((response as { hasNotesDir?: boolean }).hasNotesDir !== false);
    } catch {
      setError('Failed to load notes');
      // Error toast shown by API layer
    } finally {
      setIsLoading(false);
    }
  }, [workingDir]);

  useEffect(() => {
    if (isOpen) {
      fetchNotes();
    }
  }, [isOpen, fetchNotes]);

  // Clear selected note when working directory changes
  useEffect(() => {
    setSelectedNote(null);
    setIsDirty(false);
    setShowSource(false);
    setSourceContent('');
  }, [workingDir]);

  // Group notes by folder
  const groupedNotes = notes.reduce(
    (acc, note) => {
      const folder = note.folder || '';
      if (!acc[folder]) {
        acc[folder] = [];
      }
      acc[folder].push(note);
      return acc;
    },
    {} as Record<string, Note[]>
  );

  const folders = Object.keys(groupedNotes).filter((f) => f !== '');
  const rootNotes = groupedNotes[''] || [];

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

  const handleSelectNote = async (note: Note) => {
    try {
      const response = await notesApi.get(note.id);
      if (response.data) {
        setSelectedNote(response.data);
        setIsDirty(false);
        setShowSource(false);
        setSourceContent(response.data.content);
      }
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleSave = async () => {
    if (!selectedNote) return;
    try {
      // Get content from editor or source mode
      const content = showSource
        ? sourceContent
        : (editorRef.current?.getMarkdown() || selectedNote.content);

      await notesApi.update(selectedNote.id, { content });
      setSelectedNote({ ...selectedNote, content, isDirty: false });
      setIsDirty(false);
      setSourceContent(content);
      toast.success('Note saved');
      fetchNotes(); // Refresh the list
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleReloadNote = async () => {
    if (!selectedNote || !selectedNoteChange) return;
    try {
      const response = await notesApi.get(selectedNote.id);
      if (response.data) {
        setSelectedNote(response.data);
        setSourceContent(response.data.content);
        setIsDirty(false);
        // Update editor content if in WYSIWYG mode
        if (!showSource && editorRef.current) {
          editorRef.current.setMarkdown(response.data.content);
        }
        clearChange(selectedNoteChange.fileId);
      }
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleCreateNote = async () => {
    const name = prompt('Enter note name (e.g., my-note.md):');
    if (!name) return;
    try {
      const response = await notesApi.create({
        workingDir,
        name: name.endsWith('.md') ? name : `${name}.md`,
        content: `# ${name.replace('.md', '')}\n\n`,
      });
      if (response.data) {
        await fetchNotes();
        handleSelectNote(response.data);
      }
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleCreateDirectory = async () => {
    try {
      const response = await notesApi.init(workingDir);
      if (response.data?.created) {
        toast.success('Created notes/ folder');
        await fetchNotes();
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
      const newWidth = Math.min(Math.max(startWidth + delta, 280), 600);
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
    const startWidth = notesBrowserWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, MIN_BROWSER_WIDTH), MAX_BROWSER_WIDTH);
      setNotesBrowserWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const browserWidth = notesBrowserCollapsed ? MIN_BROWSER_WIDTH : notesBrowserWidth;

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
            <Icons.fileText />
            <span className="text-sm font-semibold text-theme-primary flex-shrink-0">Notes</span>
            {isLoading && <Spinner size="sm" className="text-accent flex-shrink-0" />}
            {!isLoading && (
              <span className="text-xs text-theme-muted font-normal truncate min-w-0" title={`${workingDir}/notes`}>
                · {workingDir}/notes
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCreateNote}
              className="p-1.5 rounded hover:bg-surface-700 text-theme-muted hover:text-accent transition-colors"
              title="New note"
            >
              <Icons.plus />
            </button>
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
              {!notesBrowserCollapsed && (
                <span className="text-xs text-theme-muted font-medium truncate">Files</span>
              )}
              <button
                onClick={toggleNotesBrowserCollapsed}
                className="p-1 rounded hover:bg-surface-700 text-theme-muted hover:text-theme-primary transition-colors ml-auto"
                title={notesBrowserCollapsed ? 'Expand file browser' : 'Collapse file browser'}
              >
                {notesBrowserCollapsed ? <Icons.panelLeftOpen /> : <Icons.panelLeftClose />}
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
              ) : !hasNotesDir ? (
                <div className="p-4 text-center text-theme-muted">
                  <div className="opacity-50 mb-2">
                    <Icons.folder />
                  </div>
                  {!notesBrowserCollapsed && (
                    <>
                      <p className="text-xs">No notes folder</p>
                      <button
                        onClick={handleCreateDirectory}
                        className="mt-2 px-3 py-1.5 text-xs bg-accent/20 text-accent hover:bg-accent/30 rounded transition-colors"
                      >
                        Create notes/
                      </button>
                    </>
                  )}
                </div>
              ) : notes.length === 0 ? (
                <div className="p-4 text-center text-theme-muted">
                  <div className="opacity-50 mb-2">
                    <Icons.fileText />
                  </div>
                  {!notesBrowserCollapsed && (
                    <p className="text-xs">No notes yet</p>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  {/* Root notes */}
                  {rootNotes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => handleSelectNote(note)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
                        ${selectedNote?.id === note.id ? 'bg-accent/20 text-theme-primary' : 'text-theme-secondary hover:bg-surface-700'}`}
                      title={notesBrowserCollapsed ? note.name : undefined}
                    >
                      <Icons.fileText />
                      {!notesBrowserCollapsed && (
                        <>
                          <span className="truncate flex-1">{note.name}</span>
                          {note.isDirty && <span className="w-2 h-2 rounded-full bg-accent" />}
                        </>
                      )}
                    </button>
                  ))}

                  {/* Folders */}
                  {folders.map((folder) => (
                    <div key={folder}>
                      <button
                        onClick={() => toggleFolder(folder)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-theme-secondary hover:bg-surface-700 transition-colors"
                        title={notesBrowserCollapsed ? folder : undefined}
                      >
                        {!notesBrowserCollapsed && (expandedFolders.has(folder) ? <Icons.chevronDown /> : <Icons.chevronRight />)}
                        {expandedFolders.has(folder) ? <Icons.folderOpen /> : <Icons.folder />}
                        {!notesBrowserCollapsed && <span className="truncate">{folder}</span>}
                      </button>
                      {expandedFolders.has(folder) && !notesBrowserCollapsed && (
                        <div className="ml-4">
                          {groupedNotes[folder].map((note) => (
                            <button
                              key={note.id}
                              onClick={() => handleSelectNote(note)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
                                ${selectedNote?.id === note.id ? 'bg-accent/20 text-theme-primary' : 'text-theme-secondary hover:bg-surface-700'}`}
                            >
                              <Icons.fileText />
                              <span className="truncate flex-1">{note.name}</span>
                              {note.isDirty && <span className="w-2 h-2 rounded-full bg-accent" />}
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
          {!notesBrowserCollapsed && (
            <div
              className="w-1 bg-transparent hover:bg-accent/50 cursor-col-resize flex-shrink-0 transition-colors"
              onMouseDown={handleBrowserResizeStart}
            />
          )}

          {/* Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedNote ? (
              <>
                {/* Editor toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-surface-600 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-theme-primary font-medium">{selectedNote.name}</span>
                    {isDirty && <span className="w-2 h-2 rounded-full bg-accent" title="Unsaved changes" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (showSource) {
                          // Switching from source to WYSIWYG
                          setShowSource(false);
                        } else {
                          // Switching from WYSIWYG to source
                          const content = editorRef.current?.getMarkdown() || selectedNote.content;
                          setSourceContent(content);
                          setShowSource(true);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                        showSource
                          ? 'bg-accent/20 text-accent'
                          : 'bg-surface-700 text-theme-muted hover:text-theme-primary'
                      }`}
                      title={showSource ? 'Switch to WYSIWYG' : 'View source'}
                    >
                      <Icons.code />
                      {showSource ? 'WYSIWYG' : 'Source'}
                    </button>
                    {isDirty && (
                      <button
                        onClick={handleSave}
                        className="px-2 py-1 text-xs rounded bg-accent text-surface-900 hover:bg-accent-bright transition-colors"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>

                {/* External change notification */}
                {selectedNoteChange && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border-b border-amber-500/30 flex-shrink-0">
                    <Icons.alertCircle />
                    <span className="text-xs text-amber-400 flex-1">
                      {selectedNoteChange.changeType === 'deleted'
                        ? 'This file was deleted externally.'
                        : isDirty
                        ? 'This file was modified externally. Your unsaved changes may conflict.'
                        : 'This file was modified externally.'}
                    </span>
                    {selectedNoteChange.changeType !== 'deleted' && (
                      <button
                        onClick={handleReloadNote}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-amber-500/30 text-amber-300 hover:bg-amber-500/40 transition-colors"
                      >
                        <Icons.refresh />
                        Reload
                      </button>
                    )}
                    <button
                      onClick={() => dismissChange(selectedNoteChange.fileId)}
                      className="p-1 rounded hover:bg-amber-500/30 text-amber-400 transition-colors"
                      title="Dismiss"
                    >
                      <Icons.x />
                    </button>
                  </div>
                )}

                {/* Content area */}
                <div className="flex-1 overflow-hidden">
                  {showSource ? (
                    <textarea
                      value={sourceContent}
                      onChange={(e) => {
                        setSourceContent(e.target.value);
                        setIsDirty(true);
                      }}
                      className="w-full h-full bg-surface-900 border-0 p-4 text-sm font-mono text-theme-primary resize-none focus:outline-none"
                      spellCheck={false}
                    />
                  ) : (
                    <MDXNoteEditor
                      ref={editorRef}
                      markdown={selectedNote.content}
                      onChange={() => setIsDirty(true)}
                      placeholder="Start writing..."
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-theme-muted text-sm">
                Select a note to view
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
