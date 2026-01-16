import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Settings, ClaudeCodeAlias, InstanceMode, ActivityEventType } from '@cc-orchestrator/shared';

interface SettingsState extends Settings {
  // Existing setters
  setTheme: (theme: Settings['theme']) => void;
  setTerminalFontSize: (size: number) => void;
  setTerminalFontFamily: (family: string) => void;
  setShowWelcomeBanner: (show: boolean) => void;
  updateSettings: (settings: Partial<Settings>) => void;

  // Claude Code alias management
  addAlias: (name: string, command: string) => void;
  updateAlias: (id: string, updates: Partial<Omit<ClaudeCodeAlias, 'id'>>) => void;
  removeAlias: (id: string) => void;
  setDefaultAlias: (id: string) => void;
  getDefaultAlias: () => ClaudeCodeAlias | undefined;

  // Instance creation preferences
  setLastUsedDirectory: (dir: string) => void;
  setLastInstanceMode: (mode: InstanceMode) => void;

  // Claude Code session settings
  resumeClaudeSession: boolean;
  setResumeClaudeSession: (resume: boolean) => void;

  // Activity Feed settings
  setShowActivityInNav: (show: boolean) => void;
  setFeedEnabledEventTypes: (types: ActivityEventType[]) => void;
  setFeedRetentionDays: (days: number) => void;
  setFeedMaxItems: (maxItems: number) => void;
  toggleFeedEventType: (eventType: ActivityEventType) => void;

  // Work Summaries settings
  summaryIncludePRs: boolean;
  summaryIncludeCommits: boolean;
  summaryIncludeIssues: boolean;
  summaryCustomPrompt: string;
  setSummaryIncludePRs: (include: boolean) => void;
  setSummaryIncludeCommits: (include: boolean) => void;
  setSummaryIncludeIssues: (include: boolean) => void;
  setSummaryCustomPrompt: (prompt: string) => void;
}

const defaultAliases: ClaudeCodeAlias[] = [
  {
    id: 'yolo',
    name: 'YOLO Mode',
    command: 'claude --dangerously-skip-permissions',
    isDefault: true,
  },
  {
    id: 'default',
    name: 'Default',
    command: 'claude',
    isDefault: false,
  },
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Default values
      theme: 'dark',
      terminalFontSize: 14,
      terminalFontFamily: 'JetBrains Mono',
      showWelcomeBanner: true,
      claudeCodeAliases: defaultAliases,
      lastUsedDirectory: '~',
      lastInstanceMode: 'claude-code',
      resumeClaudeSession: true,
      // Activity Feed defaults
      showActivityInNav: true,
      feedEnabledEventTypes: ['completed'] as ActivityEventType[],
      feedRetentionDays: 7,
      feedMaxItems: 20,
      // Work Summaries defaults
      summaryIncludePRs: true,
      summaryIncludeCommits: false,
      summaryIncludeIssues: false,
      summaryCustomPrompt: '',

      // Existing setters
      setTheme: (theme) => set({ theme }),
      setTerminalFontSize: (terminalFontSize) => set({ terminalFontSize }),
      setTerminalFontFamily: (terminalFontFamily) => set({ terminalFontFamily }),
      setShowWelcomeBanner: (showWelcomeBanner) => set({ showWelcomeBanner }),
      updateSettings: (settings) => set(settings),

      // Claude Code alias management
      addAlias: (name, command) =>
        set((state) => ({
          claudeCodeAliases: [
            ...state.claudeCodeAliases,
            {
              id: uuidv4(),
              name,
              command,
              isDefault: state.claudeCodeAliases.length === 0, // First one is default
            },
          ],
        })),

      updateAlias: (id, updates) =>
        set((state) => ({
          claudeCodeAliases: state.claudeCodeAliases.map((alias) =>
            alias.id === id ? { ...alias, ...updates } : alias
          ),
        })),

      removeAlias: (id) =>
        set((state) => {
          const filtered = state.claudeCodeAliases.filter((a) => a.id !== id);
          // If we removed the default, make the first one default
          if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
            filtered[0].isDefault = true;
          }
          return { claudeCodeAliases: filtered };
        }),

      setDefaultAlias: (id) =>
        set((state) => ({
          claudeCodeAliases: state.claudeCodeAliases.map((alias) => ({
            ...alias,
            isDefault: alias.id === id,
          })),
        })),

      getDefaultAlias: () => {
        const state = get();
        return state.claudeCodeAliases.find((a) => a.isDefault) || state.claudeCodeAliases[0];
      },

      // Instance creation preferences
      setLastUsedDirectory: (lastUsedDirectory) => set({ lastUsedDirectory }),
      setLastInstanceMode: (lastInstanceMode) => set({ lastInstanceMode }),

      // Claude Code session settings
      setResumeClaudeSession: (resumeClaudeSession) => set({ resumeClaudeSession }),

      // Activity Feed settings
      setShowActivityInNav: (showActivityInNav) => set({ showActivityInNav }),
      setFeedEnabledEventTypes: (feedEnabledEventTypes) => set({ feedEnabledEventTypes }),
      setFeedRetentionDays: (feedRetentionDays) => set({ feedRetentionDays }),
      setFeedMaxItems: (feedMaxItems) => set({ feedMaxItems }),
      toggleFeedEventType: (eventType) =>
        set((state) => {
          const types = state.feedEnabledEventTypes;
          if (types.includes(eventType)) {
            return { feedEnabledEventTypes: types.filter((t) => t !== eventType) };
          } else {
            return { feedEnabledEventTypes: [...types, eventType] };
          }
        }),

      // Work Summaries settings
      setSummaryIncludePRs: (summaryIncludePRs) => set({ summaryIncludePRs }),
      setSummaryIncludeCommits: (summaryIncludeCommits) => set({ summaryIncludeCommits }),
      setSummaryIncludeIssues: (summaryIncludeIssues) => set({ summaryIncludeIssues }),
      setSummaryCustomPrompt: (summaryCustomPrompt) => set({ summaryCustomPrompt }),
    }),
    {
      name: 'yojimbo-settings',
    }
  )
);
