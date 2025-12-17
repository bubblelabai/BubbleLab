import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { initializeTheme, resolvedTheme } = useSettingsStore((state) => ({
    initializeTheme: state.initializeTheme,
    resolvedTheme: state.resolvedTheme,
  }));

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  return <div data-theme={resolvedTheme}>{children}</div>;
}
