import { useState, useEffect, useCallback } from 'react';
import { plansApi } from '../../api/client';
import { Icons } from '../common/Icons';
import type { Plan } from '@cc-orchestrator/shared';

interface PlansPanelProps {
  workingDir: string;
  isOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export function PlansPanel({ workingDir, isOpen, onClose, width, onWidthChange }: PlansPanelProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch plans when working directory changes
  const fetchPlans = useCallback(async () => {
    if (!workingDir) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await plansApi.list(workingDir);
      if (response.data) {
        setPlans(response.data);
      }
    } catch (err) {
      setError('Failed to load plans');
      console.error('Failed to fetch plans:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workingDir]);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen, fetchPlans]);

  // Group plans by folder
  const groupedPlans = plans.reduce(
    (acc, plan) => {
      const folder = plan.folder || '';
      if (!acc[folder]) {
        acc[folder] = [];
      }
      acc[folder].push(plan);
      return acc;
    },
    {} as Record<string, Plan[]>
  );

  const folders = Object.keys(groupedPlans).filter((f) => f !== '');
  const rootPlans = groupedPlans[''] || [];

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

  const handleSelectPlan = async (plan: Plan) => {
    try {
      const response = await plansApi.get(plan.path);
      if (response.data) {
        setSelectedPlan(response.data);
        setEditContent(response.data.content);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to load plan:', err);
    }
  };

  const handleSave = async () => {
    if (!selectedPlan) return;
    try {
      await plansApi.update(selectedPlan.path, { content: editContent });
      setSelectedPlan({ ...selectedPlan, content: editContent, isDirty: false });
      setIsEditing(false);
      fetchPlans(); // Refresh the list
    } catch (err) {
      console.error('Failed to save plan:', err);
    }
  };

  const handleCreatePlan = async () => {
    const name = prompt('Enter plan name (e.g., my-plan.md):');
    if (!name) return;
    try {
      const response = await plansApi.create({
        workingDir,
        name: name.endsWith('.md') ? name : `${name}.md`,
        content: `# ${name.replace('.md', '')}\n\n`,
      });
      if (response.data) {
        await fetchPlans();
        handleSelectPlan(response.data);
      }
    } catch (err) {
      console.error('Failed to create plan:', err);
    }
  };

  // Resize handling
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
          <span className="text-sm font-semibold text-theme-primary flex items-center gap-2">
            <Icons.file />
            Plans
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCreatePlan}
              className="p-1.5 rounded hover:bg-surface-700 text-theme-muted hover:text-accent transition-colors"
              title="New plan"
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
          <div className="w-48 border-r border-surface-600 overflow-auto flex-shrink-0">
            {isLoading ? (
              <div className="p-4 text-theme-muted text-sm">Loading...</div>
            ) : error ? (
              <div className="p-4 text-red-400 text-sm">{error}</div>
            ) : plans.length === 0 ? (
              <div className="p-4 text-center text-theme-muted">
                <div className="opacity-50 mb-2">
                  <Icons.folder />
                </div>
                <p className="text-xs">No plans folder found</p>
                <p className="text-xs mt-1 opacity-70">Create plans/ in your project</p>
              </div>
            ) : (
              <div className="py-2">
                {/* Root plans */}
                {rootPlans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
                      ${selectedPlan?.id === plan.id ? 'bg-accent/20 text-theme-primary' : 'text-theme-secondary hover:bg-surface-700'}`}
                  >
                    <Icons.file />
                    <span className="truncate flex-1">{plan.name}</span>
                    {plan.isDirty && <span className="w-2 h-2 rounded-full bg-accent" />}
                  </button>
                ))}

                {/* Folders */}
                {folders.map((folder) => (
                  <div key={folder}>
                    <button
                      onClick={() => toggleFolder(folder)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-theme-secondary hover:bg-surface-700 transition-colors"
                    >
                      {expandedFolders.has(folder) ? <Icons.chevronDown /> : <Icons.chevronRight />}
                      {expandedFolders.has(folder) ? <Icons.folderOpen /> : <Icons.folder />}
                      <span className="truncate">{folder}</span>
                    </button>
                    {expandedFolders.has(folder) && (
                      <div className="ml-4">
                        {groupedPlans[folder].map((plan) => (
                          <button
                            key={plan.id}
                            onClick={() => handleSelectPlan(plan)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
                              ${selectedPlan?.id === plan.id ? 'bg-accent/20 text-theme-primary' : 'text-theme-secondary hover:bg-surface-700'}`}
                          >
                            <Icons.file />
                            <span className="truncate flex-1">{plan.name}</span>
                            {plan.isDirty && <span className="w-2 h-2 rounded-full bg-accent" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Editor/Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedPlan ? (
              <>
                {/* Editor toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-surface-600 flex-shrink-0">
                  <span className="text-sm text-theme-primary font-medium">{selectedPlan.name}</span>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => {
                            setEditContent(selectedPlan.content);
                            setIsEditing(false);
                          }}
                          className="px-2 py-1 text-xs rounded bg-surface-700 text-theme-muted hover:text-theme-primary transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          className="px-2 py-1 text-xs rounded bg-accent text-surface-900 hover:bg-accent-bright transition-colors"
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-2 py-1 text-xs rounded bg-surface-700 text-theme-muted hover:text-theme-primary transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-auto p-4">
                  {isEditing ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-full bg-surface-900 border border-surface-600 rounded-lg p-3 text-sm font-mono text-theme-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-theme-secondary font-mono">
                        {selectedPlan.content}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-theme-muted text-sm">
                Select a plan to view
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
