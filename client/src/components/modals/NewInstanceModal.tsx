import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { instancesApi, filesystemApi, sessionsApi, machinesApi } from '../../api/client';
import { useMachines } from '../../hooks/useMachines';
import { toast } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import { DirectoryPicker } from '../common/DirectoryPicker';
import { Spinner } from '../common/Spinner';
import type { InstanceMode, ClaudeCliStatus, Session, MachineType } from '@cc-orchestrator/shared';

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

  const newInstanceDefaultMode = useUIStore((state) => state.newInstanceDefaultMode);
  const setNewInstanceDefaultMode = useUIStore((state) => state.setNewInstanceDefaultMode);

  const { machines } = useMachines();

  const [name, setName] = useState('');
  const [workingDir, setWorkingDir] = useState(lastUsedDirectory || '~');
  const [mode, setMode] = useState<InstanceMode>(lastInstanceMode || 'claude-code');
  const [machineType, setMachineType] = useState<MachineType>('local');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedAliasId, setSelectedAliasId] = useState<string>(() => {
    const defaultAlias = getDefaultAlias();
    return defaultAlias?.id || '';
  });
  const [claudeStatus, setClaudeStatus] = useState<ClaudeCliStatus | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [checkingClaude, setCheckingClaude] = useState(true);
  const [availableSessions, setAvailableSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [remoteDirs, setRemoteDirs] = useState<string[]>([]);
  const [remoteDirPath, setRemoteDirPath] = useState<string>('~');
  const [loadingRemoteDirs, setLoadingRemoteDirs] = useState(false);
  const [showRemoteBrowser, setShowRemoteBrowser] = useState(false);

  // Check Claude CLI status on mount
  useEffect(() => {
    if (isOpen) {
      checkClaudeStatus();
    }
  }, [isOpen]);

  // Fetch sessions for a directory
  const fetchSessionsForDirectory = useCallback(async (dir: string) => {
    if (!dir || dir === '~') {
      setAvailableSessions([]);
      return;
    }
    setLoadingSessions(true);
    try {
      const response = await sessionsApi.listByDirectory(dir);
      if (response.data) {
        setAvailableSessions(response.data);
      }
    } catch {
      // Silently fail - not critical
      setAvailableSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // Fetch directories on remote machine
  const fetchRemoteDirectories = useCallback(async (machineId: string, path: string) => {
    if (!machineId) return;
    setLoadingRemoteDirs(true);
    try {
      const response = await machinesApi.listDirectories(machineId, path);
      if (response.data) {
        setRemoteDirPath(response.data.path);
        setRemoteDirs(response.data.directories);
        setShowRemoteBrowser(true);
      }
    } catch {
      // Error toast already shown by API client, just reset state
      setRemoteDirs([]);
      setShowRemoteBrowser(false);
    } finally {
      setLoadingRemoteDirs(false);
    }
  }, []);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setName('');
      setWorkingDir(lastUsedDirectory || '~');
      // Use the override mode if set (e.g., from task dispatch), otherwise use saved preference
      const modeToUse = newInstanceDefaultMode || lastInstanceMode || 'terminal';
      setMode(modeToUse);
      // Clear the override after using it
      if (newInstanceDefaultMode) {
        setNewInstanceDefaultMode(null);
      }
      setMachineType('local');
      setSelectedMachineId('');
      const defaultAlias = getDefaultAlias();
      setSelectedAliasId(defaultAlias?.id || '');
      setAvailableSessions([]);
      setSelectedSessionId(null);
      setRemoteDirs([]);
      setRemoteDirPath('~');
      setShowRemoteBrowser(false);
    }
  }, [isOpen, lastUsedDirectory, lastInstanceMode, newInstanceDefaultMode, setNewInstanceDefaultMode, getDefaultAlias]);

  // Fetch sessions when directory changes and in Claude Code mode
  useEffect(() => {
    if (isOpen && mode === 'claude-code' && workingDir) {
      fetchSessionsForDirectory(workingDir);
    } else {
      setAvailableSessions([]);
      setSelectedSessionId(null);
    }
  }, [isOpen, mode, workingDir, fetchSessionsForDirectory]);

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

    if (machineType === 'remote' && !selectedMachineId) {
      toast.error('Please select a remote machine');
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
          // Append --resume flag if a session is selected
          if (selectedSessionId) {
            startupCommand = `${startupCommand} --resume ${selectedSessionId}`;
          }
        }
      }

      const response = await instancesApi.create({
        name: name.trim(),
        workingDir,
        startupCommand,
        machineType,
        machineId: machineType === 'remote' ? selectedMachineId : undefined,
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
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8 sm:py-8" onClick={onClose}>
      <div
        className="bg-surface-700 shadow-2xl w-full mx-0 sm:mx-4 sm:my-auto sm:max-w-md sm:rounded max-sm:min-h-full max-sm:rounded-none max-sm:flex max-sm:flex-col"
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
        <div className="px-4 py-3 space-y-3 max-sm:overflow-y-auto max-sm:flex-1 mobile-scroll">
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
              className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-3 sm:py-1.5 text-base sm:text-xs text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-1 focus:ring-frost-4/50"
              autoFocus
            />
            {!name.trim() && (
              <p className="text-[10px] text-theme-dim mt-1">Select a directory below to auto-fill</p>
            )}
          </div>

          {/* Run On (Local/Remote) */}
          {machines.length > 0 && (
            <div>
              <label className="block text-xs text-theme-dim mb-1">Run On</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMachineType('local');
                    setSelectedMachineId('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors
                    ${machineType === 'local'
                      ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                      : 'bg-surface-600 text-theme-dim hover:text-theme-primary hover:bg-surface-500'}`}
                >
                  <Icons.computer />
                  Local
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMachineType('remote');
                    // Reset to home directory when switching to remote
                    // since local paths won't exist on remote machine
                    setWorkingDir('~');
                    setName('');
                    setShowRemoteBrowser(false);
                    // Force terminal mode for remote machines
                    setMode('terminal');
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors
                    ${machineType === 'remote'
                      ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                      : 'bg-surface-600 text-theme-dim hover:text-theme-primary hover:bg-surface-500'}`}
                >
                  <Icons.server />
                  Remote
                </button>
              </div>
            </div>
          )}

          {/* Machine Selector (when remote) */}
          {machineType === 'remote' && (
            <div>
              <label className="block text-xs text-theme-dim mb-1">Machine</label>
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:ring-1 focus:ring-frost-4/50"
              >
                <option value="">Select a machine...</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name} ({machine.username}@{machine.hostname})
                    {machine.status === 'online' ? ' - Online' : machine.status === 'offline' ? ' - Offline' : ''}
                  </option>
                ))}
              </select>
              {machines.length === 0 && (
                <p className="text-[10px] text-theme-dim mt-1">
                  No remote machines configured. Add one in Settings.
                </p>
              )}
              {selectedMachineId && (
                <p className="text-[10px] text-theme-dim mt-1">
                  Dev server ports will be automatically forwarded to localhost.
                </p>
              )}
            </div>
          )}

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
                disabled={machineType === 'remote' || (!claudeStatus?.installed && !checkingClaude)}
                title={machineType === 'remote' ? 'Claude Code is only available for local machines' : undefined}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${mode === 'claude-code'
                    ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                    : 'bg-surface-600 text-theme-dim hover:text-theme-primary hover:bg-surface-500'}`}
              >
                <Icons.code />
                Claude Code
              </button>
            </div>
            {machineType === 'remote' && (
              <p className="text-[10px] text-theme-dim mt-1">
                Claude Code is only available for local machines. Use Terminal to run commands on remote machines.
              </p>
            )}
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

          {/* Working Directory */}
          <div>
            <label className="block text-xs text-theme-dim mb-1">
              Working Directory {machineType === 'remote' && <span className="text-theme-muted">(on remote machine)</span>}
            </label>
            {machineType === 'local' ? (
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
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={workingDir}
                    onChange={(e) => {
                      setWorkingDir(e.target.value);
                      setShowRemoteBrowser(false);
                      // Auto-generate name from directory if name is empty
                      if (!name.trim()) {
                        const dirName = e.target.value.split('/').filter(Boolean).pop() || 'New Project';
                        setName(dirName);
                      }
                    }}
                    placeholder="~/projects/my-app"
                    className="flex-1 bg-surface-800 border border-surface-600 rounded px-3 py-1.5 text-xs text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-1 focus:ring-frost-4/50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (showRemoteBrowser) {
                        setShowRemoteBrowser(false);
                      } else {
                        fetchRemoteDirectories(selectedMachineId, workingDir || '~');
                      }
                    }}
                    disabled={!selectedMachineId || loadingRemoteDirs}
                    className="px-3 py-1.5 rounded text-xs font-medium bg-surface-600 text-theme-muted hover:text-theme-primary hover:bg-surface-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {loadingRemoteDirs ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <Icons.folder />
                        Browse
                      </>
                    )}
                  </button>
                </div>

                {/* Remote Directory Browser */}
                {showRemoteBrowser && remoteDirs.length >= 0 && (
                  <div className="bg-surface-800 border border-surface-600 rounded p-2 max-h-48 overflow-y-auto">
                    {/* Current path and parent navigation */}
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-surface-600">
                      <button
                        type="button"
                        onClick={() => {
                          // Navigate to parent directory
                          const parentPath = remoteDirPath.replace(/\/[^/]+\/?$/, '') || '/';
                          fetchRemoteDirectories(selectedMachineId, parentPath);
                        }}
                        disabled={remoteDirPath === '/' || loadingRemoteDirs}
                        className="p-1 rounded text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors disabled:opacity-50"
                        title="Go to parent directory"
                      >
                        <Icons.chevronLeft />
                      </button>
                      <code className="text-[10px] text-theme-dim truncate flex-1">{remoteDirPath}</code>
                      <button
                        type="button"
                        onClick={() => {
                          setWorkingDir(remoteDirPath);
                          setShowRemoteBrowser(false);
                          // Auto-generate name from directory if name is empty
                          if (!name.trim()) {
                            const dirName = remoteDirPath.split('/').filter(Boolean).pop() || 'New Project';
                            setName(dirName);
                          }
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-accent text-surface-900 hover:bg-accent-bright transition-colors"
                      >
                        Select
                      </button>
                    </div>

                    {/* Directory list */}
                    {remoteDirs.length === 0 ? (
                      <p className="text-[10px] text-theme-dim text-center py-2">No subdirectories</p>
                    ) : (
                      <div className="space-y-0.5">
                        {remoteDirs.map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            onClick={() => {
                              const newPath = remoteDirPath === '/' ? `/${dir}` : `${remoteDirPath}/${dir}`;
                              fetchRemoteDirectories(selectedMachineId, newPath);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-theme-primary hover:bg-surface-700 transition-colors text-left"
                          >
                            <Icons.folder />
                            <span className="truncate">{dir}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!showRemoteBrowser && (
                  <p className="text-[10px] text-theme-dim">
                    Enter a path or click Browse to explore the remote machine
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Resume Session Section (only when Claude Code mode and sessions exist) */}
          {mode === 'claude-code' && (
            <div>
              {loadingSessions ? (
                <div className="flex items-center gap-2 text-xs text-theme-dim">
                  <Spinner size="sm" />
                  <span>Checking for previous sessions...</span>
                </div>
              ) : availableSessions.length > 0 ? (
                <div className="p-2 bg-surface-800 border border-surface-600 rounded">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icons.history />
                    <span className="text-xs text-theme-dim">
                      {availableSessions.length} previous session{availableSessions.length !== 1 ? 's' : ''} found
                    </span>
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-700 cursor-pointer">
                      <input
                        type="radio"
                        name="sessionChoice"
                        checked={selectedSessionId === null}
                        onChange={() => setSelectedSessionId(null)}
                        className="accent-frost-4"
                      />
                      <span className="text-xs text-theme-primary">Start fresh</span>
                    </label>
                    {availableSessions.map((session) => {
                      const date = new Date(session.startedAt);
                      const now = new Date();
                      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                      const timeLabel = diffDays === 0
                        ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        : diffDays === 1
                          ? 'Yesterday'
                          : diffDays < 7
                            ? date.toLocaleDateString('en-US', { weekday: 'short' })
                            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                      return (
                        <label
                          key={session.id}
                          className="flex items-start gap-2 p-1.5 rounded hover:bg-surface-700 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="sessionChoice"
                            checked={selectedSessionId === session.id}
                            onChange={() => setSelectedSessionId(session.id)}
                            className="accent-frost-4 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-theme-primary truncate">
                                {session.summary || 'Untitled session'}
                              </span>
                              <span className="text-[10px] text-theme-muted shrink-0">{timeLabel}</span>
                            </div>
                            <span className="text-[10px] text-theme-dim">
                              {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
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
