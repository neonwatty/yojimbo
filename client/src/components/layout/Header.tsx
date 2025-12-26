import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useInstancesStore } from '../../store/instancesStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useFeedStore } from '../../store/feedStore';
import { Icons } from '../common/Icons';
import Tooltip from '../common/Tooltip';
import { ConnectionStatus } from '../common/ConnectionStatus';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  // Use selectors for better performance
  const layout = useUIStore((state) => state.layout);
  const setLayout = useUIStore((state) => state.setLayout);
  const setShowShortcutsModal = useUIStore((state) => state.setShowShortcutsModal);
  const setShowSettingsModal = useUIStore((state) => state.setShowSettingsModal);
  const setShowNewInstanceModal = useUIStore((state) => state.setShowNewInstanceModal);
  const instances = useInstancesStore((state) => state.instances);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const showActivityInNav = useSettingsStore((state) => state.showActivityInNav);
  const unreadCount = useFeedStore((state) => state.stats.unread);

  const pinnedCount = instances.filter((i) => i.isPinned).length;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const isHistoryView = location.pathname === '/history';
  const isActivityView = location.pathname === '/activity';

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-surface-800 border-b border-surface-600">
      <div className="flex items-center gap-4">
        <h1
          className="text-xl font-bold tracking-tight text-theme-primary cursor-pointer hover:text-accent transition-colors"
          onClick={() => navigate('/')}
          title="Go to Home"
        >
          <span className="text-accent font-extrabold">Yo</span>jimbo
        </h1>
        <div className="flex items-center gap-3">
          <div className="text-xs text-theme-muted font-mono">
            {instances.length} {instances.length === 1 ? 'instance' : 'instances'}
            {pinnedCount > 0 && (
              <span className="ml-2 text-accent">({pinnedCount} pinned)</span>
            )}
          </div>
          <ConnectionStatus />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* New Instance Button */}
        <Tooltip text="New Instance (⌘N)" position="bottom">
          <button
            onClick={() => setShowNewInstanceModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            <Icons.plus />
            <span className="hidden sm:inline">New</span>
          </button>
        </Tooltip>

        {/* History Button */}
        <Tooltip text={isHistoryView ? 'Close history' : 'View history'} position="bottom">
          <button
            onClick={() => navigate(isHistoryView ? '/instances' : '/history')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${isHistoryView
                ? 'bg-accent text-surface-900'
                : 'text-theme-muted hover:text-theme-primary hover:bg-surface-700'}`}
          >
            <Icons.history />
            <span className="hidden sm:inline">History</span>
          </button>
        </Tooltip>

        {/* Activity Button */}
        {showActivityInNav && (
          <Tooltip text={isActivityView ? 'Close activity' : 'View activity'} position="bottom">
            <button
              onClick={() => navigate(isActivityView ? '/instances' : '/activity')}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${isActivityView
                  ? 'bg-accent text-surface-900'
                  : 'text-theme-muted hover:text-theme-primary hover:bg-surface-700'}`}
            >
              <Icons.activity />
              <span className="hidden sm:inline">Activity</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-bold bg-accent text-white rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </Tooltip>
        )}

        {/* Layout Switcher */}
        <div className="flex items-center gap-1 bg-surface-700 rounded-lg p-1" role="group" aria-label="View layout">
          <button
            onClick={() => {
              setLayout('cards');
              navigate('/instances');
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${layout === 'cards' ? 'bg-surface-500 text-theme-primary' : 'text-theme-muted hover:text-theme-primary'}`}
            title="Cards"
            aria-label="Card layout"
            aria-pressed={layout === 'cards'}
          >
            ⊟
          </button>
          <button
            onClick={() => {
              setLayout('list');
              navigate('/instances');
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${layout === 'list' ? 'bg-surface-500 text-theme-primary' : 'text-theme-muted hover:text-theme-primary'}`}
            title="List"
            aria-label="List layout"
            aria-pressed={layout === 'list'}
          >
            ☰
          </button>
        </div>

        {/* Theme Toggle */}
        <Tooltip text={isDark ? 'Light mode' : 'Dark mode'} position="bottom">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Icons.sun /> : <Icons.moon />}
          </button>
        </Tooltip>

        {/* Settings */}
        <Tooltip text="Settings (⌘,)" position="bottom">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
            aria-label="Open settings"
          >
            <Icons.settings />
          </button>
        </Tooltip>

        {/* Keyboard Shortcuts */}
        <Tooltip text="Keyboard shortcuts (⌘?)" position="bottom">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
            aria-label="View keyboard shortcuts"
          >
            <Icons.help />
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
