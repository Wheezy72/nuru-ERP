import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTenantFeatures, TenantFeatures, RoleVisibility } from '@/hooks/useTenantFeatures';

type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

type NavItem = {
  label: string;
  path: string;
  group:
    | 'Overview'
    | 'Sales'
    | 'Inventory'
    | 'CRM'
    | 'Banking'
    | 'HR'
    | 'Maker'
    | 'Planner'
    | 'Settings';
  roles?: Role[];
  featureFlag?: string;
};

function resolveRoleVisibility(
  features: TenantFeatures | undefined,
  role: Role | null,
): RoleVisibility {
  const base: RoleVisibility = {
    canViewDailyTotals: true,
    canViewDebtors: true,
    canViewMargins: false,
    canViewGLReports: false,
  };

  if (!features || !role) {
    return base;
  }

  const fromTenant =
    features.roleVisibility &&
    typeof features.roleVisibility === 'object' &&
    (features.roleVisibility[role] as RoleVisibility | undefined);

  if (!fromTenant) {
    return base;
  }

  return {
    ...base,
    ...fromTenant,
  };
}

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
    label: 'Purchase Orders',
    path: '/procurement/purchase-orders',
    group: 'Maker',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Manufacturing',
    path: '/manufacturing',
    group: 'Maker',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Projects',
    path: '/projects',
    group: 'Planner',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    label: 'Pay Casuals',
    path: '/payroll/casuals',
    group: 'HR',
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
    label: 'Business Setup',
    path: '/setup',
    group: 'Settings',
    roles: ['ADMIN'],
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
  'Maker',
  'Planner',
  'HR',
  'Banking',
  'Settings',
];

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);
  const { data: features } = useTenantFeatures();
  const [role, setRole] = React.useState<Role | null>(null);

  const tenantType =
    features && typeof (features as any).type === 'string'
      ? ((features as any).type as string)
      : undefined;

  const isSchool = tenantType === 'SCHOOL';
  const mode = (features && (features as any).mode) || 'FULL';

  React.useEffect(() => {
    const stored = localStorage.getItem('auth_role') as Role | null;
    setRole(stored);
  }, []);

  const enableChama =
    features && typeof (features as any).enableChama === 'boolean'
      ? (features as any).enableChama
      : true;

  const roleVisibility = resolveRoleVisibility(features, role);

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
        <div className="flex items-center gap-1">
          {!collapsed && (
            <span className="text-[0.6rem] rounded-full bg-background/30 px-2 py-0.5 text-secondary-foreground/80">
              {mode === 'SIMPLE' ? 'Simple' : 'Full'}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-xs"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? '»' : '«'}
          </Button>
        </div>
      </div>

      <nav className="flex-1 space-y-4 px-2 py-2 text-xs">
        {groups.map((group) => {
          const itemsForGroup = navItems.filter((item) => {
            if (item.group !== group) return false;
            if (item.featureFlag === 'enableChama' && !enableChama) return false;
            if (!role) return false;
            if (item.roles && !item.roles.includes(role)) return false;
            // In SIMPLE mode, hide Maker/Planner/Banking/Settings for non-admins
            if (
              mode === 'SIMPLE' &&
              role !== 'ADMIN' &&
              (group === 'Maker' || group === 'Planner' || group === 'Banking' || group === 'Settings')
            ) {
              return false;
            }
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
                {itemsForGroup.map((item) => {
                  let label = item.label;
                  if (isSchool) {
                    if (item.path === '/inventory/products') {
                      label = 'Fees';
                    } else if (item.path === '/customers') {
                      label = 'Students';
                    }
                  }
                  return (
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
                      {collapsed ? label.charAt(0) : label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}