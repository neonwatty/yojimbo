import { useEffect, useState } from 'react';
import { Icons } from '../common/Icons';
import { toast } from '../../store/toastStore';
import type { SSHKey, RemoteMachine } from '@cc-orchestrator/shared';

interface AddMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  sshKeys: SSHKey[];
  onSave: (data: {
    name: string;
    hostname: string;
    port: number;
    username: string;
    sshKeyPath?: string;
  }) => Promise<RemoteMachine>;
  editMachine?: RemoteMachine | null;
  onUpdate?: (
    id: string,
    data: { name?: string; hostname?: string; port?: number; username?: string; sshKeyPath?: string }
  ) => Promise<RemoteMachine>;
}

export function AddMachineModal({
  isOpen,
  onClose,
  sshKeys,
  onSave,
  editMachine,
  onUpdate,
}: AddMachineModalProps) {
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [sshKeyPath, setSSHKeyPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when opening/closing or editing different machine
  useEffect(() => {
    if (isOpen) {
      if (editMachine) {
        setName(editMachine.name);
        setHostname(editMachine.hostname);
        setPort(editMachine.port);
        setUsername(editMachine.username);
        setSSHKeyPath(editMachine.sshKeyPath || '');
      } else {
        setName('');
        setHostname('');
        setPort(22);
        setUsername('');
        setSSHKeyPath('');
      }
    }
  }, [isOpen, editMachine]);

  const handleSubmit = async () => {
    if (!name.trim() || !hostname.trim() || !username.trim()) {
      toast.error('Name, hostname, and username are required');
      return;
    }

    setIsSaving(true);
    try {
      if (editMachine && onUpdate) {
        await onUpdate(editMachine.id, {
          name: name.trim(),
          hostname: hostname.trim(),
          port,
          username: username.trim(),
          sshKeyPath: sshKeyPath || undefined,
        });
        toast.success('Machine updated');
      } else {
        await onSave({
          name: name.trim(),
          hostname: hostname.trim(),
          port,
          username: username.trim(),
          sshKeyPath: sshKeyPath || undefined,
        });
        toast.success('Machine added');
      }
      onClose();
    } catch {
      // Error toast handled by API layer
    } finally {
      setIsSaving(false);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-surface-700 rounded-xl shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-600">
          <h2 className="text-sm font-medium text-theme-primary">
            {editMachine ? 'Edit Machine' : 'Add Remote Machine'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-theme-dim hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            <Icons.close />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3">
          {!editMachine && (
            <div className="bg-surface-800 border border-surface-600 rounded p-2.5 text-xs text-theme-dim">
              <p className="flex items-start gap-2">
                <Icons.alertCircle />
                <span>Ensure Claude Code is installed on the remote machine and SSH key authentication is configured.</span>
              </p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs text-theme-dim mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mac Mini 1"
              className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-1.5 text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-1 focus:ring-frost-4/50"
              autoFocus
            />
          </div>

          {/* Hostname */}
          <div>
            <label className="block text-xs text-theme-dim mb-1">Hostname / IP</label>
            <input
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="192.168.1.100 or mac-mini.local"
              className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-1.5 text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-1 focus:ring-frost-4/50"
            />
          </div>

          {/* Port */}
          <div>
            <label className="block text-xs text-theme-dim mb-1">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 22)}
              min={1}
              max={65535}
              className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-1 focus:ring-frost-4/50"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs text-theme-dim mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user"
              className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-1.5 text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-1 focus:ring-frost-4/50"
            />
          </div>

          {/* SSH Key */}
          <div>
            <label className="block text-xs text-theme-dim mb-1">SSH Key</label>
            <select
              value={sshKeyPath}
              onChange={(e) => setSSHKeyPath(e.target.value)}
              className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-1 focus:ring-frost-4/50"
            >
              <option value="">Auto-detect (default keys)</option>
              {sshKeys.map((key) => (
                <option key={key.path} value={key.path}>
                  {key.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-theme-dim mt-1">
              Will try id_ed25519, id_rsa, id_ecdsa if not specified
            </p>
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
            onClick={handleSubmit}
            disabled={isSaving || !name.trim() || !hostname.trim() || !username.trim()}
            className="px-3 py-1.5 rounded text-xs font-medium bg-accent text-surface-900 hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : editMachine ? 'Save Changes' : 'Add Machine'}
          </button>
        </div>
      </div>
    </div>
  );
}
