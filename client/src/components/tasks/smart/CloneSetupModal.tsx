import { useState, useEffect, useCallback } from 'react';
import { Icons } from '../../common/Icons';
import { smartTasksApi } from '../../../api/client';
import { toast } from '../../../store/toastStore';
import type { SetupProgressEvent } from '@cc-orchestrator/shared';

interface CloneSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (instanceId: string) => void;
  sessionId: string;
  gitRepoUrl: string;
  repoName: string;
}

type SetupStep = 'input' | 'cloning' | 'creating-instance' | 'registering-project' | 'complete' | 'error';

// Helper to extract repo name from URL
function extractRepoNameFromUrl(url: string): string {
  // Handle SSH URLs like git@github.com:owner/repo.git
  // Handle HTTPS URLs like https://github.com/owner/repo.git
  const match = url.match(/[\/:]([^\/]+\/[^\/]+?)(\.git)?$/);
  if (match) {
    return match[1].replace(/\.git$/, '');
  }
  // Fallback: extract just the last part
  const parts = url.split('/');
  let name = parts[parts.length - 1];
  if (name.endsWith('.git')) {
    name = name.slice(0, -4);
  }
  return name || 'repo';
}

export function CloneSetupModal({
  isOpen,
  onClose,
  onComplete,
  sessionId,
  gitRepoUrl,
  repoName,
}: CloneSetupModalProps) {
  // Track if we need manual URL entry
  const needsManualUrl = !gitRepoUrl;

  // State for editable URL
  const [editableUrl, setEditableUrl] = useState(gitRepoUrl);
  const [editableRepoName, setEditableRepoName] = useState(repoName);

  // Default path suggestion based on current repo name
  const currentRepoName = editableRepoName || 'repo';
  const defaultPath = `~/Desktop/${currentRepoName.split('/').pop() || 'repo'}`;
  const defaultInstanceName = currentRepoName.split('/').pop() || 'new-project';

  const [targetPath, setTargetPath] = useState(defaultPath);
  const [instanceName, setInstanceName] = useState(defaultInstanceName);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    exists: boolean;
    parentExists: boolean;
    expandedPath: string;
    error?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<SetupStep>('input');
  const [stepMessage, setStepMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [resultInstanceId, setResultInstanceId] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditableUrl(gitRepoUrl);
      setEditableRepoName(repoName);
      const repoShortName = repoName.split('/').pop() || 'repo';
      setTargetPath(`~/Desktop/${repoShortName}`);
      setInstanceName(repoShortName || 'new-project');
      setValidationResult(null);
      setCurrentStep('input');
      setStepMessage('');
      setError(null);
      setResultInstanceId(null);
      setIsSubmitting(false);
    }
  }, [isOpen, gitRepoUrl, repoName]);

  // Update path and instance name when URL changes
  const handleUrlChange = (url: string) => {
    setEditableUrl(url);
    if (url.trim()) {
      const extractedName = extractRepoNameFromUrl(url);
      setEditableRepoName(extractedName);
      const shortName = extractedName.split('/').pop() || 'repo';
      setTargetPath(`~/Desktop/${shortName}`);
      setInstanceName(shortName);
    }
  };

  // Validate path on change (debounced)
  const validatePath = useCallback(async (path: string) => {
    if (!path.trim()) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    try {
      const response = await smartTasksApi.validatePath(path);
      if (response.data) {
        setValidationResult(response.data);
      }
    } catch {
      // Silent fail for validation
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      validatePath(targetPath);
    }, 300);
    return () => clearTimeout(timer);
  }, [targetPath, validatePath]);

  // Handle WebSocket progress updates
  useEffect(() => {
    if (!isOpen || currentStep === 'input' || currentStep === 'complete') return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'setup:progress' && data.setupProgress) {
          const progress = data.setupProgress as SetupProgressEvent;

          // Only handle events for our session
          if (progress.sessionId && progress.sessionId !== sessionId) return;

          setStepMessage(progress.message);

          switch (progress.step) {
            case 'cloning':
              setCurrentStep('cloning');
              break;
            case 'clone-complete':
            case 'creating-instance':
              setCurrentStep('creating-instance');
              break;
            case 'instance-created':
            case 'registering-project':
              setCurrentStep('registering-project');
              break;
            case 'complete':
              setCurrentStep('complete');
              break;
            case 'error':
              setCurrentStep('error');
              setError(progress.error || 'Unknown error');
              break;
          }
        }
      } catch {
        // Ignore parse errors
      }
    };

    // Listen to existing WebSocket
    const ws = (window as unknown as { __yojimboWs?: WebSocket }).__yojimboWs;
    if (ws) {
      ws.addEventListener('message', handleMessage);
      return () => ws.removeEventListener('message', handleMessage);
    }
  }, [isOpen, currentStep, sessionId]);

  const handleSubmit = async () => {
    if (!editableUrl.trim()) {
      toast.error('Please enter a GitHub repository URL');
      return;
    }

    if (!validationResult?.valid) {
      toast.error(validationResult?.error || 'Invalid path');
      return;
    }

    setIsSubmitting(true);
    setCurrentStep('cloning');
    setStepMessage('Starting clone...');
    setError(null);

    try {
      const response = await smartTasksApi.setupProject({
        sessionId,
        action: 'clone-and-create',
        gitRepoUrl: editableUrl,
        targetPath,
        instanceName: instanceName.trim() || undefined,
      });

      if (response.data?.success) {
        setResultInstanceId(response.data.instanceId || null);
        setCurrentStep('complete');
        toast.success('Project setup complete!');
      } else {
        setError(response.data?.error || 'Setup failed');
        setCurrentStep('error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Setup failed';
      setError(message);
      setCurrentStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    if (resultInstanceId) {
      onComplete(resultInstanceId);
    }
    onClose();
  };

  if (!isOpen) return null;

  const renderStepIndicator = () => {
    const steps: { key: SetupStep; label: string }[] = [
      { key: 'cloning', label: 'Clone' },
      { key: 'creating-instance', label: 'Create Instance' },
      { key: 'registering-project', label: 'Register' },
    ];

    const getCurrentStepIndex = () => {
      switch (currentStep) {
        case 'cloning': return 0;
        case 'creating-instance': return 1;
        case 'registering-project': return 2;
        case 'complete': return 3;
        default: return -1;
      }
    };

    const currentIndex = getCurrentStepIndex();

    return (
      <div className="flex items-center justify-center gap-2 mb-4">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                index < currentIndex
                  ? 'bg-green-500 text-white'
                  : index === currentIndex
                    ? 'bg-accent text-surface-900 animate-pulse'
                    : 'bg-surface-700 text-theme-muted'
              }`}
            >
              {index < currentIndex ? (
                <Icons.check className="w-3 h-3" />
              ) : (
                index + 1
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-1 ${
                  index < currentIndex ? 'bg-green-500' : 'bg-surface-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    // Input form
    if (currentStep === 'input') {
      return (
        <>
          {/* Repository URL - editable if manual entry needed, otherwise display */}
          <div className="mb-4">
            <label className="block text-xs text-theme-muted mb-1">Repository URL</label>
            {needsManualUrl ? (
              <input
                type="text"
                value={editableUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://github.com/owner/repo or git@github.com:owner/repo.git"
                className="w-full px-3 py-2 bg-surface-800 border border-surface-600 rounded text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-accent font-mono"
              />
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-800 rounded border border-surface-600">
                <Icons.github />
                <span className="text-sm text-theme-primary font-mono">{editableRepoName || editableUrl}</span>
              </div>
            )}
          </div>

          {/* Clone Path */}
          <div className="mb-4">
            <label className="block text-xs text-theme-muted mb-1">Clone to</label>
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="~/Desktop/my-project"
              className="w-full px-3 py-2 bg-surface-800 border border-surface-600 rounded text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-accent font-mono"
            />
            {isValidating && (
              <p className="text-xs text-theme-muted mt-1">Validating path...</p>
            )}
            {validationResult && !isValidating && (
              <p
                className={`text-xs mt-1 ${
                  validationResult.valid
                    ? 'text-green-400'
                    : validationResult.exists
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {validationResult.valid ? (
                  <>✓ Path is valid: {validationResult.expandedPath}</>
                ) : validationResult.exists ? (
                  <>⚠️ Directory already exists</>
                ) : !validationResult.parentExists ? (
                  <>✗ Parent directory does not exist</>
                ) : (
                  <>✗ {validationResult.error}</>
                )}
              </p>
            )}
          </div>

          {/* Instance Name */}
          <div className="mb-6">
            <label className="block text-xs text-theme-muted mb-1">Instance name</label>
            <input
              type="text"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder="my-project"
              className="w-full px-3 py-2 bg-surface-800 border border-surface-600 rounded text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-accent"
            />
          </div>
        </>
      );
    }

    // Progress state
    if (currentStep === 'cloning' || currentStep === 'creating-instance' || currentStep === 'registering-project') {
      return (
        <div className="py-8">
          {renderStepIndicator()}
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-theme-primary">{stepMessage || 'Setting up...'}</p>
          </div>
        </div>
      );
    }

    // Complete state
    if (currentStep === 'complete') {
      return (
        <div className="py-8 text-center">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icons.check className="w-6 h-6 text-green-400" />
          </div>
          <h4 className="text-lg font-medium text-theme-primary mb-2">Setup Complete!</h4>
          <p className="text-sm text-theme-muted">
            Your instance "{instanceName}" is ready.
          </p>
        </div>
      );
    }

    // Error state
    if (currentStep === 'error') {
      return (
        <div className="py-8 text-center">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icons.alertCircle />
          </div>
          <h4 className="text-lg font-medium text-theme-primary mb-2">Setup Failed</h4>
          <p className="text-sm text-red-400">{error || 'An unknown error occurred'}</p>
        </div>
      );
    }

    return null;
  };

  const renderFooter = () => {
    if (currentStep === 'input') {
      const canSubmit = editableUrl.trim() && validationResult?.valid && !isSubmitting;
      return (
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-theme-muted hover:text-theme-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-accent text-surface-900 rounded-lg font-medium text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Icons.download />
            Clone & Create Instance
          </button>
        </>
      );
    }

    if (currentStep === 'complete') {
      return (
        <button
          onClick={handleComplete}
          className="px-4 py-2 bg-accent text-surface-900 rounded-lg font-medium text-sm hover:bg-accent/90 transition-colors"
        >
          Open Instance
        </button>
      );
    }

    if (currentStep === 'error') {
      return (
        <>
          <button
            onClick={() => {
              setCurrentStep('input');
              setError(null);
            }}
            className="px-4 py-2 text-sm text-theme-muted hover:text-theme-primary transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-700 text-theme-primary rounded-lg text-sm hover:bg-surface-600 transition-colors"
          >
            Close
          </button>
        </>
      );
    }

    // Progress state - no buttons (or a cancel button in future)
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={currentStep === 'input' || currentStep === 'error' || currentStep === 'complete' ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-surface-800 rounded-xl shadow-xl w-full max-w-md mx-4 border border-surface-600">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <h3 className="text-lg font-medium text-theme-primary">
            Clone & Create Instance
          </h3>
          {(currentStep === 'input' || currentStep === 'complete' || currentStep === 'error') && (
            <button
              onClick={onClose}
              className="p-1 rounded text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
            >
              <Icons.close />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4">{renderContent()}</div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-surface-600">
          {renderFooter()}
        </div>
      </div>
    </div>
  );
}
