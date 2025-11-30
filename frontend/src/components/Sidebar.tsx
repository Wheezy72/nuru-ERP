import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RoleGuard } from '@/components/RoleGuard';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';

type NavItem = {
  label: string;
  path: string;
  group: 'Overview' | 'Inventory' | 'CRM' | 'Banking' | 'Settings';
};

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', group: 'Overview' },
  { label: 'Products', path: '/inventory/products', group: 'Inventory' },
  { label: 'Customers', path: '/customers', group: 'CRM' },
  { label: 'Invoices', path: '/invoices', group: 'CRM' },
  { label: 'Members', path: '/chama/members', group: 'Banking' },
  { label: 'Audit Log', path: '/settings/audit-log', group: 'Settings' },
];

const groups: NavItem['group'][] = ['Overview', 'Inventory', 'CRM', 'Banking', 'Settings'];

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);
  const { data: features } = useTenantFeatures();
  const enableChama =
    features && typeof features.enableChama === 'boolean'
      ? features.enableChama
      : true;

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
        {groups.map((group) => {
          // Feature-flag Banking
          if (group === 'Banking' && !enableChama) {
            return null;
          }

          const groupContent = (
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
          );

          if (group === 'Banking' || group === 'Settings') {
            return (
              <RoleGuard key={group} allowed={['ADMIN']}>
                {groupContent}
              </RoleGuard>
            );
          }

          return groupContent;
        })}
      </nav>
    </aside>
  );
}