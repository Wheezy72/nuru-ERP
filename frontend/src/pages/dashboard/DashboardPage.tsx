import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type DashboardMetrics = {
  totalSalesToday: number;
  cashAtHand: number;
};

type CashFlow = {
  days: string[];
  income: number[];
  expenses: number[];
};

type ChamaTrust = {
  potSize: number;
  loansIssued: number;
};

type StockAlert = {
  productName: string;
  quantity: number;
  minQuantity: number;
  uomName: string;
};

type Insight = {
  type: 'RISK' | 'WARNING' | 'OPPORTUNITY';
  title: string;
  detail: string;
};

type DashboardSummary = {
  metrics: DashboardMetrics;
  cashFlow: CashFlow;
  chamaTrust: ChamaTrust;
  stockAlerts: StockAlert[];
  insights: Insight[];
};

export function DashboardPage() {
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboardSummary', startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get<DashboardSummary>('/dashboard/summary', {
        params: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const summary = data;

  const cashFlowData =
    summary &&
    summary.cashFlow.days.map((day, idx) => ({
      day,
      income: summary.cashFlow.income[idx],
      expenses: summary.cashFlow.expenses[idx],
    }));

  const chamaData = summary
    ? [
        { name: 'Pot Size', value: summary.chamaTrust.potSize },
        { name: 'Loans Issued', value: summary.chamaTrust.loansIssued },
      ]
    : [];

  const pieColors = ['#16a34a', '#3b82f6'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Overview</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Period:</span>
          <input
            type="date"
            className="h-8 rounded-md border border-input bg-background px-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span>to</span>
          <input
            type="date"
            className="h-8 rounded-md border border-input bg-background px-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 auto-rows-[minmax(0,_1fr)]">
        <Card className="col-span-2 p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Total Sales
          </div>
          <div className="mt-2 text-3xl font-semibold text-foreground">
            {isLoading || !summary
              ? '—'
              : summary.metrics.totalSalesToday.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'USD',
                })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Posted and paid invoices in selected period
          </div>
        </Card>

        <Card className="col-span-2 p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Cash at Hand
          </div>
          <div className="mt-2 text-3xl font-semibold text-foreground">
            {isLoading || !summary
              ? '—'
              : summary.metrics.cashAtHand.toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'USD',
                })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Sum of current account balances
          </div>
        </Card>

        <Card className="md:col-span-2 md:row-span-2 p-4 flex flex-col">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Cash Flow
          </div>
          <div className="flex-1">
            {cashFlowData && cashFlowData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData}>
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#16a34a" />
                  <Bar dataKey="expenses" name="Expenses" fill="#64748b" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {isLoading ? 'Loading...' : 'No transaction data yet.'}
              </div>
            )}
          </div>
        </Card>

        <Card className="md:col-span-2 p-4 flex flex-col">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
            <span>AI Insights</span>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[0.65rem] font-semibold text-emerald-700 shadow-sm">
              ✨
            </span>
          </div>
          <div className="flex-1 space-y-2 overflow-auto text-xs">
            {isLoading ? (
              <div className="text-xs text-muted-foreground">Analyzing data...</div>
            ) : !summary || summary.insights.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No insights yet. Add sales, customers, and stock to unlock intelligence.
              </div>
            ) : (
              summary.insights.slice(0, 3).map((insight, idx) => {
                let colorClass =
                  insight.type === 'RISK'
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : insight.type === 'WARNING'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800';

                return (
                  <div
                    key={idx}
                    className={`rounded-md border px-3 py-2 shadow-sm ${colorClass}`}
                  >
                    <div className="text-[0.7rem] font-semibold uppercase tracking-wide">
                      {insight.title}
                    </div>
                    <div className="mt-1 text-[0.7rem] leading-snug">
                      {insight.detail}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="md:col-span-1 p-4 flex flex-col">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Chama Trust
          </div>
          <div className="flex-1">
            {chamaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chamaData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    label
                  >
                    {chamaData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {isLoading ? 'Loading...' : 'No Chama data yet.'}
              </div>
            )}
          </div>
        </Card>

        <Card className="md:col-span-2 p-4 flex flex-col">
          <div className="mb-2 text-sm font-semibold text-foreground">
            Stock Alerts
          </div>
          <div className="flex-1 space-y-2 overflow-auto">
            {isLoading ? (
              <div className="text-xs text-muted-foreground">Loading...</div>
            ) : !summary || summary.stockAlerts.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No stock alerts. All items above minimum levels.
              </div>
            ) : (
              summary.stockAlerts.map((alert) => (
                <div
                  key={alert.productName}
                  className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-medium text-foreground">
                      {alert.productName}
                    </div>
                    <div className="text-[0.7rem] text-muted-foreground">
                      Minimum {alert.minQuantity} {alert.uomName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-rose-600">
                      {alert.quantity.toLocaleString()} {alert.uomName}
                    </div>
                    <div className="text-[0.7rem] text-muted-foreground">
                      Below minimum
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}