import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NavItem = {
  label: string;
  path: string;
  group: 'Inventory' | 'CRM' | 'Banking';
};

const navItems: NavItem[] = [
  { label: 'Products', path: '/inventory/products', group: 'Inventory' },
  { label: 'Customers', path: '/customers', group: 'CRM' },
  { label: 'Invoices', path: '/invoices', group: 'CRM' },
  { label: 'Members', path: '/chama/members', group: 'Banking' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-secondary text-secondary-foreground transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <div className={cn('font-semibold tracking-tight', collapsed && 'hidden')}>
          Nuru
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-xs"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? '»' : '«'}
        </Button>
      </div>

      <nav className="flex-1 space-y-4 px-2 py-2 text-xs">
        {['Inventory', 'CRM', 'Banking'].map((group) => (
          <div key={group} className="space-y-1">
            {!collapsed && (
              <div className="px-2 text-[0.7rem] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                {group}
              </div>
            )}
            <div className="space-y-1">
              {navItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.8rem] transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-secondary-foreground hover:bg-secondary/80'
                      )
                    }
                  >
                    {collapsed ? item.label.charAt(0) : item.label}
                  </NavLink>
                ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}