import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export type RoleVisibility = {
  canViewDailyTotals?: boolean;
  canViewDebtors?: boolean;
  canViewMargins?: boolean;
  canViewGLReports?: boolean;
};

export type TenantMode = 'SIMPLE' | 'FULL';

export type TenantFeatures = {
  enableChama?: boolean;
  type?: 'SCHOOL' | string;
  enableRecurringBilling?: boolean;
  mode?: TenantMode;
  roleVisibility?: {
    ADMIN?: RoleVisibility;
    MANAGER?: RoleVisibility;
    CASHIER?: RoleVisibility;
  };
  [key: string]: unknown;
};

export function useTenantFeatures() {
  return useQuery({
    queryKey: ['tenantFeatures'],
    queryFn: async () => {
      const res = await apiClient.get<{ features: TenantFeatures }>(
        '/tenant/features'
      );
      return res.data.features || {};
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation hook to update tenant feature flags (mode, role visibility, etc.).
 */
export function useUpdateTenantFeatures() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<TenantFeatures>) => {
      const res = await apiClient.post<{ features: TenantFeatures }>(
        '/tenant/features',
        patch
      );
      return res.data.features;
    },
    onSuccess: (features) => {
      queryClient.setQueryData(['tenantFeatures'], features);
    },
  });
}