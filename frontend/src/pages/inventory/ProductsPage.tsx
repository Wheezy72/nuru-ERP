import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type UnitOfMeasure = {
  id: string;
  name: string;
  derivedUnits?: { id: string; name: string }[];
};

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  isActive: boolean;
  defaultUom: UnitOfMeasure;
};

type ProductListResponse = {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function ProductsPage() {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 });
  const [search, setSearch] = React.useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', pagination, search],
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

  const handleOpenCrate = async (product: Product) => {
    const defaultUom = product.defaultUom;
    const child = defaultUom.derivedUnits?.[0];

    if (!child) {
      return;
    }

    const locationId = localStorage.getItem('default_location_id');
    if (!locationId) {
      alert('Set default_location_id in localStorage before opening crates.');
      return;
    }

    await apiClient.post('/inventory/stock/break-bulk', {
      productId: product.id,
      locationId,
      batchId: null,
      sourceUomId: defaultUom.id,
      targetUomId: child.id,
      sourceQuantity: 1,
    });

    refetch();
  };

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
    {
      id: 'kadogo',
      header: 'Kadogo',
      cell: ({ row }) => {
        const product = row.original;
        const defaultUom = product.defaultUom;
        const child = defaultUom.derivedUnits?.[0];

        if (!child) {
          return (
            <span className="text-[0.7rem] text-muted-foreground">
              -
            </span>
          );
        }

        return (
         <<Button
            size="sm"
            variant="outline"
            className="text-[0.7rem] h-7 px-2"
            onClick={()eOpenCrate(product)}
          >
            Open Crate
          </Button>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ getValue }) =>
        getValue<boolean>() ? (
          <span className="text-emerald-600">Active</span>
        ) : (
          <span className="text-slate-500">Inactive</span>
        ),
    },
  ];

  const items = data?.items ?? [];

  const handleExport = async () => {
    const response = await apiClient.get('/reporting/inventory', {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Products</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="w-64"
          />
          <Button size="sm" variant="outline" onClick={handleExport}>
            Export Inventory CSV
          </Button>
        </div>
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
            console.log('Bulk product selection', rows);
          }}
          bulkActionLabel="Apply Bulk Action"
        />
      </Card>
    </div>
  );
}