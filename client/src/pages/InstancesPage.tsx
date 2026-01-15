import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInstancesStore } from '../store/instancesStore';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { Terminal, type TerminalRef } from '../components/terminal';
import { CardLayout } from '../components/instances/CardLayout';
import { ListLayout } from '../components/instances/ListLayout';
import { InstanceSkeletons } from '../components/instances/InstanceSkeleton';
// Plans and Mockups hidden - uncomment to restore
// import { PlansPanel } from '../components/plans';
// import { MockupsPanel } from '../components/mockups/MockupsPanel';
import { PortForwardsPanel } from '../components/PortForwardsPanel';
import { StatusDot, StatusBadge } from '../components/common/Status';
import { EditableName } from '../components/common/EditableName';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { ErrorState } from '../components/common/ErrorState';
import { Icons } from '../components/common/Icons';
import { instancesApi, keychainApi } from '../api/client';
import { toast } from '../store/toastStore';
import { KeychainUnlockModal } from '../components/modals/KeychainUnlockModal';
import { HooksConfigModal } from '../components/modals/HooksConfigModal';
import type { Instance } from '@cc-orchestrator/shared';

export default function InstancesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { instances, setActiveInstanceId, updateInstance, removeInstance, reorderInstances, currentCwds, isLoading } = useInstancesStore();
  const {
    layout,
    // Plans and Mockups hidden from UI but state still managed for future restore
    editorPanelOpen, setEditorPanelOpen,
    mockupsPanelOpen, setMockupsPanelOpen, mockupsPanelWidth,
    terminalPanelOpen, toggleTerminalPanel, setTerminalPanelOpen,
    panelWidth,
    setShowNewInstanceModal
  } = useUIStore();
  const { theme } = useSettingsStore();

  // Track previous instance ID to detect navigation between different instances
  const prevInstanceIdRef = useRef<string | undefined>(undefined);

  // Terminal refs for auto-focus on instance switch
  const terminalRefs = useRef<Map<string, TerminalRef>>(new Map());

  // Reset panels to terminal-only when navigating to a DIFFERENT instance
  // (not on page refresh of the same instance)
  useEffect(() => {
    if (id && prevInstanceIdRef.current !== undefined && prevInstanceIdRef.current !== id) {
      setEditorPanelOpen(false);
      setMockupsPanelOpen(false);
      setTerminalPanelOpen(true);

      // Auto-focus terminal after instance switch
      requestAnimationFrame(() => {
        const terminalRef = terminalRefs.current.get(id);
        if (terminalRef) {
          terminalRef.focus();
        }
      });
    }
    prevInstanceIdRef.current = id;
  }, [id, setEditorPanelOpen, setMockupsPanelOpen, setTerminalPanelOpen]);

  // Auto-close panels when window is too narrow to maintain 300px minimum terminal width
  useEffect(() => {
    if (!id || !terminalPanelOpen) return;

    const checkWidth = () => {
      const containerWidth = window.innerWidth;
      const editorWidth = editorPanelOpen ? panelWidth : 0;
      const mockupsWidth = mockupsPanelOpen ? mockupsPanelWidth : 0;
      const terminalWidth = containerWidth - editorWidth - mockupsWidth;

      if (terminalWidth < 300) {
        // Auto-close mockups panel first
        if (mockupsPanelOpen) {
          setMockupsPanelOpen(false);
        }
        // If still too narrow, close editor panel
        else if (editorPanelOpen) {
          setEditorPanelOpen(false);
        }
      }
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, [id, terminalPanelOpen, editorPanelOpen, mockupsPanelOpen, panelWidth, mockupsPanelWidth, setEditorPanelOpen, setMockupsPanelOpen]);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Confirm dialog state
  const [confirmInstance, setConfirmInstance] = useState<Instance | null>(null);

  // Keychain modal state
  const [showKeychainModal, setShowKeychainModal] = useState(false);

  // Hooks config modal state
  const [showHooksConfigModal, setShowHooksConfigModal] = useState(false);

  // Status reset state
  const [resettingStatus, setResettingStatus] = useState(false);

  // Track which machines have saved keychain passwords
  const [savedPasswords, setSavedPasswords] = useState<Record<string, boolean>>({});

  // Check saved password status for remote instances
  useEffect(() => {
    const remoteInstances = instances.filter(i => i.machineId);
    const uniqueMachineIds = [...new Set(remoteInstances.map(i => i.machineId!))];

    // Check each unique machine ID
    uniqueMachineIds.forEach(async (machineId) => {
      // Skip if we already know the status
      if (savedPasswords[machineId] !== undefined) return;

      try {
        const res = await keychainApi.hasRemotePassword(machineId);
        setSavedPasswords(prev => ({ ...prev, [machineId]: res.data?.hasPassword ?? false }));
      } catch {
        // Silently fail - just won't show the indicator
      }
    });
  }, [instances, savedPasswords]);

  // Callback to refresh saved password status after modal closes
  const refreshSavedPasswordStatus = useCallback(async (machineId: string) => {
    try {
      const res = await keychainApi.hasRemotePassword(machineId);
      setSavedPasswords(prev => ({ ...prev, [machineId]: res.data?.hasPassword ?? false }));
    } catch {
      // Silently fail
    }
  }, []);

  // Loading state for new instance creation

  // Get current instance for keyboard shortcuts
  const currentInstance = id ? instances.find(i => i.id === id) : null;

  // Instance-specific keyboard shortcut handlers
  const handleKeyboardClose = useCallback(() => {
    if (currentInstance) {
      if (currentInstance.status === 'working' || currentInstance.isPinned) {
        setConfirmInstance(currentInstance);
      } else {
        instancesApi.close(currentInstance.id).then(() => {
          removeInstance(currentInstance.id);
          navigate('/instances');
        }).catch(() => { /* Error toast shown by API layer */ });
      }
    }
  }, [currentInstance, navigate, removeInstance]);

  const handleKeyboardTogglePin = useCallback(() => {
    if (currentInstance) {
      instancesApi.update(currentInstance.id, { isPinned: !currentInstance.isPinned })
        .then(() => updateInstance(currentInstance.id, { isPinned: !currentInstance.isPinned }))
        .catch(() => { /* Error toast shown by API layer */ });
    }
  }, [currentInstance, updateInstance]);

  const handleKeyboardRename = useCallback(() => {
    if (currentInstance) {
      setEditingId(currentInstance.id);
      setEditingName(currentInstance.name);
    }
  }, [currentInstance]);

  // Instance-specific keyboard shortcuts
  useKeyboardShortcuts({
    enabled: !!id, // Only active when viewing a specific instance
    onCloseInstance: handleKeyboardClose,
    onTogglePin: handleKeyboardTogglePin,
    onRenameInstance: handleKeyboardRename,
  });

  const handleSelect = useCallback((instanceId: string) => {
    setActiveInstanceId(instanceId);
  }, [setActiveInstanceId]);

  const handleExpand = useCallback((instanceId: string) => {
    navigate(`/instances/${instanceId}`);
  }, [navigate]);

  const handleTogglePin = useCallback(async (instanceId: string) => {
    const instance = instances.find(i => i.id === instanceId);
    if (instance) {
      try {
        await instancesApi.update(instanceId, { isPinned: !instance.isPinned });
        updateInstance(instanceId, { isPinned: !instance.isPinned });
      } catch {
        // Error toast shown by API layer
      }
    }
  }, [instances, updateInstance]);

  const handleClose = useCallback((instance: Instance) => {
    if (instance.status === 'working' || instance.isPinned) {
      setConfirmInstance(instance);
    } else {
      performClose(instance.id);
    }
  }, []);

  const performClose = useCallback(async (instanceId: string) => {
    try {
      await instancesApi.close(instanceId);
      removeInstance(instanceId);
      if (id === instanceId) {
        navigate('/instances');
      }
    } catch {
      // Error toast shown by API layer
    }
  }, [id, navigate, removeInstance]);

  const handleReorder = useCallback(async (draggedId: string, targetId: string) => {
    const draggedIndex = instances.findIndex(i => i.id === draggedId);
    const targetIndex = instances.findIndex(i => i.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...instances];
    const [dragged] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, dragged);

    const instanceIds = newOrder.map(i => i.id);
    reorderInstances(instanceIds);

    try {
      await instancesApi.reorder({ instanceIds });
    } catch {
      // Error toast shown by API layer
    }
  }, [instances, reorderInstances]);

  const handleNewInstance = useCallback(() => {
    setShowNewInstanceModal(true);
  }, [setShowNewInstanceModal]);

  const handleStartEditing = useCallback((instanceId: string, name: string) => {
    setEditingId(instanceId);
    setEditingName(name);
  }, []);

  const handleConfirmRename = useCallback(async (instanceId: string) => {
    if (editingName.trim() && editingName !== instances.find(i => i.id === instanceId)?.name) {
      try {
        await instancesApi.update(instanceId, { name: editingName.trim() });
        updateInstance(instanceId, { name: editingName.trim() });
      } catch {
        // Error toast shown by API layer
      }
    }
    setEditingId(null);
    setEditingName('');
  }, [editingName, instances, updateInstance]);

  const handleCancelEditing = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  // Show hooks config modal for remote instance
  const handleShowHooksConfig = useCallback(() => {
    setShowHooksConfigModal(true);
  }, []);

  // Reset instance status to idle
  const handleResetStatus = useCallback(async (instanceId: string) => {
    setResettingStatus(true);
    try {
      await instancesApi.resetStatus(instanceId);
      updateInstance(instanceId, { status: 'idle' });
      toast.success('Status reset to idle');
    } catch (error) {
      console.error('Failed to reset status:', error);
    } finally {
      setResettingStatus(false);
    }
  }, [updateInstance]);

  // Expanded view for a specific instance
  if (id) {
    const instance = instances.find((i) => i.id === id);
    if (!instance) {
      return (
        <div className="flex-1 flex items-center justify-center bg-surface-800">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center text-theme-dim">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-base font-medium text-theme-primary mb-2">Session not found</h3>
            <p className="text-sm text-theme-muted mb-6">
              This session may have been closed or the ID is invalid.
            </p>
            <button
              onClick={() => navigate('/instances')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface-700 text-theme-primary rounded-lg hover:bg-surface-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back to Sessions
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-surface-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-10 bg-surface-800 border-b border-surface-600 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/instances')}
              className="p-1 rounded hover:bg-surface-700 text-theme-dim hover:text-theme-primary transition-colors"
              title="Back to overview (Escape)"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-surface-600">│</span>
            <StatusDot status={instance.status} size="md" />
            <EditableName
              name={instance.name}
              isEditing={editingId === instance.id}
              editingValue={editingName}
              onStartEdit={() => handleStartEditing(instance.id, instance.name)}
              onValueChange={setEditingName}
              onConfirm={() => handleConfirmRename(instance.id)}
              onCancel={handleCancelEditing}
              className="text-sm font-medium"
            />
            <StatusBadge status={instance.status} />
            {instance.machineType === 'remote' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10 text-accent text-xs">
                <Icons.wifi />
                <span>Remote</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Plans and Mockups buttons hidden - uncomment to restore
            <button
              onClick={toggleEditorPanel}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors
                ${editorPanelOpen
                  ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                  : 'text-theme-dim hover:text-theme-primary hover:bg-surface-700'}`}
            >
              <Icons.file />
              <span>Plans</span>
            </button>
            <button
              onClick={() => setMockupsPanelOpen(!mockupsPanelOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors
                ${mockupsPanelOpen
                  ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                  : 'text-theme-dim hover:text-theme-primary hover:bg-surface-700'}`}
            >
              <Icons.code />
              <span>Mockups</span>
            </button>
            */}
            <button
              onClick={toggleTerminalPanel}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors
                ${terminalPanelOpen
                  ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                  : 'text-theme-dim hover:text-theme-primary hover:bg-surface-700'}`}
            >
              <Icons.terminal />
              <span>Terminal</span>
            </button>
            <span className="text-surface-600 mx-1">│</span>
            {/* Reset Status button - shown when instance is working */}
            {instance.status === 'working' && (
              <button
                onClick={() => handleResetStatus(instance.id)}
                disabled={resettingStatus}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-aurora-4 hover:text-aurora-3 hover:bg-surface-700 transition-colors disabled:opacity-50"
                title="Manually reset status to idle"
              >
                <Icons.refresh />
                <span>{resettingStatus ? 'Resetting...' : 'Reset Status'}</span>
              </button>
            )}
            {/* Only show Keychain and Hooks buttons for remote instances */}
            {instance.machineType === 'remote' && (
              <>
                <button
                  onClick={handleShowHooksConfig}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-frost-3 hover:text-frost-2 hover:bg-surface-700 transition-colors"
                  title="View hooks configuration for status tracking"
                >
                  <Icons.settings />
                  <span>Hooks Config</span>
                </button>
                <button
                  onClick={() => setShowKeychainModal(true)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                    instance.machineId && savedPasswords[instance.machineId]
                      ? 'text-frost-3 hover:text-frost-2 hover:bg-surface-700'
                      : 'text-aurora-4 hover:text-aurora-3 hover:bg-surface-700'
                  }`}
                  title={instance.machineId && savedPasswords[instance.machineId]
                    ? "Password saved - click to auto-unlock or manage"
                    : "Unlock remote macOS Keychain"}
                >
                  <span className="relative">
                    <Icons.unlock />
                    {instance.machineId && savedPasswords[instance.machineId] && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-frost-4 rounded-full" />
                    )}
                  </span>
                  <span>Keychain</span>
                </button>
                <span className="text-surface-600 mx-1">│</span>
              </>
            )}
            <span className="text-[10px] text-theme-dim font-mono">{currentCwds[instance.id] || instance.workingDir}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(currentCwds[instance.id] || instance.workingDir);
                toast.success('Copied to clipboard');
              }}
              className="p-0.5 rounded text-theme-dim hover:text-theme-primary hover:bg-surface-700 transition-colors opacity-50 hover:opacity-100"
              title="Copy working directory"
            >
              <Icons.copy />
            </button>
          </div>
        </div>

        {/* Port Forwards Panel - only shown for remote instances with active forwards */}
        <PortForwardsPanel instance={instance} />

        {/* Terminal + Plans Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Terminals - render ALL but hide inactive ones to preserve history */}
          {terminalPanelOpen && (
            <div className="flex-1 overflow-hidden relative min-w-[300px]">
              {instances.map((inst) => (
                <div
                  key={inst.id}
                  className="absolute inset-0"
                  style={{
                    visibility: inst.id === instance.id ? 'visible' : 'hidden',
                    pointerEvents: inst.id === instance.id ? 'auto' : 'none',
                  }}
                >
                  <ErrorBoundary
                    fallback={
                      <div className="flex items-center justify-center h-full bg-surface-900">
                        <ErrorState
                          title="Terminal Error"
                          message="Terminal failed to load. Try refreshing the page."
                        />
                      </div>
                    }
                  >
                    <Terminal
                      ref={(ref) => {
                        if (ref) {
                          terminalRefs.current.set(inst.id, ref);
                        } else {
                          terminalRefs.current.delete(inst.id);
                        }
                      }}
                      instanceId={inst.id}
                      theme={theme === 'dark' ? 'dark' : 'light'}
                    />
                  </ErrorBoundary>
                </div>
              ))}
            </div>
          )}

          {/* Plans Panel - hidden, uncomment to restore
          <PlansPanel
            instanceId={instance.id}
            workingDir={currentCwds[instance.id] || instance.workingDir}
            isOpen={editorPanelOpen}
            onClose={() => setEditorPanelOpen(false)}
            width={panelWidth}
            onWidthChange={setPanelWidth}
          />
          */}

          {/* Mockups Panel - hidden, uncomment to restore
          <MockupsPanel
            workingDir={currentCwds[instance.id] || instance.workingDir}
            isOpen={mockupsPanelOpen}
            onClose={() => setMockupsPanelOpen(false)}
            width={mockupsPanelWidth}
            onWidthChange={setMockupsPanelWidth}
          />
          */}

          {/* Empty state when all panels are closed */}
          {!terminalPanelOpen && !editorPanelOpen && !mockupsPanelOpen && (
            <div className="flex-1 flex items-center justify-center bg-surface-800">
              <div className="text-center text-theme-muted">
                <Icons.terminal />
                <p className="mt-2 text-sm">Use the Terminal button above to show the terminal</p>
              </div>
            </div>
          )}
        </div>

        {/* Keychain Unlock Modal */}
        <KeychainUnlockModal
          isOpen={showKeychainModal}
          onClose={() => {
            setShowKeychainModal(false);
            // Refresh saved password status after modal closes
            if (instance.machineId) {
              refreshSavedPasswordStatus(instance.machineId);
            }
          }}
          instanceId={instance.id}
          machineId={instance.machineId}
        />

        {/* Hooks Config Modal */}
        <HooksConfigModal
          isOpen={showHooksConfigModal}
          onClose={() => setShowHooksConfigModal(false)}
          instanceId={instance.id}
          instanceName={instance.name}
        />
      </div>
    );
  }

  // Grid/List view
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-800">
      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <InstanceSkeletons layout={layout} count={6} />
        ) : layout === 'cards' ? (
          <CardLayout
            instances={instances}
            activeId={null}
            onSelect={handleSelect}
            onTogglePin={handleTogglePin}
            onClose={handleClose}
            onExpand={handleExpand}
            onReorder={handleReorder}
            onNewInstance={handleNewInstance}
            editingId={editingId}
            editingName={editingName}
            onStartEditing={handleStartEditing}
            onEditingNameChange={setEditingName}
            onConfirmRename={handleConfirmRename}
            onCancelEditing={handleCancelEditing}
          />
        ) : (
          <ListLayout
            instances={instances}
            activeId={null}
            onSelect={handleSelect}
            onTogglePin={handleTogglePin}
            onClose={handleClose}
            onExpand={handleExpand}
            onReorder={handleReorder}
            editingId={editingId}
            editingName={editingName}
            onStartEditing={handleStartEditing}
            onEditingNameChange={setEditingName}
            onConfirmRename={handleConfirmRename}
            onCancelEditing={handleCancelEditing}
          />
        )}

        {/* Empty state when no instances exist */}
        {!isLoading && instances.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <div className="text-center">
              <div className="text-theme-dim mb-3">
                <Icons.terminal />
              </div>
              <h3 className="text-sm font-medium text-theme-primary mb-1">No sessions yet</h3>
              <p className="text-xs text-theme-dim mb-4">Create your first Claude Code session.</p>
              <button
                onClick={handleNewInstance}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-surface-900 text-xs font-medium rounded hover:bg-accent-bright transition-colors"
              >
                <Icons.plus />
                New Session
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      {confirmInstance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card-elevated rounded-xl p-6 max-w-md shadow-2xl bg-surface-700">
            <h3 className="text-lg font-semibold mb-2 text-theme-primary">Close Instance</h3>
            <p className="text-theme-muted mb-6">
              {confirmInstance.status === 'working'
                ? `"${confirmInstance.name}" is currently working. Are you sure you want to close it?`
                : confirmInstance.isPinned
                ? `"${confirmInstance.name}" is pinned. Are you sure you want to close it?`
                : `Close "${confirmInstance.name}"?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmInstance(null)}
                className="px-4 py-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  performClose(confirmInstance.id);
                  setConfirmInstance(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
              >
                Close Instance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
