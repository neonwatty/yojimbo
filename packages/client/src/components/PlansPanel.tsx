import { useState, useCallback, useEffect } from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  ListsToggle,
  UndoRedo,
  linkPlugin,
  linkDialogPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { usePlans, usePlan, useCreatePlan, useUpdatePlan, useDeletePlan } from '../hooks/use-plans';
import { useAppStore } from '../stores/app-store';
import type { PlanFile } from '@cc-orchestrator/shared';

interface PlansPanelProps {
  workingDir: string;
  onInjectToTerminal?: (content: string) => void;
}

// Icons
const Icons = {
  file: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
    </svg>
  ),
  save: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17,21 17,13 7,13 7,21" />
      <polyline points="7,3 7,8 15,8" />
    </svg>
  ),
  send: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22,2 15,22 11,13 2,9 22,2" />
    </svg>
  ),
  close: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  folder: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

// File browser component
function FileBrowser({
  files,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  isLoading,
}: {
  files: PlanFile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col h-full border-r border-[var(--border-color)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          {Icons.folder}
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Plans
          </span>
        </div>
        <button
          onClick={onCreate}
          className="p-1 rounded hover:bg-[var(--surface-600)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="New plan"
        >
          {Icons.plus}
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 text-sm text-[var(--text-muted)]">Loading...</div>
        ) : files.length === 0 ? (
          <div className="p-3 text-sm text-[var(--text-muted)]">
            No plans yet. Click + to create one.
          </div>
        ) : (
          <div className="py-1">
            {files.map((file) => (
              <div
                key={file.id}
                className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                  selectedId === file.id
                    ? 'bg-[var(--surface-600)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-700)] hover:text-[var(--text-primary)]'
                }`}
                onClick={() => onSelect(file.id)}
              >
                {Icons.file}
                <span className="flex-1 text-sm truncate">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${file.name}"?`)) {
                      onDelete(file.id);
                    }
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-500)] text-[var(--text-muted)] hover:text-[var(--state-error)] transition-all"
                  title="Delete plan"
                >
                  {Icons.trash}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Main PlansPanel component
export function PlansPanel({ workingDir, onInjectToTerminal }: PlansPanelProps) {
  const { selectedPlanId, setSelectedPlanId, setPlansPanelOpen } = useAppStore();

  // State for editor
  const [editorContent, setEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');

  // API hooks
  const { data: plansData, isLoading: isLoadingPlans } = usePlans(workingDir);
  const { data: planData, isLoading: isLoadingPlan } = usePlan(selectedPlanId ?? undefined, workingDir);
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  // Load plan content when selected plan changes
  useEffect(() => {
    if (planData) {
      setEditorContent(planData.content);
      setIsDirty(false);
    }
  }, [planData]);

  // Handle editor change
  const handleEditorChange = useCallback((content: string) => {
    setEditorContent(content);
    setIsDirty(true);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!selectedPlanId || !isDirty) return;

    try {
      await updatePlan.mutateAsync({
        planId: selectedPlanId,
        workingDir,
        content: editorContent,
      });
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save plan:', error);
    }
  }, [selectedPlanId, workingDir, editorContent, isDirty, updatePlan]);

  // Handle create
  const handleCreate = useCallback(async () => {
    if (!newPlanName.trim()) return;

    try {
      const result = await createPlan.mutateAsync({
        workingDir,
        name: newPlanName,
      });
      setSelectedPlanId(result.id);
      setIsCreating(false);
      setNewPlanName('');
    } catch (error) {
      console.error('Failed to create plan:', error);
    }
  }, [workingDir, newPlanName, createPlan, setSelectedPlanId]);

  // Handle delete
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deletePlan.mutateAsync({ planId: id, workingDir });
        if (selectedPlanId === id) {
          setSelectedPlanId(null);
          setEditorContent('');
        }
      } catch (error) {
        console.error('Failed to delete plan:', error);
      }
    },
    [workingDir, selectedPlanId, deletePlan, setSelectedPlanId]
  );

  // Handle inject to terminal
  const handleInject = useCallback(() => {
    if (onInjectToTerminal && editorContent) {
      onInjectToTerminal(editorContent);
    }
  }, [editorContent, onInjectToTerminal]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && isDirty) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, handleSave]);

  const files = plansData?.files ?? [];

  return (
    <div className="flex flex-col h-full bg-[var(--surface-800)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]">
        <h2 className="text-sm font-semibold">Plans Editor</h2>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-[var(--state-awaiting)]">Unsaved changes</span>
          )}
          {selectedPlanId && (
            <>
              <button
                onClick={handleSave}
                disabled={!isDirty || updatePlan.isPending}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  isDirty
                    ? 'bg-[var(--accent)] text-black hover:bg-[var(--accent-bright)]'
                    : 'bg-[var(--surface-600)] text-[var(--text-muted)] cursor-not-allowed'
                }`}
                title="Save (⌘S)"
              >
                {Icons.save}
                Save
              </button>
              <button
                onClick={handleInject}
                disabled={!editorContent}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-[var(--surface-600)] text-[var(--text-secondary)] hover:bg-[var(--surface-500)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Inject plan into terminal"
              >
                {Icons.send}
                Inject
              </button>
            </>
          )}
          <button
            onClick={() => setPlansPanelOpen(false)}
            className="p-1 rounded hover:bg-[var(--surface-600)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Close panel (⌘E)"
          >
            {Icons.close}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File browser */}
        <div className="w-48 flex-shrink-0">
          <FileBrowser
            files={files}
            selectedId={selectedPlanId}
            onSelect={setSelectedPlanId}
            onCreate={() => setIsCreating(true)}
            onDelete={handleDelete}
            isLoading={isLoadingPlans}
          />
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isCreating ? (
            <div className="flex items-center gap-2 p-4">
              <input
                type="text"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="Enter plan name..."
                className="flex-1 px-3 py-2 bg-[var(--surface-700)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
              />
              <button
                onClick={handleCreate}
                disabled={!newPlanName.trim() || createPlan.isPending}
                className="px-3 py-2 bg-[var(--accent)] text-black rounded text-sm font-medium hover:bg-[var(--accent-bright)] disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewPlanName('');
                }}
                className="px-3 py-2 bg-[var(--surface-600)] text-[var(--text-secondary)] rounded text-sm hover:bg-[var(--surface-500)]"
              >
                Cancel
              </button>
            </div>
          ) : selectedPlanId ? (
            isLoadingPlan ? (
              <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                Loading...
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4 mdx-editor-container">
                <MDXEditor
                  key={selectedPlanId}
                  markdown={editorContent}
                  onChange={handleEditorChange}
                  contentEditableClassName="prose prose-invert max-w-none"
                  plugins={[
                    headingsPlugin(),
                    listsPlugin(),
                    quotePlugin(),
                    thematicBreakPlugin(),
                    markdownShortcutPlugin(),
                    linkPlugin(),
                    linkDialogPlugin(),
                    codeBlockPlugin({ defaultCodeBlockLanguage: 'typescript' }),
                    codeMirrorPlugin({
                      codeBlockLanguages: {
                        typescript: 'TypeScript',
                        javascript: 'JavaScript',
                        css: 'CSS',
                        html: 'HTML',
                        json: 'JSON',
                        bash: 'Bash',
                        shell: 'Shell',
                        python: 'Python',
                      },
                    }),
                    toolbarPlugin({
                      toolbarContents: () => (
                        <>
                          <UndoRedo />
                          <BlockTypeSelect />
                          <BoldItalicUnderlineToggles />
                          <CreateLink />
                          <ListsToggle />
                        </>
                      ),
                    }),
                  ]}
                />
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
              <div className="text-center">
                <div className="mb-2">{Icons.file}</div>
                <p className="text-sm">Select a plan to edit</p>
                <p className="text-xs mt-1">or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
