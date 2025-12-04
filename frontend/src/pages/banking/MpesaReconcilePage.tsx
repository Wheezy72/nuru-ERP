import * as React from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type MpesaReconcileRow = {
  transactionId: string;
  amount: number;
  accountReference?: string;
  msisdn?: string;
  timestamp?: string;
};

type MpesaReconcileItem = {
  row: MpesaReconcileRow;
  status: 'matched' | 'skipped' | 'unmatched';
  reason?: string;
  invoiceId?: string;
};

type MpesaReconcileResponse = {
  items: MpesaReconcileItem[];
};

export function MpesaReconcilePage() {
  const [csvText, setCsvText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<MpesaReconcileResponse | null>(
    null,
  );

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setResult(null);
  };

  const handleRun = async () => {
    if (!csvText.trim()) {
      alert('Select a CSV file first.');
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      const res = await apiClient.post<MpesaReconcileResponse>(
        '/payments/mpesa/reconcile',
        {
          csv: csvText,
        },
      );
      setResult(res.data);
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Reconciliation failed. Check your file and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const items = result?.items ?? [];
  const matched = items.filter((i) => i.status === 'matched').length;
  const skipped = items.filter((i) => i.status === 'skipped').length;
  const unmatched = items.filter((i) => i.status === 'unmatched').length;

  const unmatchedItems = items.filter((i) => i.status === 'unmatched').slice(
    0,
    50,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            M-Pesa Reconciliation
          </h1>
          <p className="text-xs text-muted-foreground">
            Upload a statement exported from M-Pesa (CSV) to match payments to
            invoices.
          </p>
        </div>
      </div>

      <Card className="p-4 text-xs space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2">
            <div className="text-[0.7rem] text-muted-foreground">
              M-Pesa CSV file
            </div>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
            />
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              Use the standard M-Pesa statement export. The system will attempt
              to read columns like transaction ID, amount, and account
              reference.
            </p>
          </div>
          <div className="flex items-end justify-end">
            <Button
              size="sm"
              disabled={isSubmitting || !csvText.trim()}
              onClick={handleRun}
            >
              {isSubmitting ? 'Reconciling...' : 'Run Reconciliation'}
            </Button>
          </div>
        </div>

        {result && (
          <div className="mt-4 space-y-2 border-t border-border pt-3 text-[0.7rem]">
            <div className="font-semibold text-foreground">
              Result summary:
            </div>
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              <span>Total rows: {items.length}</span>
              <span>Matched: {matched}</span>
              <span>Skipped: {skipped}</span>
              <span>Unmatched: {unmatched}</span>
            </div>

            {unmatchedItems.length > 0 && (
              <div className="mt-2 max-h-52 overflow-auto rounded-md bg-muted px-2 py-2">
                <div className="mb-1 text-[0.7rem] font-semibold text-foreground">
                  Unmatched rows (first {unmatchedItems.length}):
                </div>
                {unmatchedItems.map((item, idx) => (
                  <div key={`${item.row.transactionId}-${idx}`}>
                    <span className="font-medium">
                      {item.row.transactionId} – KES {item.row.amount}
                    </span>
                    {item.row.accountReference && (
                      <span className="ml-1 text-muted-foreground">
                        (Ref: {item.row.accountReference})
                      </span>
                    )}
                    {item.reason && (
                      <span className="ml-2 text-amber-700">
                        [{item.reason}]
                      </span>
                    )}
                  </div>
                ))}
                {unmatched > unmatchedItems.length && (
                  <div className="mt-1 text-muted-foreground">
                    + {unmatched - unmatchedItems.length} more unmatched row(s)…
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}