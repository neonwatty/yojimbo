import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '@cc-orchestrator/shared';

interface SettingsState extends Settings {
  setTheme: (theme: Settings['theme']) => void;
  setTerminalFontSize: (size: number) => void;
  setTerminalFontFamily: (family: string) => void;
  setShowWelcomeBanner: (show: boolean) => void;
  updateSettings: (settings: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      terminalFontSize: 14,
      terminalFontFamily: 'JetBrains Mono',
      showWelcomeBanner: true,

      setTheme: (theme) => set({ theme }),
      setTerminalFontSize: (terminalFontSize) => set({ terminalFontSize }),
      setTerminalFontFamily: (terminalFontFamily) => set({ terminalFontFamily }),
      setShowWelcomeBanner: (showWelcomeBanner) => set({ showWelcomeBanner }),
      updateSettings: (settings) => set(settings),
    }),
    {
      name: 'cc-orchestrator-settings',
    }
  )
);
