import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type BomItem = {
  id: string;
  componentProductName: string;
  quantity: number;
  uomName: string;
};

type Bom = {
  id: string;
  name: string;
  productName: string;
  items: BomItem[];
};

type ProductionOrder = {
  id: string;
  bomName: string;
  productName: string;
  quantity: number;
  locationName: string;
  status: 'Planned' | 'InProgress' | 'Completed';
  scheduledAt: string | null;
};

type BomListResponse = { items: Bom[] };
type ProductionOrderListResponse = { items: ProductionOrder[] };

/**
 * ManufacturingPage
 *
 * Simple UI for:
 * - Viewing Bills of Material (BOMs).
 * - Creating new BOMs.
 * - Creating and completing Production Orders.
 */
export function ManufacturingPage() {
  const queryClient = useQueryClient();
  const [selectedBomId, setSelectedBomId] = React.useState<string>('');
  const [locationId, setLocationId] = React.useState<string>('');
  const [poQuantity, setPoQuantity] = React.useState<string>('1');

  const { data: bomData, isLoading: bomsLoading } = useQuery({
    queryKey: ['boms'],
    queryFn: async () => {
      const res = await apiClient.get<BomListResponse>('/manufacturing/boms');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ['production-orders'],
    queryFn: async () => {
      const res = await apiClient.get<ProductionOrderListResponse>('/manufacturing/production-orders');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const createPoMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/manufacturing/production-orders', {
        bomId: selectedBomId,
        locationId,
        quantity: poQuantity,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    },
  });

  const completePoMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/manufacturing/production-orders/${id}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    },
  });

  const boms = bomData?.items ?? [];
  const productionOrders = poData?.items ?? [];

  const bomColumns: ColumnDef<Bom>[] = [
    { accessorKey: 'name', header: 'BOM Name' },
    { accessorKey: 'productName', header: 'Finished Product' },
    {
      id: 'components',
      header: 'Components',
      cell: ({ row }) => {
        const bom = row.original;
        if (!bom.items || bom.items.length === 0) {
          return <span className="text-[0.7rem] text-muted-foreground">-</span>;
        }
        return (
          <ul className="list-disc pl-4 text-[0.7rem]">
            {bom.items.map((item) => (
              <li key={item.id}>
                {item.componentProductName} – {item.quantity} {item.uomName}
              </li>
            ))}
          </ul>
        );
      },
    },
  ];

  const poColumns: ColumnDef<ProductionOrder>[] = [
    { accessorKey: 'bomName', header: 'BOM' },
    { accessorKey: 'productName', header: 'Product' },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ getValue }) => getValue<number>().toLocaleString(),
    },
    { accessorKey: 'locationName', header: 'Location' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const value = getValue<string>();
        return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.7rem] font-medium text-slate-700">
            {value}
          </span>
        );
      },
    },
    {
      accessorKey: 'scheduledAt',
      header: 'Scheduled',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const order = row.original;
        const canComplete = order.status !== 'Completed';
        if (!canComplete) {
          return (
            <span className="text-[0.7rem] text-muted-foreground">
              Completed
            </span>
          );
        }
        return (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[0.7rem]"
            onClick={async () => {
              try {
                await completePoMutation.mutateAsync(order.id);
              } catch (err: any) {
                alert(
                  err?.response?.data?.message ||
                    'Failed to complete production order.',
                );
              }
            }}
          >
            Complete
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">
          Manufacturing – BOMs & Production Orders
        </h1>
      </div>

      <Card className="p-4 text-xs">
        <div className="mb-2 font-semibold text-foreground">Create Production Order</div>
        <div className="grid gap-2 md:grid-cols-3">
          <Input
            placeholder="BOM ID"
            value={selectedBomId}
            onChange={(e) => setSelectedBomId(e.target.value)}
          />
          <Input
            placeholder="Location ID"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          />
          <Input
            placeholder="Quantity"
            value={poQuantity}
            onChange={(e) => setPoQuantity(e.target.value)}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            className="text-[0.7rem]"
            disabled={createPoMutation.isLoading}
            onClick={async () => {
              if (!selectedBomId || !locationId || !poQuantity) {
                alert('BOM ID, Location ID and Quantity are required');
                return;
              }
              try {
                await createPoMutation.mutateAsync();
              } catch (err: any) {
                alert(
                  err?.response?.data?.message ||
                    'Failed to create production order.',
                );
              }
            }}
          >
            {createPoMutation.isLoading ? 'Creating...' : 'Create Production Order'}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Bills of Material
          </div>
          <DataTable
            columns={bomColumns}
            data={boms}
            pageCount={1}
            totalRows={boms.length}
            state={{ pageIndex: 0, pageSize: boms.length || 10 }}
            onStateChange={() => {}}
            isLoading={bomsLoading}
          />
        </Card>

        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Production Orders
          </div>
          <DataTable
            columns={poColumns}
            data={productionOrders}
            pageCount={1}
            totalRows={productionOrders.length}
            state={{ pageIndex: 0, pageSize: productionOrders.length || 10 }}
            onStateChange={() => {}}
            isLoading={poLoading}
          />
        </Card>
      </div>
    </div>
  );
}