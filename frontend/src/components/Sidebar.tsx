import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';

type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

type NavItem = {
  label: string;
  path: string;
  group: 'Overview' | 'Sales' | 'Inventory' | 'CRM' | 'Banking' | 'Settings';
  roles?: Role[];
  featureFlag?: string;
};

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    group: 'Overview',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Point of Sale',
    path: '/pos',
    group: 'Sales',
    roles: ['ADMIN', 'MANAGER', 'CASHIER'],
  },
  {
    label: 'Inventory Lookup',
    path: '/inventory/lookup',
    group: 'Inventory',
    roles: ['ADMIN', 'MANAGER', 'CASHIER'],
  },
  {
    label: 'Products',
    path: '/inventory/products',
    group: 'Inventory',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Customers',
    path: '/customers',
    group: 'CRM',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Invoices',
    path: '/invoices',
    group: 'CRM',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Members',
    path: '/chama/members',
    group: 'Banking',
    roles: ['ADMIN'],
    featureFlag: 'enableChama',
  },
  {
    label: 'Audit Log',
    path: '/settings/audit-log',
    group: 'Settings',
    roles: ['ADMIN'],
  },
];

const groups: NavItem['group'][] = [
  'Overview',
  'Sales',
  'Inventory',
  'CRM',
  'Banking',
  'Settings',
];

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);
  const { data: features } = useTenantFeatures();
  const [role, setRole] = React.useState<Role | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem('auth_role') as Role | null;
    setRole(stored);
  }, []);

  const enableChama =
    features && typeof (features as any).enableChama === 'boolean'
      ? (features as any).enableChama
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
          const itemsForGroup = navItems.filter((item) => {
            if (item.group !== group) return false;
            if (item.featureFlag === 'enableChama' && !enableChama) return false;
            if (!role) return false;
            if (item.roles && !item.roles.includes(role)) return false;
            return true;
          });

          if (itemsForGroup.length === 0) {
            return null;
          }

          return (
            <div key={group} className="space-y-1">
              {!collapsed && (
                <div className="px-2 text-[0.7rem] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                  {group}
                </div>
              )}
              <div className="space-y-1">
                {itemsForGroup.map((item) => (
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
        })}
      </nav>
    </aside>
  );
}