import { useState } from 'react';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';
import { AddMachineModal } from '../modals/AddMachineModal';
import { useMachines } from '../../hooks/useMachines';
import { toast } from '../../store/toastStore';
import type { RemoteMachine, MachineStatus } from '@cc-orchestrator/shared';

function StatusIndicator({ status }: { status: MachineStatus }) {
  const colors = {
    online: 'bg-state-idle',
    offline: 'bg-state-error',
    unknown: 'bg-surface-400',
  };

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]}`} title={status} />
  );
}

export function RemoteMachinesSection() {
  const { machines, sshKeys, loading, createMachine, updateMachine, deleteMachine, testConnection } =
    useMachines();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editMachine, setEditMachine] = useState<RemoteMachine | null>(null);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

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

      {machines.length === 0 ? (
        <div className="bg-surface-800 border border-surface-600 rounded-lg p-4">
          <div className="text-center mb-4">
            <Icons.server />
            <p className="text-sm text-theme-muted mt-2">No remote machines configured</p>
          </div>

          <div className="text-xs text-theme-dim space-y-2 mb-4 bg-surface-900 rounded p-3">
            <p className="font-medium text-theme-muted">Prerequisites:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>SSH key access to the remote machine</li>
              <li>Claude Code installed on the remote machine</li>
              <li>Your SSH key added to ~/.ssh/authorized_keys on remote</li>
            </ul>
          </div>

          <div className="text-center">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs text-accent hover:text-accent/80 transition-colors"
            >
              Add your first machine
            </button>
          </div>
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
                    className="p-1 text-theme-muted hover:text-theme-primary transition-colors disabled:opacity-50"
                    title="Test connection"
                  >
                    {testingIds.has(machine.id) ? (
                      <Spinner size="sm" />
                    ) : (
                      <Icons.wifi />
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
              {machine.lastConnectedAt && (
                <p className="text-[10px] text-theme-dim mt-1">
                  Last connected: {new Date(machine.lastConnectedAt).toLocaleString()}
                </p>
              )}
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
