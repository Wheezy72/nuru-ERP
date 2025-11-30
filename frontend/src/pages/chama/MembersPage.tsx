import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Member = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type MemberListResponse = {
  items: Member[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function MembersPage() {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 });
  const [search, setSearch] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['members', pagination, search],
    queryFn: async () => {
      const res = await apiClient.get<MemberListResponse>('/chama/members', {
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

  const columns: ColumnDef<Member>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
  ];

  const items = data?.items ?? [];

  const exportStatement = async (memberId: string) => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const response = await apiClient.get('/reporting/chama/statement', {
      responseType: 'blob',
      params: {
        memberId,
        startDate: start,
        endDate: end,
      },
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `member_statement_${memberId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Members</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="w-64"
          />
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
            if (!rows.length) return;
            exportStatement(rows[0].id);
          }}
          bulkActionLabel="Export Statement"
        />
      </Card>
    </div>
  );
}