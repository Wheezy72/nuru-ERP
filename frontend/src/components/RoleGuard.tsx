import * as React from 'react';

type Role = 'ADMIN' | 'MANAGER' | 'CASHIER';

type RoleGuardProps = {
  allowed: Role[];
  children: React.ReactNode;
};

export function RoleGuard({ allowed, children }: RoleGuardProps) {
  const [role, setRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem('auth_role');
    setRole(stored);
  }, []);

  if (!role) return null;

  if (!allowed.includes(role as Role)) {
    return null;
  }

  return <>{children}</>;
}