import { Moon, Sun } from 'lucide-react';
import { ServiceContentParser } from './features/services/ServiceContentParser.jsx';
import { useTheme } from './useTheme.js';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-baseline gap-3">
            <span className="text-[15px] font-semibold tracking-tight text-ink">SERVICE CONTENT</span>
            <span className="text-sm text-muted">Parser</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="btn-quiet px-2.5"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        <ServiceContentParser />
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10">
        <p className="border-t border-line pt-6 text-xs text-faint">
          Service Content Parser
        </p>
      </footer>
    </div>
  );
}
