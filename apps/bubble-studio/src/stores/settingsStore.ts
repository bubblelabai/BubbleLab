import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface SettingsStore {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  initializeTheme: () => void;
}

const STORAGE_KEY = 'bubble-studio-settings';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

const loadStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'dark';
    const parsed = JSON.parse(raw);
    return parsed?.state?.theme ?? 'dark';
  } catch (err) {
    console.warn('Failed to read stored theme, defaulting to dark', err);
    return 'dark';
  }
};

const initialTheme = loadStoredTheme();
const initialResolvedTheme = resolveTheme(initialTheme);

// Apply immediately to avoid flash during first paint
if (typeof document !== 'undefined') {
  applyTheme(initialResolvedTheme);
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      theme: initialTheme,
      resolvedTheme: initialResolvedTheme,
      setTheme: (theme: Theme) => {
        const resolvedTheme = resolveTheme(theme);
        set({ theme, resolvedTheme });
        applyTheme(resolvedTheme);
      },
      initializeTheme: () => {
        const { theme } = get();
        const resolvedTheme = resolveTheme(theme);
        set({ resolvedTheme });
        applyTheme(resolvedTheme);
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // After rehydration, resolve and apply the theme
          const resolvedTheme = resolveTheme(state.theme);
          state.resolvedTheme = resolvedTheme;
          applyTheme(resolvedTheme);
        }
      },
    }
  )
);

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

// Listen for system theme changes when theme is set to 'system'
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const { theme, setTheme } = useSettingsStore.getState();
    if (theme === 'system') {
      // Re-trigger to update resolvedTheme
      setTheme('system');
    }
  });
}
