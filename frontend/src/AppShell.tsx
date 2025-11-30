import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';

export function AppShell() {
  const [commandOpen, setCommandOpen] = React.useState(false);

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

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="text-sm font-medium text-muted-foreground">
            Nuru ERP
          </div>
          <button
            className="rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-muted/40"
            onClick={() => setCommandOpen(true)}
          >
            Press Ctrl+K to teleport
          </button>
        </header>
        <main
          className="flex-1 overflow-auto px-4 py-4"
          style={{ backgroundColor: '#F9F9F8' }}
        >
          <Outlet />
        </main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}