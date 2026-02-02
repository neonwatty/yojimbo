import { useState, useEffect, useCallback } from 'react';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';
import { useMachines } from '../../hooks/useMachines';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getWsUrl } from '../../config';
import { machinesApi, keychainApi } from '../../api/client';
import { toast } from '../../store/toastStore';
import type {
  RemoteMachine,
  PreflightResult,
  PreflightCheckResult,
  TunnelHealthState,
} from '@cc-orchestrator/shared';

interface MachineHealthState {
  loading: boolean;
  sshStatus: 'online' | 'offline' | 'unknown';
  tunnelStatus: {
    active: boolean;
    healthState?: TunnelHealthState;
    message?: string;
  } | null;
  hooksStatus: {
    installed: boolean;
    hookTypes: string[];
    error?: string;
  } | null;
  keychainStatus: {
    hasPassword: boolean;
    unlocked: boolean;
    verified?: boolean;
  } | null;
  preflightResult: PreflightResult | null;
}

function StatusBadge({ status, label }: { status: 'success' | 'warning' | 'error' | 'unknown'; label: string }) {
  const colors = {
    success: 'bg-state-working/20 text-state-working border-state-working/30',
    warning: 'bg-aurora-3/20 text-aurora-3 border-aurora-3/30',
    error: 'bg-state-error/20 text-state-error border-state-error/30',
    unknown: 'bg-surface-500/20 text-theme-dim border-surface-500/30',
  };

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[status]}`}>
      {label}
    </span>
  );
}

function CheckResultRow({ check }: { check: PreflightCheckResult }) {
  const statusColors = {
    pass: 'text-state-working',
    fail: 'text-state-error',
    warn: 'text-aurora-3',
    skip: 'text-theme-dim',
  };

  const statusIcons = {
    pass: <Icons.check />,
    fail: <Icons.x />,
    warn: <Icons.alertCircle />,
    skip: <Icons.minus />,
  };

  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className={`mt-0.5 ${statusColors[check.status]}`}>
        {statusIcons[check.status]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-theme-muted font-medium">{check.name}</span>
        </div>
        <p className="text-theme-dim truncate">{check.message}</p>
        {check.details && (
          <p className="text-theme-dim/60 text-[10px] truncate">{check.details}</p>
        )}
      </div>
    </div>
  );
}

function MachineHealthCard({
  machine,
  healthState,
  onRefresh,
  onRunPreflight,
}: {
  machine: RemoteMachine;
  healthState: MachineHealthState;
  onRefresh: () => void;
  onRunPreflight: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getOverallStatus = (): 'success' | 'warning' | 'error' | 'unknown' => {
    if (healthState.loading) return 'unknown';
    if (healthState.sshStatus === 'offline') return 'error';
    if (!healthState.tunnelStatus?.active) return 'warning';
    if (!healthState.hooksStatus?.installed) return 'warning';
    if (!healthState.keychainStatus?.unlocked) return 'warning';
    if (healthState.preflightResult?.overall === 'not_ready') return 'error';
    if (healthState.preflightResult?.overall === 'warnings') return 'warning';
    return 'success';
  };

  const overallStatus = getOverallStatus();

  const statusLabels = {
    success: 'Ready',
    warning: 'Needs Attention',
    error: 'Not Ready',
    unknown: 'Checking...',
  };

  return (
    <div className="bg-surface-800 border border-surface-600 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-surface-700 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              overallStatus === 'success'
                ? 'bg-state-working'
                : overallStatus === 'warning'
                ? 'bg-aurora-3'
                : overallStatus === 'error'
                ? 'bg-state-error'
                : 'bg-surface-400 animate-pulse'
            }`}
          />
          <div className="min-w-0 text-left">
            <div className="text-sm font-medium text-theme-primary truncate">
              {machine.name}
            </div>
            <code className="text-[10px] text-theme-muted font-mono">
              {machine.username}@{machine.hostname}
            </code>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={overallStatus} label={statusLabels[overallStatus]} />
          <span className={`text-theme-dim transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <Icons.chevronDown />
          </span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-surface-600 p-3 space-y-3">
          {/* Quick Status Row */}
          <div className="flex flex-wrap gap-2">
            {/* SSH Status */}
            <StatusBadge
              status={
                healthState.sshStatus === 'online'
                  ? 'success'
                  : healthState.sshStatus === 'offline'
                  ? 'error'
                  : 'unknown'
              }
              label={`SSH: ${healthState.sshStatus}`}
            />

            {/* Tunnel Status */}
            {healthState.tunnelStatus && (
              <StatusBadge
                status={
                  healthState.tunnelStatus.healthState === 'healthy'
                    ? 'success'
                    : healthState.tunnelStatus.healthState === 'degraded'
                    ? 'warning'
                    : healthState.tunnelStatus.active
                    ? 'success'
                    : 'error'
                }
                label={`Tunnel: ${
                  healthState.tunnelStatus.healthState || (healthState.tunnelStatus.active ? 'Active' : 'Inactive')
                }`}
              />
            )}

            {/* Hooks Status */}
            {healthState.hooksStatus && (
              <StatusBadge
                status={healthState.hooksStatus.installed ? 'success' : 'warning'}
                label={`Hooks: ${healthState.hooksStatus.installed ? 'Installed' : 'Missing'}`}
              />
            )}

            {/* Keychain Status */}
            {healthState.keychainStatus && (
              <StatusBadge
                status={
                  healthState.keychainStatus.unlocked
                    ? 'success'
                    : healthState.keychainStatus.hasPassword
                    ? 'warning'
                    : 'error'
                }
                label={`Keychain: ${
                  healthState.keychainStatus.unlocked
                    ? 'Unlocked'
                    : healthState.keychainStatus.hasPassword
                    ? 'Locked'
                    : 'No Password'
                }`}
              />
            )}
          </div>

          {/* Preflight Results */}
          {healthState.preflightResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-theme-muted">
                  Preflight Checks
                </span>
                <span className="text-[10px] text-theme-dim">
                  {healthState.preflightResult.summary.passed}/{healthState.preflightResult.checks.length} passed
                </span>
              </div>
              <div className="space-y-1.5 pl-1">
                {healthState.preflightResult.checks.map((check, idx) => (
                  <CheckResultRow key={idx} check={check} />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-surface-600">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={healthState.loading}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-theme-muted hover:text-theme-primary border border-surface-500 hover:border-surface-400 rounded transition-colors disabled:opacity-50"
            >
              {healthState.loading ? (
                <Spinner size="sm" />
              ) : (
                <Icons.refresh />
              )}
              Refresh
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRunPreflight();
              }}
              disabled={healthState.loading}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-theme-muted hover:text-theme-primary border border-surface-500 hover:border-surface-400 rounded transition-colors disabled:opacity-50"
            >
              <Icons.play />
              Run Preflight
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MachineHealthDashboard() {
  const { machines, loading: machinesLoading } = useMachines();
  const { subscribe, isConnected } = useWebSocket(getWsUrl());
  const [healthStates, setHealthStates] = useState<Record<string, MachineHealthState>>({});
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // Initialize health state for a machine
  const initializeHealthState = useCallback((): MachineHealthState => ({
    loading: false,
    sshStatus: 'unknown',
    tunnelStatus: null,
    hooksStatus: null,
    keychainStatus: null,
    preflightResult: null,
  }), []);

  // Fetch health data for a single machine
  const fetchMachineHealth = useCallback(async (machine: RemoteMachine) => {
    setHealthStates((prev) => ({
      ...prev,
      [machine.id]: {
        ...(prev[machine.id] || initializeHealthState()),
        loading: true,
      },
    }));

    try {
      // Run all health checks in parallel
      const [tunnelRes, hooksRes, keychainRes, passwordRes] = await Promise.allSettled([
        machinesApi.testTunnel(machine.id),
        machinesApi.checkHooksStatus(machine.id),
        machinesApi.getKeychainStatus(machine.id),
        keychainApi.hasRemotePassword(machine.id),
      ]);

      setHealthStates((prev) => ({
        ...prev,
        [machine.id]: {
          loading: false,
          sshStatus: machine.status,
          tunnelStatus:
            tunnelRes.status === 'fulfilled' && tunnelRes.value.data
              ? {
                  active: tunnelRes.value.data.active,
                  message: tunnelRes.value.data.message,
                }
              : null,
          hooksStatus:
            hooksRes.status === 'fulfilled' && hooksRes.value.data
              ? hooksRes.value.data
              : null,
          keychainStatus: {
            hasPassword:
              passwordRes.status === 'fulfilled' && passwordRes.value.data?.hasPassword
                ? true
                : false,
            unlocked:
              keychainRes.status === 'fulfilled' && keychainRes.value.data?.unlocked
                ? true
                : false,
          },
          preflightResult: prev[machine.id]?.preflightResult || null,
        },
      }));
    } catch (error) {
      console.error(`Failed to fetch health for ${machine.name}:`, error);
      setHealthStates((prev) => ({
        ...prev,
        [machine.id]: {
          ...(prev[machine.id] || initializeHealthState()),
          loading: false,
        },
      }));
    }
  }, [initializeHealthState]);

  // Run preflight checks for a machine
  const runPreflight = useCallback(async (machine: RemoteMachine) => {
    setHealthStates((prev) => ({
      ...prev,
      [machine.id]: {
        ...(prev[machine.id] || initializeHealthState()),
        loading: true,
      },
    }));

    try {
      const response = await machinesApi.runPreflight(machine.id);
      const preflightResult = response.data ?? null;
      if (preflightResult) {
        setHealthStates((prev) => ({
          ...prev,
          [machine.id]: {
            ...(prev[machine.id] || initializeHealthState()),
            loading: false,
            preflightResult,
          },
        }));

        if (preflightResult.overall === 'ready') {
          toast.success(`${machine.name}: All preflight checks passed`);
        } else if (preflightResult.overall === 'warnings') {
          toast.info(`${machine.name}: Preflight completed with warnings`);
        } else {
          toast.error(`${machine.name}: Some preflight checks failed`);
        }
      }
    } catch (error) {
      console.error(`Failed to run preflight for ${machine.name}:`, error);
      toast.error(`Failed to run preflight for ${machine.name}`);
      setHealthStates((prev) => ({
        ...prev,
        [machine.id]: {
          ...(prev[machine.id] || initializeHealthState()),
          loading: false,
        },
      }));
    }
  }, [initializeHealthState]);

  // Refresh all machines
  const refreshAll = useCallback(async () => {
    setIsRefreshingAll(true);
    await Promise.all(machines.map((m) => fetchMachineHealth(m)));
    setIsRefreshingAll(false);
  }, [machines, fetchMachineHealth]);

  // Initial load
  useEffect(() => {
    if (!machinesLoading && machines.length > 0) {
      refreshAll();
    }
  }, [machinesLoading, machines.length, refreshAll]);

  // Listen for WebSocket updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubPreflight = subscribe('machine:preflight', (data: unknown) => {
      const { machineId, preflightResult } = data as {
        machineId: string;
        preflightResult: PreflightResult;
      };
      if (machineId && preflightResult) {
        setHealthStates((prev) => ({
          ...prev,
          [machineId]: {
            ...(prev[machineId] || { loading: false, sshStatus: 'unknown', tunnelStatus: null, hooksStatus: null, keychainStatus: null, preflightResult: null }),
            preflightResult,
          },
        }));
      }
    });

    const unsubKeychain = subscribe('keychain:status-change', (data: unknown) => {
      const { machineId, unlocked } = data as { machineId: string; unlocked: boolean };
      if (machineId) {
        setHealthStates((prev) => ({
          ...prev,
          [machineId]: {
            ...(prev[machineId] || { loading: false, sshStatus: 'unknown', tunnelStatus: null, hooksStatus: null, keychainStatus: null, preflightResult: null }),
            keychainStatus: {
              ...(prev[machineId]?.keychainStatus || { hasPassword: false, unlocked: false }),
              unlocked,
            },
          },
        }));
      }
    });

    const unsubTunnel = subscribe('tunnel:state-change', (data: unknown) => {
      const { machineId, newState } = data as { machineId: string; newState: TunnelHealthState };
      if (machineId) {
        setHealthStates((prev) => ({
          ...prev,
          [machineId]: {
            ...(prev[machineId] || { loading: false, sshStatus: 'unknown', tunnelStatus: null, hooksStatus: null, keychainStatus: null, preflightResult: null }),
            tunnelStatus: {
              ...(prev[machineId]?.tunnelStatus || { active: false }),
              active: newState === 'healthy' || newState === 'degraded',
              healthState: newState,
            },
          },
        }));
      }
    });

    return () => {
      unsubPreflight();
      unsubKeychain();
      unsubTunnel();
    };
  }, [isConnected, subscribe]);

  if (machinesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (machines.length === 0) {
    return (
      <div className="bg-surface-800 border border-surface-600 rounded-lg p-4 text-center">
        <Icons.server />
        <p className="text-sm text-theme-muted mt-2">No remote machines configured</p>
        <p className="text-xs text-theme-dim mt-1">
          Add machines in the Remote Machines section to see their health status.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
          Machine Health
        </h3>
        <button
          onClick={refreshAll}
          disabled={isRefreshingAll}
          className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          {isRefreshingAll ? (
            <Spinner size="sm" />
          ) : (
            <Icons.refresh />
          )}
          Refresh All
        </button>
      </div>

      <div className="space-y-2">
        {machines.map((machine) => (
          <MachineHealthCard
            key={machine.id}
            machine={machine}
            healthState={healthStates[machine.id] || initializeHealthState()}
            onRefresh={() => fetchMachineHealth(machine)}
            onRunPreflight={() => runPreflight(machine)}
          />
        ))}
      </div>

      <p className="text-[10px] text-theme-dim mt-2">
        Health dashboard shows real-time status of SSH connections, reverse tunnels, hooks, and keychain state.
      </p>
    </div>
  );
}
