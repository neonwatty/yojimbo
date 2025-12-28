import { useNavigate } from 'react-router-dom';
import { useInstancesStore } from '../store/instancesStore';
import { useSettingsStore } from '../store/settingsStore';
import { useUIStore } from '../store/uiStore';
import { Icons } from '../components/common/Icons';

export default function HomePage() {
  const navigate = useNavigate();

  // Use selectors for better performance
  const instances = useInstancesStore((state) => state.instances);
  const showWelcomeBanner = useSettingsStore((state) => state.showWelcomeBanner);
  const setShowWelcomeBanner = useSettingsStore((state) => state.setShowWelcomeBanner);
  const setShowNewInstanceModal = useUIStore((state) => state.setShowNewInstanceModal);

  const stats = [
    { label: 'Total', value: instances.length, colorClass: 'text-accent border-accent/30' },
    { label: 'Working', value: instances.filter((i) => i.status === 'working').length, colorClass: 'text-state-working border-state-working/30' },
    { label: 'Awaiting', value: instances.filter((i) => i.status === 'awaiting').length, colorClass: 'text-state-awaiting border-state-awaiting/30' },
    { label: 'Errors', value: instances.filter((i) => i.status === 'error').length, colorClass: 'text-state-error border-state-error/30' },
  ];

  const pinnedInstances = instances.filter((i) => i.isPinned);
  const recentInstances = instances.filter((i) => !i.isPinned).slice(0, 5);

  const handleNewInstance = () => {
    setShowNewInstanceModal(true);
  };

  return (
    <div className="flex-1 overflow-auto bg-surface-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Getting Started Banner */}
        {showWelcomeBanner && (
          <div className="bg-accent/10 border border-accent/20 rounded p-4 mb-4 animate-reveal-up">
            <div className="flex justify-between items-start mb-3">
              <h2 className="text-sm font-medium text-theme-primary">Getting Started</h2>
              <button
                onClick={() => setShowWelcomeBanner(false)}
                className="text-theme-dim hover:text-theme-primary transition-colors p-0.5"
              >
                <Icons.close />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              {[
                { num: 1, title: 'Create session', desc: 'Click + to start a new terminal' },
                { num: 2, title: 'Navigate', desc: 'cd into your project directory' },
                { num: 3, title: 'Start Claude', desc: "Run 'claude' to begin" },
                { num: 4, title: 'Manage', desc: 'Pin, rename, switch sessions' },
              ].map((step) => (
                <div key={step.num} className="flex flex-col">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-accent text-xs font-medium">{step.num}.</span>
                    <span className="text-xs font-medium text-theme-primary">{step.title}</span>
                  </div>
                  <p className="text-[10px] text-theme-dim">{step.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-theme-dim">
              <kbd className="px-1 py-0.5 rounded bg-surface-700 text-theme-secondary font-mono">⌘K</kbd>
              {' '}command palette &middot;{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface-700 text-theme-secondary font-mono">⌘/</kbd>
              {' '}shortcuts
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`animate-reveal-up bg-surface-700 rounded p-3 border ${stat.colorClass}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className={`text-2xl font-bold ${stat.colorClass.split(' ')[0]}`}>
                {stat.value}
              </div>
              <div className="text-[10px] text-theme-dim mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleNewInstance}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-surface-900 text-xs font-medium rounded hover:bg-accent-bright transition-colors"
          >
            <Icons.plus />
            New Session
          </button>
          <button
            onClick={() => navigate('/instances')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 text-theme-primary text-xs font-medium rounded hover:bg-surface-600 transition-colors"
          >
            View All
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Pinned Instances */}
        {pinnedInstances.length > 0 && (
          <div className="mb-4">
            <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-theme-dim mb-2">
              <span className="text-accent">★</span> Pinned
            </h3>
            <div className="bg-surface-700 rounded overflow-hidden divide-y divide-surface-600">
              {pinnedInstances.map((instance) => (
                <div
                  key={instance.id}
                  onClick={() => navigate(`/instances/${instance.id}`)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-surface-600 cursor-pointer transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full bg-state-${instance.status}`} />
                  <span className="text-accent text-xs">★</span>
                  <span className="text-xs font-medium text-theme-primary flex-1">{instance.name}</span>
                  <span className="text-[10px] text-theme-dim font-mono hidden sm:block">{instance.workingDir}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Instances */}
        {recentInstances.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[10px] uppercase tracking-wider text-theme-dim mb-2">Recent</h3>
            <div className="bg-surface-700 rounded overflow-hidden divide-y divide-surface-600">
              {recentInstances.map((instance) => (
                <div
                  key={instance.id}
                  onClick={() => navigate(`/instances/${instance.id}`)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-surface-600 cursor-pointer transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full bg-state-${instance.status}`} />
                  <span className="text-xs font-medium text-theme-primary flex-1">{instance.name}</span>
                  <span className="text-[10px] text-theme-dim font-mono hidden sm:block">{instance.workingDir}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {instances.length === 0 && (
          <div className="text-center py-8">
            <div className="text-theme-dim mb-2">
              <Icons.terminal />
            </div>
            <h3 className="text-sm font-medium text-theme-primary mb-1">No sessions yet</h3>
            <p className="text-xs text-theme-dim mb-3">Create your first Claude Code session.</p>
            <button
              onClick={handleNewInstance}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-surface-900 text-xs font-medium rounded hover:bg-accent-bright transition-colors"
            >
              <Icons.plus />
              New Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
