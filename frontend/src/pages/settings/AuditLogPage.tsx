import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';

type LogUser = {
  id: string;
  email: string | null;
  name: string | null;
};

type SystemLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user: LogUser | null;
};

type SystemLogResponse = {
  items: SystemLog[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function AuditLogPage() {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 50 });

  const { data, isLoading } = useQuery({
    queryKey: ['systemLogs', pagination],
    queryFn: async () => {
      const res = await apiClient.get<SystemLogResponse>('/system/logs', {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        },
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const columns: ColumnDef<SystemLog>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Time',
      cell: ({ getValue }) =>
        new Date(getValue<string>()).toLocaleString(),
    },
    {
      accessorKey: 'user',
      header: 'User',
      cell: ({ row }) => {
        const u = row.original.user;
        if (!u) return 'System';
        return u.name || u.email || u.id;
      },
    },
    { accessorKey: 'action', header: 'Action' },
    { accessorKey: 'entityType', header: 'Entity' },
    { accessorKey: 'entityId', header: 'Record ID' },
  ];

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Audit Log</h1>
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