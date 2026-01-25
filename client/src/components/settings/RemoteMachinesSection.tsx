import { useState } from 'react';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';
import { AddMachineModal } from '../modals/AddMachineModal';
import { useMachines } from '../../hooks/useMachines';
import { toast } from '../../store/toastStore';
import type { RemoteMachine, MachineStatus } from '@cc-orchestrator/shared';

function StatusIndicator({ status }: { status: MachineStatus }) {
  const colors = {
    online: 'bg-state-working',
    offline: 'bg-state-error',
    unknown: 'bg-surface-400',
  };

  const tooltips = {
    online: 'Connected - SSH connection verified',
    offline: 'Offline - Connection failed',
    unknown: 'Unknown - Click Test to verify connection',
  };

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]}`} title={tooltips[status]} />
  );
}

export function RemoteMachinesSection() {
  const { machines, sshKeys, loading, createMachine, updateMachine, deleteMachine, testConnection, testTunnel, installHooks, unlockKeychain } =
    useMachines();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editMachine, setEditMachine] = useState<RemoteMachine | null>(null);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [testingTunnelIds, setTestingTunnelIds] = useState<Set<string>>(new Set());
  const [installingHooksIds, setInstallingHooksIds] = useState<Set<string>>(new Set());
  const [unlockingKeychainIds, setUnlockingKeychainIds] = useState<Set<string>>(new Set());
  const [isHelpExpanded, setIsHelpExpanded] = useState(false);

  const handleTestConnection = async (id: string) => {
    setTestingIds((prev) => new Set(prev).add(id));
    try {
      const result = await testConnection(id);
      if (result.connected) {
        toast.success('Connection successful');
      } else {
        toast.error(result.error || 'Connection failed');
      }
    } catch {
      toast.error('Failed to test connection');
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleTestTunnel = async (id: string) => {
    setTestingTunnelIds((prev) => new Set(prev).add(id));
    try {
      const result = await testTunnel(id);
      if (result.active) {
        toast.success('Tunnel is active');
      } else {
        toast.info(result.message || 'No active tunnel');
      }
    } catch {
      toast.error('Failed to test tunnel');
    } finally {
      setTestingTunnelIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleInstallHooks = async (id: string) => {
    setInstallingHooksIds((prev) => new Set(prev).add(id));
    try {
      // Use the current page URL as the orchestrator URL
      const orchestratorUrl = `${window.location.protocol}//${window.location.hostname}:3456`;
      const result = await installHooks(id, orchestratorUrl);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message || 'Hooks installed successfully');
      }
    } catch {
      toast.error('Failed to install hooks');
    } finally {
      setInstallingHooksIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleUnlockKeychain = async (id: string, machineName: string) => {
    setUnlockingKeychainIds((prev) => new Set(prev).add(id));
    try {
      const result = await unlockKeychain(id);
      if (result.alreadyUnlocked) {
        toast.info(`Keychain already unlocked for ${machineName}`);
      } else if (result.unlocked) {
        toast.success(`Keychain unlocked for ${machineName}`);
      } else {
        toast.success(result.message);
      }
    } catch {
      toast.error('Failed to unlock keychain. Make sure a password is saved for this machine.');
    } finally {
      setUnlockingKeychainIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteMachine = async (machine: RemoteMachine) => {
    if (!window.confirm(`Delete "${machine.name}"? This cannot be undone.`)) return;
    try {
      await deleteMachine(machine.id);
      toast.success('Machine deleted');
    } catch {
      // Error toast handled by API layer
    }
  };

  const handleEdit = (machine: RemoteMachine) => {
    setEditMachine(machine);
    setIsAddModalOpen(true);
  };

  const handleToggleForwardCredentials = async (machine: RemoteMachine) => {
    try {
      await updateMachine(machine.id, { forwardCredentials: !machine.forwardCredentials });
    } catch {
      // Error toast handled by API layer
    }
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditMachine(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="pt-4 mt-4 border-t border-surface-600">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
          Remote Machines
        </h3>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
        >
          <Icons.plus />
          Add Machine
        </button>
      </div>

      <p className="text-xs text-theme-muted mb-3">
        Run Claude Code sessions on remote machines via SSH. Port forwards are automatically created when dev servers start.
      </p>

      {/* Expandable macOS Setup Guide */}
      <div className="bg-surface-800 border border-surface-600 rounded-lg mb-3 overflow-hidden">
        <button
          onClick={() => setIsHelpExpanded(!isHelpExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-700 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs text-theme-muted">
            <Icons.help />
            <span className="font-medium">macOS Setup Guide</span>
          </div>
          <span className={`text-theme-dim transition-transform ${isHelpExpanded ? 'rotate-180' : ''}`}>
            <Icons.chevronDown />
          </span>
        </button>

        {isHelpExpanded && (
          <div className="px-3 pb-3 border-t border-surface-600 text-xs">
            <div className="mt-3 space-y-3">
              <div>
                <p className="font-medium text-theme-muted mb-1">Prerequisites</p>
                <ul className="list-disc list-inside text-theme-dim space-y-0.5 ml-1">
                  <li>Both machines on Tailscale (recommended) or same local network</li>
                  <li>Claude Code installed on the remote Mac</li>
                  <li>Remote Login enabled on the remote Mac</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-theme-muted mb-1">1. Enable Remote Login on the remote Mac</p>
                <p className="text-theme-dim mb-1">On the Mac you want to connect <strong className="text-theme-muted">to</strong>:</p>
                <code className="block bg-surface-900 border border-surface-600 rounded px-2 py-1.5 text-state-working font-mono text-[11px]">
                  System Settings → General → Sharing → Remote Login → On
                </code>
              </div>

              <div>
                <p className="font-medium text-theme-muted mb-1">2. Copy your SSH key to the remote Mac</p>
                <p className="text-theme-dim mb-1">On the Mac you're connecting <strong className="text-theme-muted">from</strong> (where Yojimbo runs):</p>
                <code className="block bg-surface-900 border border-surface-600 rounded px-2 py-1.5 text-state-working font-mono text-[11px]">
                  ssh-copy-id username@hostname
                </code>
                <p className="text-theme-dim mt-1">
                  Replace <code className="bg-surface-700 px-1 rounded text-amber-400">username</code> with the remote Mac's login and{' '}
                  <code className="bg-surface-700 px-1 rounded text-amber-400">hostname</code> with its Tailscale name.
                </p>
              </div>

              <div>
                <p className="font-medium text-theme-muted mb-1">3. Test the connection</p>
                <code className="block bg-surface-900 border border-surface-600 rounded px-2 py-1.5 text-state-working font-mono text-[11px]">
                  ssh username@hostname "echo 'Connection successful!'"
                </code>
              </div>

              <div>
                <p className="font-medium text-theme-muted mb-1">4. Add the machine in Yojimbo</p>
                <p className="text-theme-dim">Click "Add Machine" and enter the hostname and username.</p>
              </div>

              <div className="bg-blue-950/50 border border-blue-800/50 rounded p-2 mt-2">
                <p className="text-blue-300">
                  <strong>💡 Tip:</strong> Run <code className="bg-surface-700 px-1 rounded text-theme-muted">whoami</code> in Terminal on the remote Mac to find the exact username.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {machines.length === 0 ? (
        <div className="bg-surface-800 border border-surface-600 rounded-lg p-4 text-center">
          <Icons.server />
          <p className="text-sm text-theme-muted mt-2">No remote machines configured</p>
          <p className="text-xs text-theme-dim mt-1 mb-3">
            Follow the setup guide above, then add your first machine.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Add your first machine
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {machines.map((machine) => (
            <div
              key={machine.id}
              className="bg-surface-800 border border-surface-600 rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusIndicator status={machine.status} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-theme-primary truncate">
                      {machine.name}
                    </div>
                    <code className="text-xs text-theme-muted font-mono">
                      {machine.username}@{machine.hostname}:{machine.port}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleTestConnection(machine.id)}
                    disabled={testingIds.has(machine.id)}
                    className="px-2 py-0.5 text-xs text-theme-muted hover:text-theme-primary border border-surface-500 hover:border-surface-400 rounded transition-colors disabled:opacity-50"
                    title="Test SSH connection"
                  >
                    {testingIds.has(machine.id) ? (
                      <Spinner size="sm" />
                    ) : (
                      'Test'
                    )}
                  </button>
                  <button
                    onClick={() => handleUnlockKeychain(machine.id, machine.name)}
                    disabled={unlockingKeychainIds.has(machine.id)}
                    className="px-2 py-0.5 text-xs text-theme-muted hover:text-theme-primary border border-surface-500 hover:border-surface-400 rounded transition-colors disabled:opacity-50"
                    title="Unlock keychain on remote machine (for Claude Code)"
                  >
                    {unlockingKeychainIds.has(machine.id) ? (
                      <Spinner size="sm" />
                    ) : (
                      'Unlock'
                    )}
                  </button>
                  <button
                    onClick={() => handleTestTunnel(machine.id)}
                    disabled={testingTunnelIds.has(machine.id)}
                    className="px-2 py-0.5 text-xs text-theme-muted hover:text-theme-primary border border-surface-500 hover:border-surface-400 rounded transition-colors disabled:opacity-50"
                    title="Test reverse tunnel (for hooks)"
                  >
                    {testingTunnelIds.has(machine.id) ? (
                      <Spinner size="sm" />
                    ) : (
                      'Tunnel'
                    )}
                  </button>
                  <button
                    onClick={() => handleInstallHooks(machine.id)}
                    disabled={installingHooksIds.has(machine.id)}
                    className="px-2 py-0.5 text-xs text-theme-muted hover:text-theme-primary border border-surface-500 hover:border-surface-400 rounded transition-colors disabled:opacity-50"
                    title="Install Claude Code hooks on remote machine"
                  >
                    {installingHooksIds.has(machine.id) ? (
                      <Spinner size="sm" />
                    ) : (
                      'Hooks'
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(machine)}
                    className="p-1 text-theme-muted hover:text-theme-primary transition-colors"
                    title="Edit"
                  >
                    <Icons.edit />
                  </button>
                  <button
                    onClick={() => handleDeleteMachine(machine)}
                    className="p-1 text-theme-muted hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Icons.trash />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-600">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-theme-muted">
                  <input
                    type="checkbox"
                    checked={machine.forwardCredentials}
                    onChange={() => handleToggleForwardCredentials(machine)}
                    className="w-3.5 h-3.5 rounded border-surface-500 bg-surface-700 text-accent focus:ring-accent focus:ring-offset-0"
                  />
                  Forward local credentials
                </label>
                {machine.lastConnectedAt && (
                  <span className="text-[10px] text-theme-dim">
                    Last connected: {new Date(machine.lastConnectedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-theme-dim mt-3 px-1">
            To use: Create a new session and select "Remote" → choose a machine. Dev server ports are automatically forwarded to localhost.
          </p>
        </div>
      )}

      <AddMachineModal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        sshKeys={sshKeys}
        onSave={createMachine}
        editMachine={editMachine}
        onUpdate={updateMachine}
      />
    </div>
  );
}
