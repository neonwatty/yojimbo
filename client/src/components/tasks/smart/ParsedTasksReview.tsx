import { useState } from 'react';
import { Icons } from '../../common/Icons';
import { useSmartTasksStore, selectTasksNeedingClarification, selectRoutableTasks } from '../../../store/smartTasksStore';
import { smartTasksApi, tasksApi } from '../../../api/client';
import { toast } from '../../../store/toastStore';
import type { ParsedTask } from '@cc-orchestrator/shared';

interface ParsedTasksReviewProps {
  onBack: () => void;
  onComplete: () => void;
}

export function ParsedTasksReview({ onBack, onComplete }: ParsedTasksReviewProps) {
  const {
    parsedTasks,
    suggestedOrder,
    sessionId,
    summary,
    projects,
    needsClarification,
    removeTask,
    startClarifying,
    setParsedResult,
    setError,
  } = useSmartTasksStore();

  const [clarificationInputs, setClarificationInputs] = useState<Record<string, string>>({});
  const [isSubmittingClarification, setIsSubmittingClarification] = useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const tasksNeedingClarification = selectTasksNeedingClarification(useSmartTasksStore.getState());
  const routableTasks = selectRoutableTasks(useSmartTasksStore.getState());

  // Sort tasks by suggested order
  const orderedTasks = [...parsedTasks].sort((a, b) => {
    const aIndex = suggestedOrder.indexOf(a.id);
    const bIndex = suggestedOrder.indexOf(b.id);
    return aIndex - bIndex;
  });

  const handleClarificationSubmit = async () => {
    if (!sessionId) return;

    // Collect all clarification answers
    const answers = Object.entries(clarificationInputs)
      .filter(([_, value]) => value.trim())
      .map(([taskId, answer]) => {
        const task = parsedTasks.find(t => t.id === taskId);
        return `For "${task?.title}": ${answer}`;
      })
      .join('\n');

    if (!answers) {
      toast.error('Please provide at least one clarification');
      return;
    }

    setIsSubmittingClarification(true);
    startClarifying();

    try {
      const response = await smartTasksApi.clarify(sessionId, answers);

      if (response.data) {
        setParsedResult(
          sessionId,
          { tasks: response.data.tasks, suggestedOrder: response.data.suggestedOrder },
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

  const handleCreateTasks = async () => {
    // Create tasks from all clear, routable parsed tasks
    const tasksToCreate = parsedTasks.filter(
      t => t.clarity === 'clear' && t.projectId !== null
    );

    if (tasksToCreate.length === 0) {
      toast.error('No tasks ready to create');
      return;
    }

    setIsCreatingTasks(true);

    try {
      // Create each task (include type and project info in the text for now)
      for (const parsedTask of tasksToCreate) {
        const projectName = getProjectName(parsedTask.projectId);
        const taskText = `[${parsedTask.type}] ${parsedTask.title}${projectName !== 'Unknown' ? ` (${projectName})` : ''}`;
        await tasksApi.create({
          text: taskText,
        });
      }

      toast.success(`Created ${tasksToCreate.length} task${tasksToCreate.length > 1 ? 's' : ''}`);
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tasks');
    } finally {
      setIsCreatingTasks(false);
    }
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return 'Unknown';
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown';
  };

  const getClarityBadge = (task: ParsedTask) => {
    if (task.clarity === 'clear') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
          <Icons.check className="w-3 h-3" />
          Ready
        </span>
      );
    }
    if (task.clarity === 'unknown_project') {
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

  const getTypeBadge = (type: ParsedTask['type']) => {
    const colors: Record<ParsedTask['type'], string> = {
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
          {parsedTasks.length} task{parsedTasks.length !== 1 ? 's' : ''} parsed
        </h3>
        {summary && (
          <p className="text-xs text-theme-muted mt-0.5">
            {summary.routableCount} ready to route
            {summary.needsClarificationCount > 0 &&
              ` • ${summary.needsClarificationCount} need${summary.needsClarificationCount === 1 ? 's' : ''} clarification`}
          </p>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-3">
          {orderedTasks.map((task, index) => (
            <div
              key={task.id}
              className={`p-4 bg-surface-800 rounded-lg border transition-colors ${
                task.clarity === 'clear'
                  ? 'border-surface-600'
                  : 'border-yellow-500/30'
              }`}
            >
              {/* Task Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-theme-muted">{index + 1}.</span>
                    <h4 className="text-sm font-medium text-theme-primary truncate">
                      {task.title}
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {getTypeBadge(task.type)}
                    {getClarityBadge(task)}
                    <span className="text-xs text-theme-muted">
                      Project: {getProjectName(task.projectId)}
                      {task.projectConfidence < 1 && task.projectId && (
                        <span className="ml-1 opacity-60">
                          ({Math.round(task.projectConfidence * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    className={`p-1.5 rounded text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-all ${
                      expandedTaskId === task.id ? 'rotate-180' : ''
                    }`}
                    title="Show details"
                  >
                    <Icons.chevronDown />
                  </button>
                  <button
                    onClick={() => removeTask(task.id)}
                    className="p-1.5 rounded text-theme-muted hover:text-red-400 hover:bg-surface-700 transition-colors"
                    title="Remove task"
                  >
                    <Icons.trash className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedTaskId === task.id && (
                <div className="mt-3 pt-3 border-t border-surface-700">
                  <p className="text-xs text-theme-muted mb-1">Original text:</p>
                  <p className="text-sm text-theme-secondary font-mono bg-surface-900 p-2 rounded">
                    {task.originalText}
                  </p>
                </div>
              )}

              {/* Clarification Input */}
              {task.clarificationNeeded && (
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-400 mb-2">
                    {task.clarificationNeeded.question}
                  </p>
                  <input
                    type="text"
                    value={clarificationInputs[task.id] || ''}
                    onChange={(e) =>
                      setClarificationInputs((prev) => ({
                        ...prev,
                        [task.id]: e.target.value,
                      }))
                    }
                    placeholder="Your answer..."
                    className="w-full px-3 py-2 bg-surface-800 border border-surface-600 rounded text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-accent"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {parsedTasks.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🤔</div>
            <p className="text-theme-muted text-sm">No tasks were parsed from your input.</p>
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
      <div className="px-6 py-4 border-t border-surface-600 shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm text-theme-muted hover:text-theme-primary transition-colors"
          >
            ← Back to input
          </button>

          <div className="flex items-center gap-2">
            {needsClarification && tasksNeedingClarification.length > 0 && (
              <button
                onClick={handleClarificationSubmit}
                disabled={isSubmittingClarification || Object.keys(clarificationInputs).length === 0}
                className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmittingClarification ? 'Submitting...' : 'Submit Clarifications'}
              </button>
            )}

            <button
              onClick={handleCreateTasks}
              disabled={isCreatingTasks || routableTasks.length === 0}
              className="px-4 py-2 bg-accent text-surface-900 rounded-lg font-medium text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isCreatingTasks ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-surface-900 border-t-transparent rounded-full" />
                  Creating...
                </>
              ) : (
                <>
                  <Icons.check className="w-4 h-4" />
                  Create {routableTasks.length} Task{routableTasks.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
