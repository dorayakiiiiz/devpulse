import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../stores/themeStore';

// Action button toggling application visual color theme
export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      className="flex h-[38px] items-center gap-2 rounded-md border-2 border-zinc-950 bg-white px-3 text-xs font-black text-zinc-950 shadow-[2px_2px_0_#18181b] transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc] dark:shadow-[2px_2px_0_#090b10]"
    >
      {isLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
      <span className="hidden sm:inline">{isLight ? 'Dark' : 'Light'}</span>
    </button>
  );
};
