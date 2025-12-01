import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/DataTable';
import type { ColumnDef } from '@tanstack/react-table';

type TaxInvoiceRow = {
  invoiceId: string;
  invoiceNo: string;
  issueDate: string;
  taxableAmount: number;
  vat16: number;
  vat8: number;
};

type TaxDetailsResponse = {
  items: TaxInvoiceRow[];
  startDate: string;
  endDate: string;
};

export function TaxDetailsPage() {
  const [searchParams] = useSearchParams();
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 25,
  });

  const startDateParam = searchParams.get('startDate') ?? '';
  const endDateParam = searchParams.get('endDate') ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['taxDetails', startDateParam, endDateParam],
    queryFn: async () => {
      const res = await apiClient.get<TaxDetailsResponse>('/reporting/tax-details', {
        params: {
          startDate: startDateParam || undefined,
          endDate: endDateParam || undefined,
        },
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const items = data?.items ?? [];
  const totalRows = items.length;
  const pageCount =
    totalRows === 0 ? 1 : Math.ceil(totalRows / pagination.pageSize);

  const pagedItems = React.useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    const end = start + pagination.pageSize;
    return items.slice(start, end);
  }, [items, pagination]);

  const columns: ColumnDef<TaxInvoiceRow>[] = [
    {
      accessorKey: 'invoiceNo',
      header: 'Invoice #',
    },
    {
      accessorKey: 'issueDate',
      header: 'Date',
      cell: ({ getValue }) =>
        new Date(getValue<string>()).toLocaleDateString(),
    },
    {
      accessorKey: 'taxableAmount',
      header: 'Taxable Amount',
      cell: ({ getValue }) =>
        getValue<number>().toLocaleString(undefined, {
          style: 'currency',
          currency: 'KES',
          maximumFractionDigits: 0,
        }),
    },
    {
      accessorKey: 'vat16',
      header: 'VAT 16%',
      cell: ({ getValue }) =>
        getValue<number>().toLocaleString(undefined, {
          style: 'currency',
          currency: 'KES',
          maximumFractionDigits: 0,
        }),
    },
    {
      accessorKey: 'vat8',
      header: 'VAT 8%',
      cell: ({ getValue }) =>
        getValue<number>().toLocaleString(undefined, {
          style: 'currency',
          currency: 'KES',
          maximumFractionDigits: 0,
        }),
    },
  ];

  const handleDownloadCsv = async () => {
    const response = await apiClient.get('/reporting/tax-csv', {
      responseType: 'blob',
      params: {
        startDate: startDateParam || undefined,
        endDate: endDateParam || undefined,
      },
    });

    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const startLabel = data?.startDate?.slice(0, 10) ?? 'start';
    const endLabel = data?.endDate?.slice(0, 10) ?? 'end';
    link.href = url;
    link.download = `kra_tax_${startLabel}_${endLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const periodLabel =
    data && data.startDate && data.endDate
      ? `${new Date(data.startDate).toLocaleDateString()} → ${new Date(
          data.endDate
        ).toLocaleDateString()}`
      : 'Current period';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Tax Details (eTIMS)
          </h1>
          <p className="text-xs text-muted-foreground">
            All Posted &amp; Paid invoices contributing to VAT for the selected
            period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            Period: {periodLabel}
          </span>
          <Button size="sm" variant="outline" onClick={handleDownloadCsv}>
            Download KRA CSV
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <DataTable
          columns={columns}
          data={pagedItems}
          pageCount={pageCount}
          totalRows={totalRows}
          state={pagination}
          onStateChange={setPagination}
          isLoading={isLoading}
        />
      </Card>
    </div>
  );
}