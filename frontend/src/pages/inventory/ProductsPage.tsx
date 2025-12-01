import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';

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

/**
 * ProductsPage
 *
 * Lists products for the current tenant and exposes:
 * - Export Inventory CSV
 * - "Open Crate" action that breaks stock from the default UoM into its first derived UoM
 *   by calling POST /api/inventory/products/:id/break-unit.
 */
export function ProductsPage() {
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 25,
  });
  const [search, setSearch] = React.useState('');
  const { data: features } = useTenantFeatures();

  const tenantType =
    features && typeof (features as any).type === 'string'
      ? ((features as any).type as string)
      : undefined;
  const isSchool = tenantType === 'SCHOOL';

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

  const items = data?.items ?? [];

  const handleOpenCrate = async (product: Product) => {
    const defaultLocationId = localStorage.getItem('default_location_id');
    if (!defaultLocationId) {
      alert('Set default_location_id in localStorage before breaking units.');
      return;
    }

    const child = product.defaultUom.derivedUnits?.[0];
    if (!child) {
      alert('This product is not configured with a smaller unit to break into.');
      return;
    }

    try {
      await apiClient.post(`/inventory/products/${product.id}/break-unit`, {
        locationId: defaultLocationId,
        quantity: 1, // break 1 default unit into the smaller unit
      });
      await refetch();
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          'Failed to break units. Check stock levels and configuration.'
      );
    }
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
      id: 'openCrate',
      header: 'Break Unit',
      cell: ({ row }) => {
        const product = row.original;
        const child = product.defaultUom.derivedUnits?.[0];

        if (!child) {
          return (
            <span className="text-[0.7rem] text-muted-foreground">
              -
            </span>
          );
        }

        return (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[0.7rem]"
            onClick={() => handleOpenCrate(product)}
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

  const title = isSchool ? 'Fees' : 'Products';
  const placeholder = isSchool ? 'Search fees...' : 'Search products...';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={placeholder}
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