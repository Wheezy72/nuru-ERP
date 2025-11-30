import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type UnitOfMeasure = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  defaultUom: UnitOfMeasure;
};

type ProductListResponse = {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function InventoryLookupPage() {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 });
  const [search, setSearch] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-lookup', pagination, search],
    queryFn: async () => {
      const res = await apiClient.get<ProductListResponse>('/inventory/products', {
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

  const columns: ColumnDef<Product>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'sku', header: 'SKU' },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'defaultUom.name',
      header: 'Default UoM',
      cell: ({ row }) => row.original.defaultUom?.name ?? '-',
    },
  ];

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Inventory Lookup</h1>
        <Input
          placeholder="Search by name or SKU..."
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
        />
      </Card>
    </div>
  );
}