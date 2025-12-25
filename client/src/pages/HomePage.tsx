import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstancesStore } from '../store/instancesStore';
import { useSettingsStore } from '../store/settingsStore';
import { instancesApi } from '../api/client';
import { toast } from '../store/toastStore';
import { Icons } from '../components/common/Icons';
import { Spinner } from '../components/common/Spinner';

export default function HomePage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  // Use selectors for better performance
  const instances = useInstancesStore((state) => state.instances);
  const showWelcomeBanner = useSettingsStore((state) => state.showWelcomeBanner);
  const setShowWelcomeBanner = useSettingsStore((state) => state.setShowWelcomeBanner);

  const stats = [
    { label: 'Total', value: instances.length, colorClass: 'text-accent border-accent/30' },
    { label: 'Working', value: instances.filter((i) => i.status === 'working').length, colorClass: 'text-state-working border-state-working/30' },
    { label: 'Awaiting', value: instances.filter((i) => i.status === 'awaiting').length, colorClass: 'text-state-awaiting border-state-awaiting/30' },
    { label: 'Errors', value: instances.filter((i) => i.status === 'error').length, colorClass: 'text-state-error border-state-error/30' },
  ];

  const pinnedInstances = instances.filter((i) => i.isPinned);
  const recentInstances = instances.filter((i) => !i.isPinned).slice(0, 5);

  const handleNewInstance = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const response = await instancesApi.create({
        name: `instance-${instances.length + 1}`,
        workingDir: '~',
      });
      if (response.data) {
        toast.success('Instance created');
        navigate(`/instances/${response.data.id}`);
      }
    } catch {
      // Error toast shown by API layer
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-surface-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Getting Started Banner */}
        {showWelcomeBanner && (
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-6 mb-6 animate-reveal-up">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold text-theme-primary">Getting Started with Yojimbo</h2>
              <button
                onClick={() => setShowWelcomeBanner(false)}
                className="text-theme-muted hover:text-theme-primary transition-colors p-1"
              >
                <Icons.close />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[
                { num: 1, title: 'Create an instance', desc: 'Click + to start a new terminal' },
                { num: 2, title: 'Navigate to project', desc: 'cd into your project directory' },
                { num: 3, title: 'Start Claude Code', desc: "Run 'claude' to begin coding" },
                { num: 4, title: 'Manage from here', desc: 'Pin, rename, and switch instances' },
              ].map((step) => (
                <div key={step.num} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-accent font-bold">{step.num}.</span>
                    <span className="font-medium text-theme-primary">{step.title}</span>
                  </div>
                  <p className="text-sm text-theme-muted font-light">{step.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-theme-muted">
              <kbd className="px-1.5 py-0.5 rounded bg-surface-700 text-theme-secondary font-mono text-xs">⌘K</kbd>
              {' '}to open command palette &middot;{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-surface-700 text-theme-secondary font-mono text-xs">⌘/</kbd>
              {' '}to view all shortcuts
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`animate-reveal-up bg-surface-700 rounded-xl p-4 border ${stat.colorClass}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className={`text-5xl font-extrabold tracking-tight ${stat.colorClass.split(' ')[0]}`}>
                {stat.value}
              </div>
              <div className="text-sm text-theme-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleNewInstance}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-surface-900 font-medium rounded-lg hover:bg-accent-bright transition-colors hover-lift press-effect disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent"
          >
            {isCreating ? <Spinner size="sm" /> : <Icons.plus />}
            {isCreating ? 'Creating...' : 'New Instance'}
          </button>
          <button
            onClick={() => navigate('/instances')}
            className="flex items-center gap-2 px-4 py-2 bg-surface-700 text-theme-primary font-medium rounded-lg hover:bg-surface-600 transition-colors hover-lift press-effect"
          >
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Pinned Instances */}
        {pinnedInstances.length > 0 && (
          <div className="mb-6">
            <h3 className="flex items-center gap-2 text-xs font-medium tracking-widest uppercase text-theme-muted mb-3">
              <span className="text-accent">★</span> Pinned Instances
            </h3>
            <div className="bg-surface-700 rounded-xl overflow-hidden divide-y divide-surface-600">
              {pinnedInstances.map((instance) => (
                <div
                  key={instance.id}
                  onClick={() => navigate(`/instances/${instance.id}`)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-600 cursor-pointer transition-colors"
                >
                  <span className={`w-3 h-3 rounded-full bg-state-${instance.status}`} />
                  <span className="text-accent">★</span>
                  <span className="font-medium text-theme-primary flex-1">{instance.name}</span>
                  <span className="text-xs text-theme-muted font-mono hidden sm:block">{instance.workingDir}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Instances */}
        {recentInstances.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-medium tracking-widest uppercase text-theme-muted mb-3">Recent Instances</h3>
            <div className="bg-surface-700 rounded-xl overflow-hidden divide-y divide-surface-600">
              {recentInstances.map((instance) => (
                <div
                  key={instance.id}
                  onClick={() => navigate(`/instances/${instance.id}`)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-600 cursor-pointer transition-colors"
                >
                  <span className={`w-3 h-3 rounded-full bg-state-${instance.status}`} />
                  <span className="font-medium text-theme-primary flex-1">{instance.name}</span>
                  <span className="text-xs text-theme-muted font-mono hidden sm:block">{instance.workingDir}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {instances.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-xl font-semibold text-theme-primary mb-2">No instances yet</h3>
            <p className="text-theme-muted mb-4">Create your first Claude Code instance to get started.</p>
            <button
              onClick={handleNewInstance}
              disabled={isCreating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-surface-900 font-medium rounded-lg hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? <Spinner size="sm" /> : <Icons.plus />}
              {isCreating ? 'Creating...' : 'Create Instance'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
