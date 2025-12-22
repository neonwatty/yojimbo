import { Link } from 'react-router-dom';
import { useInstances } from '../hooks/use-instances';

export function HomePage() {
  const { data: instances = [], isLoading } = useInstances();

  const workingCount = instances.filter((i) => i.status === 'working').length;
  const awaitingCount = instances.filter((i) => i.status === 'awaiting').length;
  const idleCount = instances.filter((i) => i.status === 'idle').length;
  const pinnedInstances = instances.filter((i) => i.pinned);
  const recentInstances = instances.slice(0, 5);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Instances" value={instances.length} loading={isLoading} />
        <StatCard
          label="Working"
          value={workingCount}
          color="cyan"
          loading={isLoading}
        />
        <StatCard
          label="Awaiting Input"
          value={awaitingCount}
          color="amber"
          loading={isLoading}
        />
        <StatCard label="Idle" value={idleCount} color="gray" loading={isLoading} />
      </div>

      {/* Quick actions */}
      <div className="flex gap-4 mb-8">
        <Link
          to="/instances"
          className="px-4 py-2 bg-accent hover:bg-accent-bright text-black font-medium rounded-lg transition-colors"
        >
          View All Instances
        </Link>
        <Link
          to="/instances?action=new"
          className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-theme-primary font-medium rounded-lg transition-colors"
        >
          New Instance
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pinned instances */}
        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Pinned Instances</h2>
          <div className="bg-surface-800 rounded-xl border border-surface-600 overflow-hidden">
            {isLoading ? (
              <div className="p-4 text-theme-muted">Loading...</div>
            ) : pinnedInstances.length === 0 ? (
              <div className="p-4 text-theme-muted">No pinned instances</div>
            ) : (
              <ul className="divide-y divide-surface-600">
                {pinnedInstances.map((instance) => (
                  <InstanceRow key={instance.id} instance={instance} />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Recent instances */}
        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Recent Instances</h2>
          <div className="bg-surface-800 rounded-xl border border-surface-600 overflow-hidden">
            {isLoading ? (
              <div className="p-4 text-theme-muted">Loading...</div>
            ) : recentInstances.length === 0 ? (
              <div className="p-4 text-theme-muted">No instances yet</div>
            ) : (
              <ul className="divide-y divide-surface-600">
                {recentInstances.map((instance) => (
                  <InstanceRow key={instance.id} instance={instance} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: number;
  color?: 'cyan' | 'amber' | 'gray';
  loading?: boolean;
}) {
  const colorClasses = {
    cyan: 'text-state-working',
    amber: 'text-state-awaiting',
    gray: 'text-state-idle',
  };

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
      <div className="text-theme-muted text-sm mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color ? colorClasses[color] : 'text-theme-primary'}`}>
        {loading ? '-' : value}
      </div>
    </div>
  );
}

function InstanceRow({ instance }: { instance: { id: string; name: string; status: string; workingDir: string } }) {
  const statusColors = {
    working: 'bg-state-working',
    awaiting: 'bg-state-awaiting',
    idle: 'bg-state-idle',
    error: 'bg-state-error',
  };

  return (
    <li>
      <Link
        to={`/instances?id=${instance.id}`}
        className="flex items-center gap-3 p-4 hover:bg-surface-700 transition-colors"
      >
        <span
          className={`w-3 h-3 rounded-full ${statusColors[instance.status as keyof typeof statusColors] || statusColors.idle}`}
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-theme-primary truncate">{instance.name}</div>
          <div className="text-sm text-theme-muted truncate">{instance.workingDir}</div>
        </div>
      </Link>
    </li>
  );
}
