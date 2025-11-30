import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Customer = {
  id: string;
  name: string;
};

type Invoice = {
  id: string;
  invoiceNo: string;
  status: string;
  issueDate: string;
  totalAmount: string;
  customer: Customer;
};

type InvoiceListResponse = {
  items: Invoice[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function InvoicesPage() {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 });
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<string | undefined>(undefined);

  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices', pagination, search, status],
    queryFn: async () => {
      const res = await apiClient.get<InvoiceListResponse>('/invoices', {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          search: search || undefined,
          status,
        },
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const columns: ColumnDef<Invoice>[] = [
    { accessorKey: 'invoiceNo', header: 'Invoice #' },
    {
      accessorKey: 'customer.name',
      header: 'Customer',
      cell: ({ row }) => row.original.customer?.name ?? '-',
    },
    {
      accessorKey: 'issueDate',
      header: 'Issue Date',
      cell: ({ getValue }) =>
        new Date(getValue<string>()).toLocaleDateString(),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Total',
      cell: ({ getValue }) => getValue<string>(),
    },
    { accessorKey: 'status', header: 'Status' },
  ];

  const items = data?.items ?? [];

  const handlePost = async (invoiceId: string) => {
    // For now, require a default location id to be set in localStorage
    const locationId = localStorage.getItem('default_location_id');
    if (!locationId) {
      alert('Set default_location_id in localStorage before posting invoices.');
      return;
    }
    await apiClient.post(`/invoices/${invoiceId}/post`, { locationId });
    refetch();
  };

  const handleExport = async () => {
    if (!startDate || !endDate) {
      alert('Select a start and end date before exporting.');
      return;
    }
    const response = await apiClient.get('/reporting/sales', {
      responseType: 'blob',
      params: {
        startDate,
        endDate,
      },
    });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales_${startDate}_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Invoices</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="w-52"
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={status || ''}
            onChange={(e) =>
              setStatus(e.target.value ? e.target.value : undefined)
            }
          >
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Posted">Posted</option>
            <option value="Paid">Paid</option>
          </select>
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={handleExport}>
            Export Sales CSV
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
            const draftIds = rows
              .filter((r) => r.status === 'Draft')
              .map((r) => r.id);
            if (draftIds.length === 0) return;
            // For simplicity, post the first selected draft
            handlePost(draftIds[0]);
          }}
          bulkActionLabel="Post Selected Drafts"
        />
      </Card>
    </div>
  );
}