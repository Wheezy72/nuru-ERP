import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';

type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

type Command = {
  label: string;
  path: string;
  group: string;
  minRole?: Role;
  featureFlag?: string;
};

const commands: Command[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    group: 'Overview',
    minRole: 'MANAGER',
  },
  {
    label: 'Point of Sale',
    path: '/pos',
    group: 'Sales',
  },
  {
    label: 'Inventory: Lookup',
    path: '/inventory/lookup',
    group: 'Inventory',
  },
  {
    label: 'Inventory: Products',
    path: '/inventory/products',
    group: 'Inventory',
    minRole: 'MANAGER',
  },
  { label: 'CRM: Customers', path: '/customers', group: 'CRM', minRole: 'MANAGER' },
  { label: 'CRM: Invoices', path: '/invoices', group: 'CRM', minRole: 'MANAGER' },
  {
    label: 'Banking: Members',
    path: '/chama/members',
    group: 'Banking',
    minRole: 'ADMIN',
    featureFlag: 'enableChama',
  },
  {
    label: 'Settings: Audit Log',
    path: '/settings/audit-log',
    group: 'Settings',
    minRole: 'ADMIN',
  },
];

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const [role, setRole] = React.useState<Role | null>(null);
  const { data: features } = useTenantFeatures();

  React.useEffect(() => {
    const stored = localStorage.getItem('auth_role') as Role | null;
    setRole(stored);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    return commands.filter((cmd) => {
      if (cmd.minRole && role) {
        if (cmd.minRole === 'ADMIN' && role !== 'ADMIN') return false;
        if (cmd.minRole === 'MANAGER' && role === 'CASHIER') return false;
      }
      if (cmd.featureFlag && features) {
        const flagValue = (features as any)[cmd.featureFlag];
        if (flagValue === false) return false;
      }
      return (
        cmd.label.toLowerCase().includes(q) ||
        cmd.group.toLowerCase().includes(q)
      );
    });
  }, [query, role, features]);

  if (!open) return null;

  const handleSelect = (cmd: Command) => {
    onOpenChange(false);
    navigate(cmd.path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24">
      <div className="w-full max-w-lg rounded-lg bg-card p-3 shadow-neo">
        <Input
          autoFocus
          placeholder="Type a command or search (e.g. 'Products', 'Customers')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-border bg-background">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No commands found.
            </div>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.path}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60'
                )}
                onClick={() => handleSelect(cmd)}
              >
                <span>{cmd.label}</span>
                <span className="text-[0.7rem] uppercase text-muted-foreground">
                  {cmd.group}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="mt-2 flex justify-between text-[0.7rem] text-muted-foreground">
          <span>Use ↑↓ to navigate, Enter to select</span>
          <span>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}