import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useTenantFeatures,
  RoleVisibility,
  TenantFeatures,
} from '@/hooks/useTenantFeatures';
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

type TaxBucket = {
  taxable: number;
  tax: number;
};

type TaxLiability = {
  totalTax: number;
  vat16: TaxBucket;
  vat8: TaxBucket;
  exempt: { amount: number };
  zeroRated: { amount: number };
};

type Debtor = {
  invoiceId: string;
  invoiceNo: string;
  customerName: string;
  status: string;
  balanceDue: number;
};

type RiskSignals = {
  nuruScore: number;
  windowDays: number;
  manualPayments: number;
  stockVariances: number;
  voidLikeDiscounts: number;
  trainingInvoices: number;
  shiftVariances?: number;
};

type DashboardSummary = {
  metrics: DashboardMetrics;
  cashFlow: CashFlow;
  chamaTrust: ChamaTrust;
  stockAlerts: StockAlert[];
  insights: Insight[];
  taxLiability: TaxLiability;
  debtors: Debtor[];
  risk: RiskSignals;
};

function getRoleVisibility(features?: TenantFeatures): RoleVisibility {
  if (typeof window === 'undefined') {
    return {};
  }

  const raw = window.localStorage.getItem('auth_role') as
    | 'ADMIN'
    | 'MANAGER'
    | 'CASHIER'
    | null;

  const base: RoleVisibility =
    raw === 'CASHIER'
      ? {
          canViewDailyTotals: false,
          canViewDebtors: false,
          canViewMargins: false,
          canViewGLReports: false,
        }
      : {
          canViewDailyTotals: true,
          canViewDebtors: true,
          canViewMargins: raw === 'ADMIN',
          canViewGLReports: raw === 'ADMIN',
        };

  if (!features || !features.roleVisibility || !raw) {
    return base;
  }

  const fromTenant = features.roleVisibility[
    raw as keyof NonNullable<TenantFeatures['roleVisibility']>
  ] as RoleVisibility | undefined;

  if (!fromTenant) {
    return base;
  }

  return {
    ...base,
    ...fromTenant,
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: features } = useTenantFeatures();
  const roleVisibility = getRoleVisibility(features);

  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');
  const [showCustomize, setShowCustomize] = React.useState(false);
  const [visibleCards, setVisibleCards] = React.useState<{
    sales: boolean;
    cash: boolean;
    cashFlow: boolean;
    ai: boolean;
    tax: boolean;
    debtors: boolean;
    chama: boolean;
    stock: boolean;
  }>(() => {
    const defaultState = {
      sales: true,
      cash: true,
      cashFlow: true,
      ai: true,
      tax: true,
      debtors: true,
      chama: true,
      stock: true,
    };
    if (typeof window === 'undefined') {
      return defaultState;
    }
    try {
      const raw = window.localStorage.getItem('dashboard_visible_cards');
      if (!raw) {
        return defaultState;
      }
      return { ...defaultState, ...JSON.parse(raw) };
    } catch {
      return defaultState;
    }
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      'dashboard_visible_cards',
      JSON.stringify(visibleCards)
    );
  }, [visibleCards]);

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

  const taxChartData =
    summary && summary.taxLiability
      ? [
          {
            name: 'VAT 16%',
            value: summary.taxLiability.vat16.tax,
          },
          {
            name: 'VAT 8%',
            value: summary.taxLiability.vat8.tax,
          },
        ].filter((d) => d.value > 0)
      : [];

  const pieColors = ['#16a34a', '#3b82f6'];

  const goToTaxDetails = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString();
    navigate(`/reporting/tax-details${query ? `?${query}` : ''}`);
  };

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
          <Button
            size="sm"
            variant="outline"
            className="ml-2"
            onClick={() => setShowCustomize((prev) => !prev)}
          >
            {showCustomize ? 'Hide Layout' : 'Customize'}
          </Button>
        </div>
      </div>

      {showCustomize && (
        <Card className="border-dashed border-emerald-300 bg-emerald-50/40 p-3 text-xs">
          <div className="mb-2 font-semibold text-emerald-900">
            Customize dashboard
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            {[
              { key: 'sales', label: 'Total Sales' },
              { key: 'cash', label: 'Cash at Hand' },
              { key: 'cashFlow', label: 'Cash Flow' },
              { key: 'ai', label: 'AI Insights' },
              { key: 'tax', label: 'Tax Liability' },
              { key: 'chama', label: 'Chama Trust' },
              { key: 'stock', label: 'Stock Alerts' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-2 text-[0.7rem] text-emerald-900"
              >
                <Checkbox
                  checked={(visibleCards as any)[item.key]}
                  onCheckedChange={(value) =>
                    setVisibleCards((prev) => ({
                      ...prev,
                      [item.key]: !!value,
                    }))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4 auto-rows-[minmax(0,_1fr)]">
        {visibleCards.sales && roleVisibility.canViewDailyTotals !== false && (
          <Card className="col-span-2 p-4 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Total Sales
            </div>
            <div className="mt-2 text-3xl font-semibold text-foreground">
              {isLoading || !summary
                ? '—'
                : summary.metrics.totalSalesToday.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'KES',
                  })}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Posted and paid invoices in selected period
            </div>
          </Card>
        )}

        {visibleCards.cash && roleVisibility.canViewDailyTotals !== false && (
          <Card className="col-span-1 p-4 flex flex-col justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Cash at Hand
            </div>
            <div className="mt-2 text-3xl font-semibold text-foreground">
              {isLoading || !summary
                ? '—'
                : summary.metrics.cashAtHand.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'KES',
                  })}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Sum of current account balances
            </div>
          </Card>
        )}

        <Card className="col-span-1 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
            <span>Nuru Score</span>
            <span className="text-[0.65rem] text-muted-foreground">
              {summary ? `${summary.risk.windowDays}d` : ''}
            </span>
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-3xl font-semibold text-foreground">
              {isLoading || !summary ? '—' : summary.risk.nuruScore}
            </div>
            <div className="flex flex-col text-[0.7rem] text-muted-foreground">
              {summary && (
                <>
                  <span>
                    Manual: {summary.risk.manualPayments.toLocaleString()}
                  </span>
                  <span>
                    Stock var: {summary.risk.stockVariances.toLocaleString()}
                  </span>
                  <span>
                    Shift var:{' '}
                    {(summary.risk.shiftVariances ?? 0).toLocaleString()}
                  </span>
                  <span>
                    Coupons: {summary.risk.voidLikeDiscounts.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            100 = very clean. Drops as manual overrides, stock/shift variances,
            and heavy discounts increase.
          </div>
        </Card>

        {visibleCards.cashFlow && (
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
                    <Bar
                      dataKey="income"
                      name="Income"
                      fill="#16a34a"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="expenses"
                      name="Expenses"
                      fill="#f97316"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  {isLoading ? 'Loading...' : 'No transaction data yet.'}
                </div>
              )}
            </div>
          </Card>
        )}

        {visibleCards.ai && (
          <Card className="md:col-span-2 p-4 flex flex-col">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
              <span>AI Insights</span>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[0.65rem] font-semibold text-emerald-700 shadow-sm">
                ✨
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-auto text-xs">
              {isLoading ? (
                <div className="text-xs text-muted-foreground">
                  Analyzing data...
                </div>
              ) : !summary || summary.insights.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  No insights yet. Add sales, customers, and stock to unlock
                  intelligence.
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
        )}

        {visibleCards.tax && (
          <Card
            className="md:col-span-2 p-4 flex flex-col cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={goToTaxDetails}
          >
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
              <span>Regulator View – eTIMS Tax Liability</span>
              <span className="text-[0.65rem] text-muted-foreground">
                View details →
              </span>
            </div>
            <div className="text-2xl font-semibold text-foreground">
              {isLoading || !summary
                ? '—'
                : summary.taxLiability.totalTax.toLocaleString(undefined, {
                    style: 'currency',
                    currency: 'KES',
                  })}
            </div>
            <div className="mt-1 text-[0.7rem] text-muted-foreground">
              Estimated VAT payable for the selected period.
            </div>
            <div className="mt-3 flex flex-1 flex-col gap-3 md:flex-row">
              <div className="h-24 flex-1">
                {summary && taxChartData && taxChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taxChartData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="#7c3aed"
                        radius={[0, 4, 4, 0]}
                        name="VAT"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[0.7rem] text-muted-foreground">
                    {isLoading ? 'Calculating...' : 'No taxable invoices yet.'}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1 text-[0.7rem]">
                {summary && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        VAT 16% taxable
                      </span>
                      <span className="font-medium">
                        {summary.taxLiability.vat16.taxable.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 0 }
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">VAT 8% taxable</span>
                      <span className="font-medium">
                        {summary.taxLiability.vat8.taxable.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 0 }
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Exempt sales</span>
                      <span className="font-medium">
                        {summary.taxLiability.exempt.amount.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 0 }
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Zero-rated sales
                      </span>
                      <span className="font-medium">
                        {summary.taxLiability.zeroRated.amount.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 0 }
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {visibleCards.chama && (
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
        )}

        {visibleCards.debtors && roleVisibility.canViewDebtors !== false && (
          <Card className="md:col-span-2 p-4 flex flex-col">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
              <span>Debtors</span>
              <span className="text-[0.7rem] text-muted-foreground">
                Customers with outstanding balances
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-auto text-xs">
              {isLoading ? (
                <div className="text-xs text-muted-foreground">Loading...</div>
              ) : !summary || !summary.debtors || summary.debtors.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  No outstanding balances. All invoices are fully paid.
                </div>
              ) : (
                summary.debtors.slice(0, 6).map((debtor) => (
                  <div
                    key={debtor.invoiceId}
                    className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {debtor.customerName}
                      </div>
                      <div className="text-[0.7rem] text-muted-foreground">
                        Invoice {debtor.invoiceNo} • Status {debtor.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-semibold text-amber-700">
                          {debtor.balanceDue.toLocaleString(undefined, {
                            style: 'currency',
                            currency: 'KES',
                          })}
                        </div>
                        <div className="text-[0.7rem] text-muted-foreground">
                          Balance due
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[0.7rem]"
                        onClick={async () => {
                          try {
                            await apiClient.post(
                              `/invoices/${debtor.invoiceId}/remind`,
                              {}
                            );
                            alert('Reminder sent via WhatsApp (if configured).');
                          } catch (err: any) {
                            alert(
                              err?.response?.data?.message ||
                                'Failed to send reminder.'
                            );
                          }
                        }}
                      >
                        Remind
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {visibleCards.stock && (
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
        )}
      </div>
    </div>
  );
}