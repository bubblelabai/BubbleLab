import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initializeTheme = useSettingsStore((state) => state.initializeTheme);

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  return <>{children}</>;
}
