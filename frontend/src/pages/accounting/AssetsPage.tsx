import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Asset = {
  id: string;
  name: string;
  purchaseDate: string;
  purchaseCost: string;
  accumulatedDepreciation: string;
  netBookValue: number;
};

type DepreciationRun = {
  id: string;
  period: string;
  runAt: string;
};

type RunResponse = {
  totalDepreciation: number;
  run: DepreciationRun;
};

export function AssetsPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = React.useState('');

  const assetsQuery = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const res = await apiClient.get<Asset[]>('/accounting/assets');
      return res.data;
    },
  });

  const runsQuery = useQuery({
    queryKey: ['depreciationRuns'],
    queryFn: async () => {
      const res = await apiClient.get<DepreciationRun[]>(
        '/accounting/depreciation-runs',
      );
      return res.data;
    },
  });

  const runMutation = useMutation({
    mutationFn: async (p: string) => {
      const res = await apiClient.post<RunResponse>(
        '/accounting/depreciation/run',
        { period: p },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['depreciationRuns'] });
    },
  });

  const assets = assetsQuery.data ?? [];
  const runs = runsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">
          Assets & Depreciation
        </h1>
        <div className="flex items-center gap-2 text-xs">
          <Input
            placeholder="Period (YYYY-MM)"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-32"
          />
          <Button
            size="sm"
            disabled={runMutation.isLoading || !period}
            onClick={async () => {
              try {
                await runMutation.mutateAsync(period);
              } catch (err: any) {
                alert(
                  err?.response?.data?.message ||
                    'Failed to run depreciation for period.',
                );
              }
            }}
          >
            {runMutation.isLoading ? 'Running...' : 'Run Depreciation'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 text-xs">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Asset Register
          </div>
          {assetsQuery.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : assets.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No assets yet. Add assets via the backend or admin tools.
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-auto">
              {assets.map((asset) => {
                const cost = Number(asset.purchaseCost);
                const accum = Number(asset.accumulatedDepreciation);
                return (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between rounded-md bg-background px-3 py-2"
                  >
                    <div>
                      <div className="text-[0.8rem] font-medium text-foreground">
                        {asset.name}
                      </div>
                      <div className="text-[0.7rem] text-muted-foreground">
                        Purchased {new Date(asset.purchaseDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right text-[0.7rem]">
                      <div>Cost: {cost.toLocaleString()}</div>
                      <div>
                        Accum: {accum.toLocaleString()}
                      </div>
                      <div className="font-semibold text-emerald-700">
                        NBV: {asset.netBookValue.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 text-xs">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Depreciation Runs
          </div>
          {runsQuery.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : runs.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No depreciation runs have been recorded yet.
            </div>
          ) : (
            <div className="max-h-80 space-y-1 overflow-auto">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-md bg-background px-3 py-2"
                >
                  <span className="text-[0.8rem] font-medium">{run.period}</span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    {new Date(run.runAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}