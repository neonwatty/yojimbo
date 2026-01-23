import { useState, useRef, useEffect } from 'react';
import { Icons } from '../../common/Icons';
import type { ParsedTodo, Project } from '@cc-orchestrator/shared';

interface ProjectSelectorProps {
  todo: ParsedTodo;
  projects: Project[];
  onSelect: (projectId: string) => void;
}

export function ProjectSelector({ todo, projects, onSelect }: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return 'Unknown';
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown';
  };

  const getProjectPath = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return '';
    // Shorten path for display (replace home with ~)
    return project.path.replace(/^\/Users\/[^/]+/, '~');
  };

  // Build the list of options to show
  const getOptions = (): Array<{ projectId: string; confidence: number; reason?: string }> => {
    // If we have projectMatches, use those
    if (todo.projectMatches && todo.projectMatches.length > 0) {
      return todo.projectMatches;
    }
    // Fallback: just show the current selection if available
    if (todo.projectId) {
      return [{ projectId: todo.projectId, confidence: todo.projectConfidence }];
    }
    return [];
  };

  const options = getOptions();
  const hasMultipleOptions = options.length > 1;
  const currentProjectName = getProjectName(todo.projectId);
  const confidencePercent = Math.round(todo.projectConfidence * 100);

  // If no options and no project, show static "Unknown"
  if (options.length === 0 && !todo.projectId) {
    return (
      <span className="text-xs text-theme-muted">
        Project: Unknown
      </span>
    );
  }

  // If only one option and no alternatives, show static display
  if (!hasMultipleOptions) {
    return (
      <span className="text-xs text-theme-muted">
        Project: {currentProjectName}
        {todo.projectConfidence < 1 && todo.projectId && (
          <span className="ml-1 opacity-60">
            ({confidencePercent}%)
          </span>
        )}
      </span>
    );
  }

  // Multiple options: show dropdown
  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 text-xs text-theme-muted hover:text-theme-primary transition-colors"
      >
        <span>Project:</span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-700 rounded hover:bg-surface-600 transition-colors">
          <span className="text-theme-secondary">{currentProjectName}</span>
          {todo.projectConfidence < 1 && todo.projectId && (
            <span className="opacity-60">({confidencePercent}%)</span>
          )}
          <Icons.chevronDown />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 min-w-[280px] bg-surface-800 border border-surface-600 rounded-lg shadow-xl overflow-hidden">
          {options.map((option) => {
            const isSelected = option.projectId === todo.projectId;
            const projectName = getProjectName(option.projectId);
            const projectPath = getProjectPath(option.projectId);
            const optionConfidence = Math.round(option.confidence * 100);

            return (
              <button
                key={option.projectId}
                onClick={() => {
                  onSelect(option.projectId);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left hover:bg-surface-700 transition-colors ${
                  isSelected ? 'bg-surface-700' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isSelected ? (
                      <Icons.check className="w-3 h-3 text-accent shrink-0" />
                    ) : (
                      <div className="w-3 h-3 shrink-0" />
                    )}
                    <span className={`text-sm truncate ${isSelected ? 'text-theme-primary font-medium' : 'text-theme-secondary'}`}>
                      {projectName}
                    </span>
                  </div>
                  <span className={`text-xs shrink-0 ${
                    optionConfidence >= 70 ? 'text-green-400' :
                    optionConfidence >= 50 ? 'text-yellow-400' :
                    'text-theme-muted'
                  }`}>
                    {optionConfidence}%
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 ml-5">
                  <span className="text-xs text-theme-muted truncate">
                    {projectPath}
                  </span>
                  {option.reason && (
                    <span className="text-xs text-theme-muted opacity-60 truncate" title={option.reason}>
                      · {option.reason}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
