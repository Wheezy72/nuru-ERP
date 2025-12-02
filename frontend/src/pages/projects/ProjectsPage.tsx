import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { apiClient } from '@/lib/apiClient';
import { DataTable } from '@/components/DataTable';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Project = {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string | null;
};

type ProjectListResponse = {
  items: Project[];
};

type ProjectSummary = {
  projectId: string;
  name: string;
  code: string;
  revenue: number;
  cost: number;
  profit: number;
};

/**
 * ProjectsPage
 *
 * Planner UI for:
 * - Listing projects.
 * - Creating basic projects.
 * - Viewing a simple profitability summary (revenue vs cost).
 */
export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get<ProjectListResponse>('/projects');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const summaryQuery = useQuery({
    queryKey: ['project-summary', selectedProjectId],
    enabled: !!selectedProjectId,
    queryFn: async () => {
      const res = await apiClient.get<ProjectSummary>(
        `/projects/${selectedProjectId}/summary`,
      );
      return res.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      code: string;
      startDate: string;
      endDate?: string;
    }) => {
      await apiClient.post('/projects', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const projects = data?.items ?? [];

  const columns: ColumnDef<Project>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'startDate', header: 'Start' },
    {
      accessorKey: 'endDate',
      header: 'End',
      cell: ({ getValue }) => getValue<string | null>() || '-',
    },
    {
      id: 'actions',
      header: 'Summary',
      cell: ({ row }) => {
        const project = row.original;
        return (
          <Button
            size="sm"
            variant={selectedProjectId === project.id ? 'default' : 'outline'}
            className="h-7 px-2 text-[0.7rem]"
            onClick={() => setSelectedProjectId(project.id)}
          >
            View
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">
          Projects – Job Profitability
        </h1>
      </div>

      <CreateProjectCard
        onCreated={async () => {
          await queryClient.invalidateQueries({ queryKey: ['projects'] });
        }}
        mutation={mutation}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Projects
          </div>
          <DataTable
            columns={columns}
            data={projects}
            pageCount={1}
            totalRows={projects.length}
            state={{ pageIndex: 0, pageSize: projects.length || 10 }}
            onStateChange={() => {}}
            isLoading={isLoading}
          />
        </Card>

        <Card className="p-4 text-xs">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Project Summary
          </div>
          {!selectedProjectId ? (
            <div className="text-xs text-muted-foreground">
              Select a project to see revenue, cost, and profit.
            </div>
          ) : summaryQuery.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : !summaryQuery.data ? (
            <div className="text-xs text-muted-foreground">
              No summary available.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium">
                  {summaryQuery.data.revenue.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'KES',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cost</span>
                <span className="font-medium">
                  {summaryQuery.data.cost.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'KES',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Profit</span>
                <span
                  className={
                    summaryQuery.data.profit >= 0
                      ? 'font-semibold text-emerald-700'
                      : 'font-semibold text-rose-700'
                  }
                >
                  {summaryQuery.data.profit.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'KES',
                  })}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

type CreateProjectCardProps = {
  onCreated: () => void;
  mutation: ReturnType<typeof useMutation>;
};

function CreateProjectCard({ onCreated, mutation }: CreateProjectCardProps) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  return (
    <Card className="border-dashed border-emerald-300 bg-emerald-50/40 p-3 text-xs">
      <div className="mb-2 font-semibold text-emerald-900">New Project</div>
      <div className="grid gap-2 md:grid-cols-4">
        <Input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Input
          type="date"
          placeholder="Start Date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          type="date"
          placeholder="End Date (optional)"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          className="text-[0.7rem]"
          disabled={mutation.isLoading}
          onClick={async () => {
            if (!name || !code || !startDate) {
              alert('Name, code and start date are required');
              return;
            }
            try {
              await mutation.mutateAsync({
                name,
                code,
                startDate,
                endDate: endDate || undefined,
              } as any);
              setName('');
              setCode('');
              setStartDate('');
              setEndDate('');
              onCreated();
            } catch (err: any) {
              alert(
                err?.response?.data?.message ||
                  'Failed to create project. Check fields and try again.',
              );
            }
          }}
        >
          {mutation.isLoading ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </Card>
  );
}