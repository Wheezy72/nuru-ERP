import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type Coupon = {
  id: string;
  code: string;
  description?: string | null;
  percentageOff?: string | null;
  amountOff?: string | null;
  active: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  maxUses?: number | null;
  usedCount: number;
  minSubtotal?: string | null;
  createdAt: string;
};

type CouponListResponse = {
  items: Coupon[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function CouponsPage() {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 25 });
  const [search, setSearch] = React.useState('');
  const [showActiveOnly, setShowActiveOnly] = React.useState(true);

  const [code, setCode] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [percentageOff, setPercentageOff] = React.useState('');
  const [amountOff, setAmountOff] = React.useState('');
  const [minSubtotal, setMinSubtotal] = React.useState('');
  const [validFrom, setValidFrom] = React.useState('');
  const [validTo, setValidTo] = React.useState('');
  const [maxUses, setMaxUses] = React.useState('');

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['coupons', pagination, search, showActiveOnly],
    queryFn: async () => {
      const res = await apiClient.get<CouponListResponse>('/coupons', {
        params: {
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
          search: search || undefined,
          active: showActiveOnly ? 'true' : undefined,
        },
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!code.trim()) {
        throw new Error('Coupon code is required');
      }
      if (!percentageOff && !amountOff) {
        throw new Error('Provide percentage or amount');
      }
      const pct = percentageOff ? Number(percentageOff) / 100 : undefined;
      const amt = amountOff ? Number(amountOff) : undefined;
      const minSub = minSubtotal ? Number(minSubtotal) : undefined;
      const max = maxUses ? Number(maxUses) : undefined;

      await apiClient.post('/coupons', {
        code,
        description: description || undefined,
        percentageOff: pct,
        amountOff: amt,
        minSubtotal: minSub,
        maxUses: max,
        active: true,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      });
    },
    onSuccess: async () => {
      setCode('');
      setDescription('');
      setPercentageOff('');
      setAmountOff('');
      setMinSubtotal('');
      setValidFrom('');
      setValidTo('');
      setMaxUses('');
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync();
      alert('Coupon created.');
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to create coupon.',
      );
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Coupons &amp; Discounts
          </h1>
          <p className="text-xs text-muted-foreground">
            Create simple coupons for promotions, loyalty, and goodwill.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Input
            placeholder="Search coupons..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="w-48"
          />
          <label className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
            <Checkbox
              checked={showActiveOnly}
              onCheckedChange={(v) => setShowActiveOnly(Boolean(v))}
            />
            Active only
          </label>
        </div>
      </div>

      <Card className="p-4 text-xs space-y-3">
        <div className="text-[0.8rem] font-semibold text-foreground">
          New Coupon
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Code (what cashiers enter)
            </div>
            <Input
              placeholder="e.g. FUNDIS10"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="text-[0.7rem] text-muted-foreground">Label</div>
            <Input
              placeholder="e.g. Fundis discount 10% on tools"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              % off or amount off (KES)
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="%"
                value={percentageOff}
                onChange={(e) => setPercentageOff(e.target.value)}
                className="w-16"
              />
              <Input
                placeholder="KES"
                value={amountOff}
                onChange={(e) => setAmountOff(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Min subtotal (KES)
            </div>
            <Input
              placeholder="Optional"
              value={minSubtotal}
              onChange={(e) => setMinSubtotal(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Max uses (per code)
            </div>
            <Input
              placeholder="Unlimited"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Valid from
            </div>
            <Input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">Valid to</div>
            <Input
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createMutation.isLoading}
          >
            {createMutation.isLoading ? 'Creating...' : 'Create Coupon'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 text-xs">
        <div className="mb-2 text-[0.8rem] font-semibold text-foreground">
          Existing Coupons
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-xs text-muted-foreground">
              Loading coupons...
            </div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No coupons defined yet.
            </div>
          ) : (
            <table className="w-full text-[0.75rem]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-2 py-1 text-left font-medium">Code</th>
                  <th className="px-2 py-1 text-left font-medium">Description</th>
                  <th className="px-2 py-1 text-right font-medium">Value</th>
                  <th className="px-2 py-1 text-right font-medium">Min Subtotal</th>
                  <th className="px-2 py-1 text-right font-medium">Usage</th>
                  <th className="px-2 py-1 text-left font-medium">Window</th>
                  <th className="px-2 py-1 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const pct =
                    c.percentageOff != null
                      ? `${(Number(c.percentageOff) * 100).toFixed(0)}%`
                      : null;
                  const amt =
                    c.amountOff != null
                      ? `KES ${Number(c.amountOff).toLocaleString()}`
                      : null;
                  const value = [pct, amt].filter(Boolean).join(' + ') || '-';
                  const minSub =
                    c.minSubtotal != null
                      ? `KES ${Number(c.minSubtotal).toLocaleString()}`
                      : '-';
                  const windowParts = [];
                  if (c.validFrom) {
                    windowParts.push(
                      `from ${new Date(c.validFrom).toLocaleDateString()}`,
                    );
                  }
                  if (c.validTo) {
                    windowParts.push(
                      `to ${new Date(c.validTo).toLocaleDateString()}`,
                    );
                  }
                  const windowLabel =
                    windowParts.length > 0 ? windowParts.join(' ') : 'Any time';
                  const usage =
                    c.maxUses != null
                      ? `${c.usedCount}/${c.maxUses}`
                      : `${c.usedCount}`;
                  return (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="px-2 py-1 font-semibold text-foreground">
                        {c.code}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {c.description || '-'}
                      </td>
                      <td className="px-2 py-1 text-right">{value}</td>
                      <td className="px-2 py-1 text-right">{minSub}</td>
                      <td className="px-2 py-1 text-right">{usage}</td>
                      <td className="px-2 py-1 text-left">{windowLabel}</td>
                      <td className="px-2 py-1 text-left">
                        {c.active ? (
                          <span className="text-emerald-700">Active</span>
                        ) : (
                          <span className="text-slate-500">Inactive</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}