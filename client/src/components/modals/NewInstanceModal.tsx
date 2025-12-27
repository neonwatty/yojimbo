import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../store/settingsStore';
import { instancesApi, filesystemApi } from '../../api/client';
import { toast } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import { DirectoryPicker } from '../common/DirectoryPicker';
import type { InstanceMode, ClaudeCliStatus } from '@cc-orchestrator/shared';

interface NewInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewInstanceModal({ isOpen, onClose }: NewInstanceModalProps) {
  const navigate = useNavigate();
  const {
    lastUsedDirectory,
    lastInstanceMode,
    claudeCodeAliases,
    setLastUsedDirectory,
    setLastInstanceMode,
    getDefaultAlias,
  } = useSettingsStore();

  const [name, setName] = useState('');
  const [workingDir, setWorkingDir] = useState(lastUsedDirectory || '~');
  const [mode, setMode] = useState<InstanceMode>(lastInstanceMode || 'claude-code');
  const [selectedAliasId, setSelectedAliasId] = useState<string>(() => {
    const defaultAlias = getDefaultAlias();
    return defaultAlias?.id || '';
  });
  const [claudeStatus, setClaudeStatus] = useState<ClaudeCliStatus | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [checkingClaude, setCheckingClaude] = useState(true);

  // Check Claude CLI status on mount
  useEffect(() => {
    if (isOpen) {
      checkClaudeStatus();
    }
  }, [isOpen]);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setName('');
      setWorkingDir(lastUsedDirectory || '~');
      setMode(lastInstanceMode || 'terminal');
      const defaultAlias = getDefaultAlias();
      setSelectedAliasId(defaultAlias?.id || '');
    }
  }, [isOpen, lastUsedDirectory, lastInstanceMode, getDefaultAlias]);

  const checkClaudeStatus = async () => {
    setCheckingClaude(true);
    try {
      const response = await filesystemApi.claudeStatus();
      if (response.data) {
        setClaudeStatus(response.data);
      }
    } catch {
      // Assume not installed if check fails
      setClaudeStatus({ installed: false, path: null, version: null });
    } finally {
      setCheckingClaude(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for the instance');
      return;
    }

    setIsCreating(true);
    try {
      // Build startup command if Claude Code mode is selected
      let startupCommand: string | undefined;
      if (mode === 'claude-code') {
        const selectedAlias = claudeCodeAliases.find((a) => a.id === selectedAliasId);
        if (selectedAlias) {
          startupCommand = selectedAlias.command;
        }
      }

      const response = await instancesApi.create({
        name: name.trim(),
        workingDir,
        startupCommand,
      });

      if (response.data) {
        // Save preferences
        setLastUsedDirectory(workingDir);
        setLastInstanceMode(mode);

        toast.success('Instance created');
        onClose();
        navigate(`/instances/${response.data.id}`);
      }
    } catch {
      // Error toast handled by API layer
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedAlias = claudeCodeAliases.find((a) => a.id === selectedAliasId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-700 rounded shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-600">
          <h2 className="text-sm font-medium text-theme-primary">New Session</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-theme-dim hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            <Icons.close />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3">
          {/* Claude CLI Warning */}
          {!checkingClaude && claudeStatus && !claudeStatus.installed && (
            <div className="flex items-start gap-2 p-2 bg-state-awaiting/10 border border-state-awaiting/20 rounded">
              <Icons.warning />
              <div className="flex-1">
                <p className="text-xs text-state-awaiting font-medium">Claude CLI not found</p>
                <p className="text-[10px] text-theme-dim mt-0.5">
                  Install Claude Code:{' '}
                  <code className="px-1 py-0.5 bg-surface-800 rounded">npm install -g @anthropic-ai/claude-code</code>
                </p>
              </div>
            </div>
          )}

          {/* Name Input */}
          <div>
            <label className="block text-xs text-theme-dim mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-1.5 text-xs text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-1 focus:ring-frost-4/50"
              autoFocus
            />
            {!name.trim() && (
              <p className="text-[10px] text-theme-dim mt-1">Select a directory below to auto-fill</p>
            )}
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-xs text-theme-dim mb-1">Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('terminal')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors
                  ${mode === 'terminal'
                    ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                    : 'bg-surface-600 text-theme-dim hover:text-theme-primary hover:bg-surface-500'}`}
              >
                <Icons.terminal />
                Terminal
              </button>
              <button
                type="button"
                onClick={() => setMode('claude-code')}
                disabled={!claudeStatus?.installed && !checkingClaude}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${mode === 'claude-code'
                    ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                    : 'bg-surface-600 text-theme-dim hover:text-theme-primary hover:bg-surface-500'}`}
              >
                <Icons.code />
                Claude Code
              </button>
            </div>
          </div>

          {/* Claude Code Alias Selector (only when Claude Code mode is selected) */}
          {mode === 'claude-code' && claudeCodeAliases.length > 0 && (
            <div>
              <label className="block text-xs text-theme-dim mb-1">Command Alias</label>
              <select
                value={selectedAliasId}
                onChange={(e) => setSelectedAliasId(e.target.value)}
                className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:ring-1 focus:ring-frost-4/50"
              >
                {claudeCodeAliases.map((alias) => (
                  <option key={alias.id} value={alias.id}>
                    {alias.name} ({alias.command})
                  </option>
                ))}
              </select>
              {selectedAlias && (
                <p className="text-[10px] text-theme-dim mt-1">
                  Will run: <code className="px-1 py-0.5 bg-surface-800 rounded">{selectedAlias.command}</code>
                </p>
              )}
            </div>
          )}

          {/* Working Directory Picker */}
          <div>
            <label className="block text-xs text-theme-dim mb-1">Working Directory</label>
            <DirectoryPicker
              value={workingDir}
              onChange={(path) => {
                setWorkingDir(path);
                // Auto-generate name from directory if name is empty
                if (!name.trim()) {
                  const dirName = path.split('/').filter(Boolean).pop() || 'New Project';
                  setName(dirName);
                }
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-surface-600 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs font-medium text-theme-dim hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="px-3 py-1.5 rounded text-xs font-medium bg-accent text-surface-900 hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
