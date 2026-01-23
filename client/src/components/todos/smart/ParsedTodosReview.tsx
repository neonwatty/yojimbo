import { useState, useMemo, useEffect } from 'react';
import { Icons } from '../../common/Icons';
import { useSmartTodosStore, selectTodosNeedingClarification, selectRoutableTodos, getEffectiveClarity } from '../../../store/smartTodosStore';
import { smartTodosApi, projectsApi } from '../../../api/client';
import { toast } from '../../../store/toastStore';
import { CloneSetupModal } from './CloneSetupModal';
import { ProjectSelector } from './ProjectSelector';
import { DispatchTargetSelector } from './DispatchTargetSelector';
import type { ParsedTodo, CreateAndDispatchRequest } from '@cc-orchestrator/shared';

interface ParsedTodosReviewProps {
  onBack: () => void;
  onComplete: () => void;
}

export function ParsedTodosReview({ onBack, onComplete }: ParsedTodosReviewProps) {
  const {
    parsedTodos,
    suggestedOrder,
    sessionId,
    summary,
    projects,
    needsClarification,
    removeTodo,
    selectProjectForTodo,
    startClarifying,
    setParsedResult,
    setError,
    // Dispatch state
    dispatchTargets,
    projectInstancesCache,
    dispatchState,
    setDispatchTarget,
    setProjectInstances,
    computeSmartDefaults,
    startDispatching,
    setDispatchComplete,
    setDispatchError,
  } = useSmartTodosStore();

  const [clarificationInputs, setClarificationInputs] = useState<Record<string, string>>({});
  const [isSubmittingClarification, setIsSubmittingClarification] = useState(false);
  const [isCreatingTodos, setIsCreatingTodos] = useState(false);
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneRepoInfo, setCloneRepoInfo] = useState<{ url: string; name: string } | null>(null);
  const [instancesFetched, setInstancesFetched] = useState(false);

  const todosNeedingClarification = selectTodosNeedingClarification(useSmartTodosStore.getState());
  const routableTodos = selectRoutableTodos(useSmartTodosStore.getState());

  // Fetch project instances and compute smart defaults
  useEffect(() => {
    async function fetchProjectInstances() {
      // Get unique project IDs from todos
      const projectIds = [...new Set(parsedTodos.map((t: ParsedTodo) => t.projectId).filter(Boolean))] as string[];

      // Fetch instances for each project
      for (const projectId of projectIds) {
        if (!projectInstancesCache[projectId]) {
          try {
            const response = await projectsApi.getInstances(projectId);
            if (response.data?.instances) {
              setProjectInstances(projectId, response.data.instances);
            }
          } catch (err) {
            console.error(`Failed to fetch instances for project ${projectId}:`, err);
          }
        }
      }

      // Compute smart defaults after fetching
      computeSmartDefaults();
      setInstancesFetched(true);
    }

    if (parsedTodos.length > 0 && !instancesFetched) {
      fetchProjectInstances();
    }
  }, [parsedTodos, instancesFetched, projectInstancesCache, setProjectInstances, computeSmartDefaults]);

  // Detect GitHub repos mentioned in clarification questions
  const detectedGitHubRepo = useMemo(() => {
    for (const todo of parsedTodos) {
      if (todo.clarificationNeeded?.question) {
        const question = todo.clarificationNeeded.question;
        // Look for GitHub repo patterns in the question
        // Patterns like "github.com/owner/repo", "neonwatty/bugdrop", "owner/repo"
        const patterns = [
          /github\.com[/:]([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/,
          /['"](git@github\.com:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+(?:\.git)?)['"]/,
          /['"]https:\/\/github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)['"]/,
          // Look for repo name mentions like "found 'bugdrop'" or "repo 'owner/repo'"
          /found ['"]?([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)['"]?/i,
          /repo(?:sitory)? ['"]?([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)['"]?/i,
        ];

        for (const pattern of patterns) {
          const match = question.match(pattern);
          if (match) {
            const repoName = match[1].replace(/\.git$/, '');
            // If it's already a full URL, use it; otherwise construct one
            if (match[0].includes('git@') || match[0].includes('https://')) {
              return {
                url: match[1],
                name: repoName,
              };
            }
            return {
              url: `https://github.com/${repoName}`,
              name: repoName,
            };
          }
        }
      }
    }
    return null;
  }, [parsedTodos]);

  // Check if any todos have unknown project (candidates for clone setup)
  // Use getEffectiveClarity to derive this, don't trust parser's clarity field
  const hasUnknownProjectTodos = parsedTodos.some((t: ParsedTodo) => getEffectiveClarity(t) === 'unknown_project');

  // Sort todos by suggested order
  const orderedTodos = [...parsedTodos].sort((a: ParsedTodo, b: ParsedTodo) => {
    const aIndex = suggestedOrder.indexOf(a.id);
    const bIndex = suggestedOrder.indexOf(b.id);
    return aIndex - bIndex;
  });

  // Calculate dispatch summary
  const dispatchSummary = useMemo(() => {
    const todosToDispatch = routableTodos.filter(
      (t: ParsedTodo) => dispatchTargets[t.id]?.type !== 'none'
    );
    const existingInstanceIds = new Set<string>();
    let newInstanceCount = 0;

    for (const todo of todosToDispatch) {
      const target = dispatchTargets[todo.id];
      if (target?.type === 'instance' && target.instanceId) {
        existingInstanceIds.add(target.instanceId);
      } else if (target?.type === 'new-instance') {
        newInstanceCount++;
      }
    }

    return {
      totalTodos: todosToDispatch.length,
      existingInstances: existingInstanceIds.size,
      newInstances: newInstanceCount,
      totalInstances: existingInstanceIds.size + newInstanceCount,
      saveOnly: routableTodos.length - todosToDispatch.length,
    };
  }, [routableTodos, dispatchTargets]);

  const handleClarificationSubmit = async () => {
    if (!sessionId) return;

    // Collect all clarification answers
    const answers = Object.entries(clarificationInputs)
      .filter(([_, value]) => value.trim())
      .map(([todoId, answer]) => {
        const todo = parsedTodos.find((t: ParsedTodo) => t.id === todoId);
        return `For "${todo?.title}": ${answer}`;
      })
      .join('\n');

    if (!answers) {
      toast.error('Please provide at least one clarification');
      return;
    }

    setIsSubmittingClarification(true);
    startClarifying();

    try {
      const response = await smartTodosApi.clarify(sessionId, answers);

      if (response.data) {
        setParsedResult(
          sessionId,
          { todos: response.data.todos, suggestedOrder: response.data.suggestedOrder },
          response.data.needsClarification,
          response.data.summary
        );
        setClarificationInputs({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process clarification');
    } finally {
      setIsSubmittingClarification(false);
    }
  };

  const handleCreateAndDispatch = async () => {
    if (!sessionId) return;

    // Create todos from all clear, routable parsed todos
    const todosToCreate = parsedTodos.filter(
      (t: ParsedTodo) => getEffectiveClarity(t) === 'clear' && t.projectId !== null
    );

    if (todosToCreate.length === 0) {
      toast.error('No todos ready to create');
      return;
    }

    setIsCreatingTodos(true);
    startDispatching();

    try {
      // Build the request with dispatch targets
      const request: CreateAndDispatchRequest = {
        sessionId,
        todos: todosToCreate.map((parsedTodo: ParsedTodo) => {
          const projectName = getProjectName(parsedTodo.projectId);
          const todoText = `[${parsedTodo.type}] ${parsedTodo.title}${projectName !== 'Unknown' ? ` (${projectName})` : ''}`;
          const target = dispatchTargets[parsedTodo.id] || { type: 'none' };

          return {
            parsedTodoId: parsedTodo.id,
            text: todoText,
            projectId: parsedTodo.projectId!,
            dispatchTarget: target,
          };
        }),
      };

      const response = await smartTodosApi.createAndDispatch(request);

      if (response.data) {
        const { created, dispatched, newInstances } = response.data;

        // Build success message
        let message = `Created ${created} todo${created !== 1 ? 's' : ''}`;
        if (dispatched > 0) {
          message += `, dispatched ${dispatched}`;
        }
        if (newInstances.length > 0) {
          message += ` (${newInstances.length} new instance${newInstances.length !== 1 ? 's' : ''})`;
        }

        setDispatchComplete();
        toast.success(message);
        onComplete();
      }
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Failed to create and dispatch todos');
      toast.error(err instanceof Error ? err.message : 'Failed to create and dispatch todos');
    } finally {
      setIsCreatingTodos(false);
    }
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return 'Unknown';
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown';
  };

  const handleOpenCloneModal = (repoUrl?: string, repoName?: string) => {
    if (repoUrl && repoName) {
      setCloneRepoInfo({ url: repoUrl, name: repoName });
    } else if (detectedGitHubRepo) {
      setCloneRepoInfo(detectedGitHubRepo);
    } else {
      // Allow manual entry
      setCloneRepoInfo({ url: '', name: '' });
    }
    setShowCloneModal(true);
  };

  const handleCloneComplete = (instanceId: string) => {
    console.log('Clone complete, instance created:', instanceId);
    // After successful clone, we could refresh the projects or navigate
    // For now, just close the modal and let the user continue
    setShowCloneModal(false);
    setCloneRepoInfo(null);
    toast.success('Project cloned and instance created!');
  };

  const getClarityBadge = (todo: ParsedTodo) => {
    // Use derived clarity, not the parser's value directly
    const effectiveClarity = getEffectiveClarity(todo);

    if (effectiveClarity === 'clear') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
          <Icons.check className="w-3 h-3" />
          Ready
        </span>
      );
    }
    if (effectiveClarity === 'unknown_project') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
          <Icons.alertCircle />
          Unknown project
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
        <Icons.alertCircle />
        Needs clarification
      </span>
    );
  };

  const getTypeBadge = (type: ParsedTodo['type']) => {
    const colors: Record<ParsedTodo['type'], string> = {
      bug: 'bg-red-500/20 text-red-400',
      feature: 'bg-purple-500/20 text-purple-400',
      enhancement: 'bg-blue-500/20 text-blue-400',
      refactor: 'bg-cyan-500/20 text-cyan-400',
      docs: 'bg-gray-500/20 text-gray-400',
      other: 'bg-surface-600 text-theme-muted',
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs ${colors[type]}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="flex flex-col max-h-[70vh]">
      {/* Header Summary */}
      <div className="px-6 py-4 border-b border-surface-600 shrink-0">
        <h3 className="text-sm font-medium text-theme-primary">
          {parsedTodos.length} todo{parsedTodos.length !== 1 ? 's' : ''} parsed
        </h3>
        {summary && (
          <p className="text-xs text-theme-muted mt-0.5">
            {summary.routableCount} ready to route
            {summary.needsClarificationCount > 0 &&
              ` • ${summary.needsClarificationCount} need${summary.needsClarificationCount === 1 ? 's' : ''} clarification`}
          </p>
        )}
      </div>

      {/* Todo List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-3">
          {orderedTodos.map((todo: ParsedTodo, index: number) => (
            <div
              key={todo.id}
              className={`p-4 bg-surface-800 rounded-lg border transition-colors ${
                getEffectiveClarity(todo) === 'clear'
                  ? 'border-surface-600'
                  : 'border-yellow-500/30'
              }`}
            >
              {/* Todo Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-theme-muted">{index + 1}.</span>
                    <h4 className="text-sm font-medium text-theme-primary truncate">
                      {todo.title}
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {getTypeBadge(todo.type)}
                    {getClarityBadge(todo)}
                    <ProjectSelector
                      todo={todo}
                      projects={projects}
                      onSelect={(projectId) => selectProjectForTodo(todo.id, projectId)}
                    />
                    <DispatchTargetSelector
                      todo={todo}
                      projectId={todo.projectId}
                      availableInstances={todo.projectId ? (projectInstancesCache[todo.projectId] || []) : []}
                      currentTarget={dispatchTargets[todo.id]}
                      onSelect={(target) => setDispatchTarget(todo.id, target)}
                      projectName={getProjectName(todo.projectId)}
                      projectPath={projects.find((p: { id: string }) => p.id === todo.projectId)?.path}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpandedTodoId(expandedTodoId === todo.id ? null : todo.id)}
                    className={`p-1.5 rounded text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-all ${
                      expandedTodoId === todo.id ? 'rotate-180' : ''
                    }`}
                    title="Show details"
                  >
                    <Icons.chevronDown />
                  </button>
                  <button
                    onClick={() => removeTodo(todo.id)}
                    className="p-1.5 rounded text-theme-muted hover:text-red-400 hover:bg-surface-700 transition-colors"
                    title="Remove todo"
                  >
                    <Icons.trash className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedTodoId === todo.id && (
                <div className="mt-3 pt-3 border-t border-surface-700">
                  <p className="text-xs text-theme-muted mb-1">Original text:</p>
                  <p className="text-sm text-theme-secondary font-mono bg-surface-900 p-2 rounded">
                    {todo.originalText}
                  </p>
                </div>
              )}

              {/* Clarification Input */}
              {todo.clarificationNeeded && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-400 mb-2">
                    {todo.clarificationNeeded.question}
                  </p>
                  <input
                    type="text"
                    value={clarificationInputs[todo.id] || ''}
                    onChange={(e) =>
                      setClarificationInputs((prev) => ({
                        ...prev,
                        [todo.id]: e.target.value,
                      }))
                    }
                    placeholder="Your answer..."
                    className="w-full px-3 py-2 bg-surface-800 border border-surface-600 rounded text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {/* Unknown project prompt - show when no explicit clarification but project is unknown */}
              {!todo.clarificationNeeded && getEffectiveClarity(todo) === 'unknown_project' && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-400 mb-2">
                    This todo mentions a project that isn't registered locally.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenCloneModal()}
                      className="px-3 py-1.5 bg-surface-700 text-theme-primary border border-surface-600 rounded text-xs hover:bg-surface-600 transition-colors flex items-center gap-1.5"
                    >
                      <Icons.github />
                      Clone & Create Instance
                    </button>
                    <span className="text-xs text-theme-muted">or remove this todo</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {parsedTodos.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🤔</div>
            <p className="text-theme-muted text-sm">No todos were parsed from your input.</p>
            <button
              onClick={onBack}
              className="mt-4 text-sm text-accent hover:underline"
            >
              Try again with different input
            </button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-surface-600 shrink-0 space-y-3">
        {/* Dispatch Summary */}
        {routableTodos.length > 0 && instancesFetched && (
          <div className="flex items-center gap-3 px-3 py-2 bg-frost-200/10 rounded-lg text-xs text-frost-200">
            <Icons.computer />
            {dispatchSummary.totalTodos > 0 ? (
              <span>
                Will dispatch <strong>{dispatchSummary.totalTodos} todo{dispatchSummary.totalTodos !== 1 ? 's' : ''}</strong> to{' '}
                <strong>{dispatchSummary.totalInstances} instance{dispatchSummary.totalInstances !== 1 ? 's' : ''}</strong>
                {dispatchSummary.newInstances > 0 && (
                  <span className="text-accent"> ({dispatchSummary.newInstances} new)</span>
                )}
              </span>
            ) : (
              <span>
                Will save <strong>{dispatchSummary.saveOnly} todo{dispatchSummary.saveOnly !== 1 ? 's' : ''}</strong> without dispatching
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm text-theme-muted hover:text-theme-primary transition-colors"
          >
            ← Back to input
          </button>

          <div className="flex items-center gap-2">
            {/* Clone & Create Instance button - shows when GitHub repo is detected or unknown projects exist */}
            {(detectedGitHubRepo || hasUnknownProjectTodos) && (
              <button
                onClick={() => handleOpenCloneModal()}
                className="px-4 py-2 bg-surface-700 text-theme-primary border border-surface-600 rounded-lg text-sm hover:bg-surface-600 transition-colors flex items-center gap-2"
                title={detectedGitHubRepo ? `Clone ${detectedGitHubRepo.name}` : 'Clone a repo and create instance'}
              >
                <Icons.github />
                {detectedGitHubRepo ? (
                  <>Clone {detectedGitHubRepo.name.split('/').pop()}</>
                ) : (
                  <>Clone & Create</>
                )}
              </button>
            )}

            {needsClarification && todosNeedingClarification.length > 0 && (
              <button
                onClick={handleClarificationSubmit}
                disabled={isSubmittingClarification || Object.keys(clarificationInputs).length === 0}
                className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmittingClarification ? 'Submitting...' : 'Submit Clarifications'}
              </button>
            )}

            <button
              onClick={handleCreateAndDispatch}
              disabled={isCreatingTodos || routableTodos.length === 0}
              className="px-4 py-2 bg-accent text-surface-900 rounded-lg font-medium text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isCreatingTodos ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-surface-900 border-t-transparent rounded-full" />
                  {dispatchState === 'dispatching' ? 'Dispatching...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Icons.send className="w-4 h-4" />
                  Create & Dispatch {routableTodos.length} Todo{routableTodos.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Clone Setup Modal */}
      {showCloneModal && sessionId && cloneRepoInfo && (
        <CloneSetupModal
          isOpen={showCloneModal}
          onClose={() => {
            setShowCloneModal(false);
            setCloneRepoInfo(null);
          }}
          onComplete={handleCloneComplete}
          sessionId={sessionId}
          gitRepoUrl={cloneRepoInfo.url}
          repoName={cloneRepoInfo.name}
        />
      )}
    </div>
  );
}
