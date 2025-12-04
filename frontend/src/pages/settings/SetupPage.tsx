import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useTenantFeatures,
  useUpdateTenantFeatures,
  TenantFeatures,
} from '@/hooks/useTenantFeatures';

type FeatureBlock = {
  id: string;
  label: string;
  description: string;
  recommendedFor: string[];
  tags?: string[];
};

type BaseTemplate = {
  id: string;
  label: string;
  description: string;
  recommendedBlocks: string[];
};

type TemplatesMeta = {
  baseTemplates: BaseTemplate[];
  featureBlocks: FeatureBlock[];
};

export function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [selectedBase, setSelectedBase] = React.useState<string | null>(null);
  const [selectedBlocks, setSelectedBlocks] = React.useState<string[]>([]);

  const { data: meta, isLoading } = useQuery({
    queryKey: ['templatesMeta'],
    queryFn: async () => {
      const res = await apiClient.get<TemplatesMeta>('/tenant/templates/meta');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: features } = useTenantFeatures();
  const updateFeatures = useUpdateTenantFeatures();

  const applyMutation = useMutation({
    mutationFn: async (payload: { baseType?: string | null; blocks: string[] }) => {
      await apiClient.post('/tenant/templates/apply', {
        baseType: payload.baseType || undefined,
        blocks: payload.blocks,
      });
    },
    onSuccess: async () => {
      // Refresh features so the rest of the app sees new template info
      await queryClient.invalidateQueries({ queryKey: ['tenantFeatures'] });
    },
  });

  const handleBaseSelect = (baseId: string) => {
    setSelectedBase(baseId);
    if (!meta) return;
    const base = meta.baseTemplates.find((b) => b.id === baseId);
    if (base) {
      setSelectedBlocks(Array.from(new Set([...base.recommendedBlocks])));
    }
    setStep(2);
  };

  const toggleBlock = (blockId: string) => {
    setSelectedBlocks((prev) =>
      prev.includes(blockId)
        ? prev.filter((id) => id !== blockId)
        : [...prev, blockId]
    );
  };

  const handleApply = async () => {
    if (!selectedBlocks.length) {
      alert('Select at least one feature block before seeding.');
      return;
    }
    try {
      await applyMutation.mutateAsync({
        baseType: selectedBase,
        blocks: selectedBlocks,
      });
      alert('Business template seeded successfully.');
      navigate('/inventory/products');
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          'Failed to apply template. Check console and configuration.'
      );
    }
  };

  const baseTemplates = meta?.baseTemplates ?? [];
  const featureBlocks = meta?.featureBlocks ?? [];

  const currentBase = baseTemplates.find((b) => b.id === selectedBase) || null;

  const mode: 'SIMPLE' | 'FULL' =
    (features && (features.mode as 'SIMPLE' | 'FULL')) || 'FULL';

  const cashierVisibility =
    (features &&
      features.roleVisibility &&
      (features.roleVisibility.CASHIER as any)) || {};

  const cashierCanViewDailyTotals =
    typeof cashierVisibility.canViewDailyTotals === 'boolean'
      ? cashierVisibility.canViewDailyTotals
      : false;

  const whatsappSettings = (features && (features.whatsapp as any)) || {};
  const enablePaymentReceipts =
    typeof whatsappSettings.enablePaymentReceipts === 'boolean'
      ? whatsappSettings.enablePaymentReceipts
      : true;
  const enableRiskAlerts =
    typeof whatsappSettings.enableRiskAlerts === 'boolean'
      ? whatsappSettings.enableRiskAlerts
      : false;

  const handleModeChange = (nextMode: 'SIMPLE' | 'FULL') => {
    const patch: Partial<TenantFeatures> = { mode: nextMode };
    updateFeatures.mutate(patch);
  };

  const toggleCashierDailyTotals = () => {
    const currentVisibility = (features?.roleVisibility as any) || {};
    const nextVisibility = {
      ...currentVisibility,
      CASHIER: {
        ...currentVisibility.CASHIER,
        canViewDailyTotals: !cashierCanViewDailyTotals,
      },
    };
    updateFeatures.mutate({ roleVisibility: nextVisibility });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Business Setup
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure your core modules, display mode, and permissions.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={
              step === 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'
            }
          >
            1. Base type
          </span>
          <span>›</span>
          <span
            className={
              step === 2 ? 'font-semibold text-foreground' : 'text-muted-foreground'
            }
          >
            2. Feature blocks
          </span>
          <span>›</span>
          <span
            className={
              step === 3 ? 'font-semibold text-foreground' : 'text-muted-foreground'
            }
          >
            3. Seed
          </span>
        </div>
      </div>

      {/* Display, Permissions & Alerts */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <div className="text-[0.8rem] font-semibold text-foreground">
              Display, Permissions & Alerts
            </div>
            <div className="text-[0.7rem] text-muted-foreground">
              Choose Simple vs Full mode, cashier visibility, and WhatsApp alerts.
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3 text-xs">
          <div className="space-y-2">
            <div className="text-[0.75rem] font-semibold text-foreground">
              Interface mode
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={mode === 'SIMPLE' ? 'default' : 'outline'}
                onClick={() => handleModeChange('SIMPLE')}
              >
                Simple (solo business)
              </Button>
              <Button
                size="sm"
                variant={mode === 'FULL' ? 'default' : 'outline'}
                onClick={() => handleModeChange('FULL')}
              >
                Full (team / accountant)
              </Button>
            </div>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              Simple mode hides advanced modules (Maker, Planner, Banking, Settings)
              for non-admin roles.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-[0.75rem] font-semibold text-foreground">
              Cashier visibility
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[0.7rem] text-muted-foreground">
              <Checkbox
                checked={cashierCanViewDailyTotals}
                onCheckedChange={toggleCashierDailyTotals}
              />
              <span>
                Allow cashiers to see today&apos;s total sales and cash on the dashboard
              </span>
            </label>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              Turn this off if you prefer cashiers to focus on their till only, while
              managers/admins see overall performance.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-[0.75rem] font-semibold text-foreground">
              WhatsApp alerts
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[0.7rem] text-muted-foreground">
              <Checkbox
                checked={enablePaymentReceipts}
                onCheckedChange={() =>
                  updateFeatures.mutate({
                    whatsapp: {
                      ...whatsappSettings,
                      enablePaymentReceipts: !enablePaymentReceipts,
                    },
                  })
                }
              />
              <span>Send WhatsApp receipts after payments (M-Pesa, card, manual)</span>
            </label>
            <label className="mt-1 flex cursor-pointer items-center gap-2 text-[0.7rem] text-muted-foreground">
              <Checkbox
                checked={enableRiskAlerts}
                onCheckedChange={() =>
                  updateFeatures.mutate({
                    whatsapp: {
                      ...whatsappSettings,
                      enableRiskAlerts: !enableRiskAlerts,
                    },
                  })
                }
              />
              <span>Send a short risk alert to admins when the Nuru Score drops</span>
            </label>
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="text-xs text-muted-foreground">Loading templates...</div>
      )}

      {!isLoading && step === 1 && (
        <Card className="p-4">
          <div className="mb-3 text-xs text-muted-foreground">
            Step 1 – Pick your primary business type. You can still add other
            modules in the next step.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {baseTemplates.map((base) => (
              <button
                key={base.id}
                type="button"
                onClick={() => handleBaseSelect(base.id)}
                className="flex flex-col items-start rounded-md border border-border bg-background px-4 py-3 text-left text-xs shadow-sm hover:border-emerald-400 hover:shadow-md"
              >
                <div className="mb-1 text-[0.8rem] font-semibold text-foreground">
                  {base.label}
                </div>
                <div className="text-[0.7rem] text-muted-foreground">
                  {base.description}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {!isLoading && step === 2 && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-muted-foreground">
              Step 2 – What else do you sell?
            </div>
            {currentBase && (
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-[0.7rem] font-medium text-emerald-800">
                Base type: {currentBase.label}
              </div>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {featureBlocks.map((block) => {
              const selected = selectedBlocks.includes(block.id);
              const recommended =
                currentBase?.recommendedBlocks.includes(block.id) ?? false;
              return (
                <label
                  key={block.id}
                  className="flex cursor-pointer gap-3 rounded-md border border-border bg-background px-3 py-2 text-xs hover:border-emerald-400 hover:shadow-sm"
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleBlock(block.id)}
                    className="mt-1"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.8rem] font-semibold text-foreground">
                        {block.label}
                      </span>
                      {recommended && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6rem] font-medium text-emerald-700">
                          Suggested
                        </span>
                      )}
                    </div>
                    <div className="text-[0.7rem] text-muted-foreground">
                      {block.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex justify-between text-xs">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={() => setStep(3)}
              disabled={selectedBlocks.length === 0}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {!isLoading && step === 3 && (
        <Card className="p-4">
          <div className="mb-3 text-xs text-muted-foreground">
            Step 3 – Confirm your mix. We will create UoMs and products for this
            tenant. You can edit or rename them later in Inventory.
          </div>
          <div className="mb-3 space-y-1 text-xs">
            <div>
              <span className="font-semibold text-foreground">Base type: </span>
              <span className="text-muted-foreground">
                {currentBase ? currentBase.label : 'Generic'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-foreground">
                Feature blocks:
              </span>
              <ul className="mt-1 list-disc pl-5 text-[0.7rem] text-muted-foreground">
                {selectedBlocks.map((blockId) => {
                  const block = featureBlocks.find((b) => b.id === blockId);
                  return (
                    <li key={blockId}>{block?.label ?? blockId}</li>
                  );
                })}
              </ul>
            </div>
          </div>
          <div className="flex justify-between text-xs">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStep(2)}
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={applyMutation.isLoading}
            >
              {applyMutation.isLoading ? 'Seeding...' : 'Seed my business'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}