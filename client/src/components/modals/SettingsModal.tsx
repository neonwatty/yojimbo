import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { settingsApi } from '../../api/client';
import { toast } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import type { ClaudeCodeAlias } from '@cc-orchestrator/shared';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    theme,
    terminalFontSize,
    terminalFontFamily,
    claudeCodeAliases,
    setTheme,
    setTerminalFontSize,
    setTerminalFontFamily,
    addAlias,
    updateAlias,
    removeAlias,
    setDefaultAlias,
  } = useSettingsStore();
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isResettingStatus, setIsResettingStatus] = useState(false);

  // Alias editing state
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);
  const [editingAlias, setEditingAlias] = useState<Partial<ClaudeCodeAlias>>({});
  const [isAddingAlias, setIsAddingAlias] = useState(false);
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasCommand, setNewAliasCommand] = useState('');

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setResetConfirmation('');
      setEditingAliasId(null);
      setEditingAlias({});
      setIsAddingAlias(false);
      setNewAliasName('');
      setNewAliasCommand('');
    }
  }, [isOpen]);

  const handleAddAlias = () => {
    if (!newAliasName.trim() || !newAliasCommand.trim()) {
      toast.error('Name and command are required');
      return;
    }
    addAlias(newAliasName.trim(), newAliasCommand.trim());
    setIsAddingAlias(false);
    setNewAliasName('');
    setNewAliasCommand('');
    toast.success('Alias added');
  };

  const handleUpdateAlias = (id: string) => {
    if (!editingAlias.name?.trim() || !editingAlias.command?.trim()) {
      toast.error('Name and command are required');
      return;
    }
    updateAlias(id, {
      name: editingAlias.name.trim(),
      command: editingAlias.command.trim(),
    });
    setEditingAliasId(null);
    setEditingAlias({});
    toast.success('Alias updated');
  };

  const handleRemoveAlias = (id: string) => {
    if (!window.confirm('Remove this alias?')) return;
    removeAlias(id);
    toast.success('Alias removed');
  };

  const startEditingAlias = (alias: ClaudeCodeAlias) => {
    setEditingAliasId(alias.id);
    setEditingAlias({ name: alias.name, command: alias.command });
  };

  const handleResetInstanceStatus = async () => {
    setIsResettingStatus(true);
    try {
      const response = await settingsApi.resetInstanceStatus();
      if (response.data) {
        toast.success(`Reset ${response.data.count} instance(s) to idle`);
      }
    } catch {
      toast.error('Failed to reset instance status');
    } finally {
      setIsResettingStatus(false);
    }
  };

  const handleResetDatabase = async () => {
    if (resetConfirmation !== 'RESET') return;

    setIsResetting(true);
    try {
      await settingsApi.resetDatabase();
      toast.success('Database reset complete');
      // Reload the page to clear all state
      window.location.reload();
    } catch {
      toast.error('Failed to reset database');
      setIsResetting(false);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 animate-in max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <h2 className="text-lg font-semibold text-theme-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            <Icons.close />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Appearance</h3>

          {/* Theme Selector */}
          <div className="flex items-center justify-between">
            <span className="text-theme-primary">Theme</span>
            <div className="flex gap-1 bg-surface-800 rounded-lg p-1">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize
                    ${theme === t ? 'bg-surface-500 text-theme-primary' : 'text-theme-muted hover:text-theme-primary'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider pt-2">Terminal</h3>

          {/* Font Size */}
          <div className="flex items-center justify-between">
            <span className="text-theme-primary">Font Size</span>
            <select
              value={terminalFontSize}
              onChange={(e) => setTerminalFontSize(parseInt(e.target.value))}
              className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {[10, 11, 12, 13, 14, 15, 16, 18, 20, 24].map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </div>

          {/* Font Family */}
          <div className="flex items-center justify-between">
            <span className="text-theme-primary">Font Family</span>
            <select
              value={terminalFontFamily}
              onChange={(e) => setTerminalFontFamily(e.target.value)}
              className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Fira Code">Fira Code</option>
              <option value="SF Mono">SF Mono</option>
              <option value="Monaco">Monaco</option>
              <option value="Menlo">Menlo</option>
            </select>
          </div>

          {/* Claude Code Section */}
          <div className="pt-4 mt-4 border-t border-surface-600">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Claude Code Aliases</h3>
              {!isAddingAlias && (
                <button
                  onClick={() => setIsAddingAlias(true)}
                  className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                >
                  <Icons.plus />
                  Add Alias
                </button>
              )}
            </div>

            <p className="text-xs text-theme-muted mb-3">
              Define command shortcuts for launching Claude Code with different flags or configurations.
            </p>

            {/* Add new alias form */}
            {isAddingAlias && (
              <div className="bg-surface-800 border border-surface-600 rounded-lg p-3 mb-3 space-y-2">
                <input
                  type="text"
                  value={newAliasName}
                  onChange={(e) => setNewAliasName(e.target.value)}
                  placeholder="Alias name (e.g., YOLO Mode)"
                  className="w-full bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
                <input
                  type="text"
                  value={newAliasCommand}
                  onChange={(e) => setNewAliasCommand(e.target.value)}
                  placeholder="Command (e.g., claude --dangerously-skip-permissions)"
                  className="w-full bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-theme-primary font-mono placeholder:text-theme-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsAddingAlias(false);
                      setNewAliasName('');
                      setNewAliasCommand('');
                    }}
                    className="px-2 py-1 text-xs text-theme-muted hover:text-theme-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAlias}
                    className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Alias list */}
            <div className="space-y-2">
              {claudeCodeAliases.map((alias) => (
                <div
                  key={alias.id}
                  className="bg-surface-800 border border-surface-600 rounded-lg p-3"
                >
                  {editingAliasId === alias.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingAlias.name || ''}
                        onChange={(e) => setEditingAlias({ ...editingAlias, name: e.target.value })}
                        className="w-full bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                      />
                      <input
                        type="text"
                        value={editingAlias.command || ''}
                        onChange={(e) => setEditingAlias({ ...editingAlias, command: e.target.value })}
                        className="w-full bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-theme-primary font-mono focus:outline-none focus:ring-1 focus:ring-accent/50"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingAliasId(null);
                            setEditingAlias({});
                          }}
                          className="px-2 py-1 text-xs text-theme-muted hover:text-theme-primary transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateAlias(alias.id)}
                          className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-theme-primary">{alias.name}</span>
                          {alias.isDefault && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-accent/20 text-accent rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <code className="text-xs text-theme-muted font-mono block truncate mt-0.5">
                          {alias.command}
                        </code>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!alias.isDefault && (
                          <button
                            onClick={() => setDefaultAlias(alias.id)}
                            className="p-1 text-theme-muted hover:text-accent transition-colors"
                            title="Set as default"
                          >
                            {Icons.star(false)}
                          </button>
                        )}
                        <button
                          onClick={() => startEditingAlias(alias)}
                          className="p-1 text-theme-muted hover:text-theme-primary transition-colors"
                          title="Edit"
                        >
                          <Icons.edit />
                        </button>
                        <button
                          onClick={() => handleRemoveAlias(alias.id)}
                          className="p-1 text-theme-muted hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <Icons.trash />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Maintenance */}
          <div className="pt-4 mt-4 border-t border-surface-600">
            <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">Maintenance</h3>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-theme-primary">Reset Instance Status</span>
                <p className="text-xs text-theme-muted mt-0.5">Clear stale hook data by resetting all instances to idle</p>
              </div>
              <button
                onClick={handleResetInstanceStatus}
                disabled={isResettingStatus}
                className="px-3 py-1.5 bg-surface-600 text-theme-primary rounded-lg text-sm font-medium hover:bg-surface-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResettingStatus ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="pt-4 mt-4 border-t border-surface-600">
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">Danger Zone</h3>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-theme-muted mb-3">
                Reset the database to clear all instances, sessions, and settings. This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder='Type "RESET" to confirm'
                  className="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
                <button
                  onClick={handleResetDatabase}
                  disabled={resetConfirmation !== 'RESET' || isResetting}
                  className="px-4 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-600 flex items-center justify-between">
          <span className="text-xs text-theme-muted">v{__APP_VERSION__}</span>
          <span className="text-xs text-theme-muted">
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-surface-800 border border-surface-500 rounded text-xs font-mono">
              Esc
            </kbd>{' '}
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
