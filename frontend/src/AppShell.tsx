import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';

export type Theme = 'default' | 'outdoor';

export function AppShell() {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<Theme>('default');

  React.useEffect(() => {
    const stored =
      (typeof window !== 'undefined' &&
        (window.localStorage.getItem('nuru_theme') as Theme | null)) ||
      null;
    if (stored === 'outdoor' || stored === 'default') {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
    } else {
      document.documentElement.dataset.theme = 'default';
    }
  }, []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'default' ? 'outdoor' : 'default';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('nuru_theme', next);
      }
      document.documentElement.dataset.theme = next;
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="text-sm font-medium text-muted-foreground">
            Nuru ERP
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-muted/40"
              onClick={toggleTheme}
            >
              {theme === 'default' ? 'Outdoor Mode' : 'Indoor Mode'}
            </button>
            <button
              className="rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-muted/40"
              onClick={() => setCommandOpen(true)}
            >
              Press Ctrl+K to teleport
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto px-4 py-4">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}