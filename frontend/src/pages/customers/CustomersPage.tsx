import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type CustomerListResponse = {
  items: Customer[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function CustomersPage() {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 });
  const [search, setSearch] = React.useState('');
  const { data: features } = useTenantFeatures();

  const tenantType =
    features && typeof (features as any).type === 'string'
      ? ((features as any).type as string)
      : undefined;
  const isSchool = tenantType === 'SCHOOL';

  const { data, isLoading } = useQuery({
    queryKey: ['customers', pagination, search],
    queryFn: async () => {
      const res = await apiClient.get<CustomerListResponse>('/customers', {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          search: search || undefined,
        },
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const columns: ColumnDef<Customer>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
  ];

  const items = data?.items ?? [];

  const title = isSchool ? 'Students' : 'Customers';
  const placeholder = isSchool ? 'Search students...' : 'Search customers...';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          className="w-64"
        />
      </div>
      <Card className="p-4">
        <DataTable
          columns={columns}
          data={items}
          pageCount={data?.pageCount ?? 0}
          totalRows={data?.total ?? 0}
          state={pagination}
          onStateChange={setPagination}
          isLoading={isLoading}
          onBulkAction={(rows) => {
            console.log('Bulk customer selection', rows);
          }}
        />
      </Card>
    </div>
  );
}