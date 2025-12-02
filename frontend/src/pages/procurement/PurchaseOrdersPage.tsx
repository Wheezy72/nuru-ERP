import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

type PurchaseOrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitCost: number;
  uomName: string;
  lineTotal: number;
};

type PurchaseOrder = {
  id: string;
  supplierName: string;
  projectName: string | null;
  orderDate: string;
  expectedDate: string | null;
  status: 'Draft' | 'Ordered' | 'Received' | 'Cancelled';
  totalAmount: number;
};

type PurchaseOrderListResponse = {
  items: PurchaseOrder[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

/**
 * PurchaseOrdersPage
 *
 * Simple procurement view:
 * - Lists Purchase Orders with status filter.
 * - Allows creating a basic PO with supplier + items.
 * - Allows receiving a PO into a selected location.
 */
export function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 });
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'Draft' | 'Ordered' | 'Received'>('ALL');
  const [showCreate, setShowCreate] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', pagination, statusFilter],
    queryFn: async () => {
      const res = await apiClient.get<PurchaseOrderListResponse>('/procurement/purchase-orders', {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          status: statusFilter,
        },
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const receiveMutation = useMutation({
    mutationFn: async (payload: { id: string; locationId: string }) => {
      await apiClient.post(`/procurement/purchase-orders/${payload.id}/receive`, {
        locationId: payload.locationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  const columns: ColumnDef<PurchaseOrder>[] = [
    { accessorKey: 'supplierName', header: 'Supplier' },
    { accessorKey: 'projectName', header: 'Project', cell: ({ getValue }) => getValue<string | null>() || '-' },
    { accessorKey: 'orderDate', header: 'Order Date' },
    {
      accessorKey: 'expectedDate',
      header: 'Expected',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
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
      accessorKey: 'totalAmount',
      header: 'Total',
      cell: ({ getValue }) => {
        const value = getValue<number>();
        return value.toLocaleString(undefined, { style: 'currency', currency: 'KES' });
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const po = row.original;
        const canReceive = po.status === 'Ordered';
        if (!canReceive) {
          return <span className="text-[0.7rem] text-muted-foreground">—</span>;
        }
        return (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[0.7rem]"
            onClick={async () => {
              const locationId = localStorage.getItem('default_location_id');
              if (!locationId) {
                alert('Set default_location_id in localStorage before receiving stock.');
                return;
              }
              try {
                await receiveMutation.mutateAsync({ id: po.id, locationId });
              } catch (err: any) {
                alert(err?.response?.data?.message || 'Failed to receive purchase order.');
              }
            }}
          >
            Receive
          </Button>
        );
      },
    },
  ];

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Purchase Orders</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <option value="ALL">All</option>
            <option value="Draft">Draft</option>
            <option value="Ordered">Ordered</option>
            <option value="Received">Received</option>
          </Select>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Hide Form' : 'New PO'}
          </Button>
        </div>
      </div>

      {showCreate && <CreatePurchaseOrderCard onCreated={() => {
        setShowCreate(false);
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      }} />}

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

type CreatePurchaseOrderCardProps = {
  onCreated: () => void;
};

/**
 * Minimal inline form for creating a Purchase Order.
 * This intentionally keeps the UX simple: supplier ID and free-form items.
 */
function CreatePurchaseOrderCard({ onCreated }: CreatePurchaseOrderCardProps) {
  const [supplierId, setSupplierId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [orderDate, setOrderDate] = React.useState('');
  const [expectedDate, setExpectedDate] = React.useState('');
  const [items, setItems] = React.useState<
    { productId: string; uomId: string; quantity: string; unitCost: string }[]
  >([{ productId: '', uomId: '', quantity: '', unitCost: '' }]);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/procurement/purchase-orders', {
        supplierId,
        projectId: projectId || undefined,
        orderDate: orderDate || undefined,
        expectedDate: expectedDate || undefined,
        items: items
          .filter((i) => i.productId && i.uomId && i.quantity && i.unitCost)
          .map((i) => ({
            productId: i.productId,
            uomId: i.uomId,
            quantity: i.quantity,
            unitCost: i.unitCost,
          })),
      });
    },
    onSuccess: () => {
      onCreated();
    },
  });

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: '', uomId: '', quantity: '', unitCost: '' }]);
  };

  const handleChangeItem = (index: number, field: string, value: string) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    );
  };

  return (
    <Card className="border-dashed border-emerald-300 bg-emerald-50/40 p-3 text-xs mb-2">
      <div className="mb-2 font-semibold text-emerald-900">New Purchase Order</div>
      <div className="grid gap-2 md:grid-cols-4 mb-2">
        <Input
          placeholder="Supplier ID"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        />
        <Input
          placeholder="Project ID (optional)"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />
        <Input
          type="date"
          placeholder="Order Date"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
        />
        <Input
          type="date"
          placeholder="Expected Date"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-4">
            <Input
              placeholder="Product ID"
              value={item.productId}
              onChange={(e) => handleChangeItem(index, 'productId', e.target.value)}
            />
            <Input
              placeholder="UoM ID"
              value={item.uomId}
              onChange={(e) => handleChangeItem(index, 'uomId', e.target.value)}
            />
            <Input
              placeholder="Quantity"
              value={item.quantity}
              onChange={(e) => handleChangeItem(index, 'quantity', e.target.value)}
            />
            <Input
              placeholder="Unit Cost"
              value={item.unitCost}
              onChange={(e) => handleChangeItem(index, 'unitCost', e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-[0.7rem]"
          onClick={handleAddItem}
        >
          Add Line
        </Button>
        <Button
          type="button"
          size="sm"
          className="text-[0.7rem]"
          disabled={mutation.isLoading}
          onClick={async () => {
            if (!supplierId) {
              alert('Supplier ID is required');
              return;
            }
            if (
              !items.some(
                (i) => i.productId && i.uomId && i.quantity && i.unitCost,
              )
            ) {
              alert('Add at least one valid item');
              return;
            }
            try {
              await mutation.mutateAsync();
            } catch (err: any) {
              alert(
                err?.response?.data?.message ||
                  'Failed to create purchase order. Check fields and try again.',
              );
            }
          }}
        >
          {mutation.isLoading ? 'Creating...' : 'Create PO'}
        </Button>
      </div>
    </Card>
  );
}