import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type Invoice = {
  id: string;
  invoiceNo: string;
  status: string;
  issueDate: string;
  totalAmount: string;
  taxStatus?: string | null;
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
  const navigate = useNavigate();
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 });
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<string | undefined>(undefined);

  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');
  const [bulkProductId, setBulkProductId] = React.useState<string>('');
  const [bulkAmount, setBulkAmount] = React.useState<string>('');
  const [isBulkSubmitting, setIsBulkSubmitting] = React.useState(false);

  const { data: features } = useTenantFeatures();
  const tenantType =
    features && typeof (features as any).type === 'string'
      ? ((features as any).type as string)
      : undefined;
  const isSchool = tenantType === 'SCHOOL';

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
    {
      accessorKey: 'invoiceNo',
      header: 'Invoice #',
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <button
            type="button"
            className="text-xs font-medium text-emerald-700 hover:underline"
            onClick={() => navigate(`/invoices/${invoice.id}`)}
          >
            {invoice.invoiceNo}
          </button>
        );
      },
    },
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
    {
      id: 'taxStatus',
      header: 'Tax',
      cell: ({ row }) => {
        const invoice = row.original;
        if (!invoice.taxStatus) {
          return (
            <span className="text-[0.7rem] text-muted-foreground">
              —
            </span>
          );
        }
        const label =
          invoice.taxStatus === 'SENT'
            ? 'Signed'
            : invoice.taxStatus === 'PENDING'
            ? 'Pending'
            : 'Failed';
        const cls =
          invoice.taxStatus === 'SENT'
            ? 'text-emerald-700'
            : invoice.taxStatus === 'PENDING'
            ? 'text-amber-700'
            : 'text-rose-700';
        return (
          <span className={`text-[0.7rem] ${cls}`}>
            {label}
          </span>
        );
      },
    },
    { accessorKey: 'status', header: 'Status' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const invoice = row.original;
        const amountNumber = Number(invoice.totalAmount);
        const isPayableStatus =
          invoice.status === 'Draft' ||
          invoice.status === 'Posted' ||
          invoice.status === 'Partial';

        const handleMpesaClick = async () => {
          try {
            const phone =
              invoice.customer.phone ||
              window.prompt('Enter M-Pesa phone number (e.g. 2547XXXXXXXX)');
            if (!phone) {
              return;
            }
            if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
              alert('Invalid invoice amount.');
              return;
            }
            await apiClient.post('/payments/mpesa/stkpush', {
              phoneNumber: phone,
              amount: amountNumber,
              invoiceId: invoice.id,
              accountReference: invoice.invoiceNo,
              description: `Invoice ${invoice.invoiceNo}`,
            });
            alert('M-Pesa STK push initiated. Complete payment on your phone.');
          } catch (err: any) {
            alert(
              err?.response?.data?.message ||
                'Failed to initiate M-Pesa payment.'
            );
          }
        };

        const handleCardClick = async () => {
          try {
            const response = await apiClient.post(
              '/payments/gateway/initiate',
              {
                invoiceId: invoice.id,
              }
            );
            const { redirectUrl } = response.data as { redirectUrl: string };
            window.location.href = redirectUrl;
          } catch (err: any) {
            alert(
              err?.response?.data?.message ||
                'Failed to initiate card/bank payment.'
            );
          }
        };

        const handleManualClick = async () => {
          const amountStr =
            window.prompt('Amount received (KES)', invoice.totalAmount) || '';
          const amountValue = Number(amountStr);
          if (!Number.isFinite(amountValue) || amountValue <= 0) {
            alert('Enter a valid amount.');
            return;
          }
          const method =
            window.prompt('Payment method (e.g. EFT, Cheque)', 'EFT') || '';
          if (!method) {
            return;
          }
          const reference =
            window.prompt('Reference number (optional)', '') || undefined;
          const dateStr =
            window.prompt(
              'Payment date (YYYY-MM-DD)',
              new Date().toISOString().slice(0, 10)
            ) || new Date().toISOString().slice(0, 10);

          try {
            await apiClient.post(`/invoices/${invoice.id}/manual-payment`, {
              amount: amountValue,
              method,
              reference,
              paidAt: dateStr,
            });
            alert('Manual payment recorded for verification.');
            await refetch();
          } catch (err: any) {
            alert(
              err?.response?.data?.message ||
                'Failed to record manual payment.'
            );
          }
        };

        return (
          <div className="flex flex-wrap gap-1 text-[0.7rem]">
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleMpesaClick}
              disabled={!isPayableStatus}
            >
              Pay with M-Pesa
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-500 bg-slate-600 text-white hover:bg-slate-700 hover:text-white"
              onClick={handleCardClick}
              disabled={!isPayableStatus}
            >
              Pay with Card
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[0.7rem]"
              onClick={handleManualClick}
              disabled={invoice.status === 'Paid'}
            >
              Record External
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[0.7rem]"
              onClick={() => navigate(`/invoices/${invoice.id}`)}
            >
              View
            </Button>
          </div>
        );
      },
    },
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

  const handleBulkSchoolInvoices = async () => {
    if (!isSchool) return;
    if (!bulkProductId || !bulkAmount) {
      alert('Select a fee product and amount before generating invoices.');
      return;
    }
    const amount = Number(bulkAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid amount.');
      return;
    }
    setIsBulkSubmitting(true);
    try {
      await apiClient.post('/invoices/bulk/school-term', {
        productId: bulkProductId,
        unitPrice: amount,
        issueDate: startDate || new Date().toISOString().slice(0, 10),
      });
      await refetch();
    } finally {
      setIsBulkSubmitting(false);
    }
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
            <option value="Partial">Partial</option>
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

      {isSchool && (
        <Card className="border-dashed border-emerald-300 bg-emerald-50/40 p-3 text-xs">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-emerald-900">
              Bulk Invoicing – Term Fees
            </div>
            <div className="text-[0.7rem] text-emerald-800">
              Generate draft invoices for all students for a selected fee.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Fee name or code (e.g. TERM1-FEE)"
              value={bulkProductId}
              onChange={(e) => setBulkProductId(e.target.value)}
              className="w-64"
            />
            <Input
              placeholder="Amount (KES)"
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value)}
              className="w-32"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={isBulkSubmitting}
              onClick={handleBulkSchoolInvoices}
            >
              {isBulkSubmitting ? 'Generating...' : 'Generate for All Students'}
            </Button>
          </div>
        </Card>
      )}

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