import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export type TenantFeatures = {
  enableChama?: boolean;
  type?: 'SCHOOL' | string;
  enableRecurringBilling?: boolean;
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