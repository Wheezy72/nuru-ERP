import * as React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/DataTable';

type Employee = {
  id: string;
  name: string;
  phone: string | null;
  dailyRate: number;
  role: 'CASUAL' | 'PERMANENT';
};

type EmployeeListResponse = {
  items: Employee[];
};

export function PayCasualsPage() {
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 25,
  });
  const [selection, setSelection] = React.useState<Record<string, number>>({});
  const [channel, setChannel] = React.useState<'CASH' | 'MPESA'>('CASH');

  const { data, isLoading } = useQuery({
    queryKey: ['payrollEmployees'],
    queryFn: async () => {
      const res = await apiClient.get<EmployeeListResponse>('/payroll/employees');
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const items = data?.items ?? [];
      const entries = items
        .filter((e) => selection[e.id] && selection[e.id] > 0)
        .map((e) => ({
          employeeId: e.id,
          daysWorked: selection[e.id],
          channel,
        }));

      const res = await apiClient.post('/payroll/runs', { entries });
      return res.data as { totalAmount: number; count: number };
    },
  });

  const employees = data?.items ?? [];
  const totalRows = employees.length;
  const pageCount =
    totalRows === 0 ? 1 : Math.ceil(totalRows / pagination.pageSize);

  const paged = React.useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    const end = start + pagination.pageSize;
    return employees.slice(start, end);
  }, [employees, pagination]);

  const columns: ColumnDef<Employee>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'role',
      header: 'Role',
    },
    {
      accessorKey: 'dailyRate',
      header: 'Daily Rate',
      cell: ({ getValue }) =>
        getValue<number>().toLocaleString(undefined, {
          style: 'currency',
          currency: 'KES',
          maximumFractionDigits: 0,
        }),
    },
    {
      id: 'days',
      header: 'Days Worked',
      cell: ({ row }) => {
        const id = row.original.id;
        const value = selection[id] ?? 1;
        return (
          <input
            type="number"
            min={1}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs"
            value={value}
            onChange={(e) => {
              const v = parseInt(e.target.value || '0', 10);
              setSelection((prev) => ({ ...prev, [id]: v }));
            }}
          />
        );
      },
    },
  ];

  const handleProcess = async () => {
    if (mutation.isLoading) return;
    await mutation.mutateAsync();
  };

  const totalSelected = Object.values(selection).reduce(
    (acc, v) => acc + (v > 0 ? 1 : 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Pay Casuals</h1>
          <p className="text-xs text-muted-foreground">
            Select loaders, turnboys, and other casual staff, enter days
            worked, and record payouts.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Channel:</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value === 'MPESA' ? 'MPESA' : 'CASH')
              }
            >
              <option value="CASH">Cash payout</option>
              <option value="MPESA">M-Pesa (recorded)</option>
            </select>
          </div>
          {mutation.data && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[0.7rem] font-medium text-emerald-700">
              Last run: {mutation.data.count} staff,{' '}
              {mutation.data.totalAmount.toLocaleString(undefined, {
                style: 'currency',
                currency: 'KES',
                maximumFractionDigits: 0,
              })}
            </span>
          )}
        </div>
      </div>

      <Card className="p-4">
        <DataTable
          columns={columns}
          data={paged}
          pageCount={pageCount}
          totalRows={totalRows}
          state={pagination}
          onStateChange={setPagination}
          isLoading={isLoading}
          onBulkAction={(rows) => {
            const next: Record<string, number> = { ...selection };
            rows.forEach((row) => {
              next[row.original.id] = next[row.original.id] || 1;
            });
            setSelection(next);
          }}
          bulkActionLabel="Select for payment"
        />
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
          <div className="text-muted-foreground">
            {totalSelected > 0
              ? `${totalSelected} staff selected for payment`
              : 'Select staff and enter days worked, then process payment.'}
          </div>
          <Button
            size="sm"
            disabled={mutation.isLoading || totalSelected === 0}
            onClick={handleProcess}
          >
            {mutation.isLoading ? 'Processing...' : 'Process Payment'}
          </Button>
        </div>
      </Card>
    </div>
  );
}