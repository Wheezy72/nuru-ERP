import * as React from 'react';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

type ImportResult = {
  total: number;
  created: number;
  updated: number;
  errors: { index: number; message: string }[];
};

type ImportType = 'customers' | 'products';

export function ImportPage() {
  const [importType, setImportType] = React.useState<ImportType>('customers');
  const [csvText, setCsvText] = React.useState('');
  const [dryRun, setDryRun] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!csvText.trim()) {
      alert('Select a CSV file first.');
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      const endpoint =
        importType === 'customers' ? '/import/customers' : '/import/products';
      const res = await apiClient.post<ImportResult>(endpoint, {
        csv: csvText,
        dryRun,
      });
      setResult(res.data);
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Import failed. Check your file and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const sampleHeaders =
    importType === 'customers'
      ? 'name,phone,email,kraPin'
      : 'name,sku,category,defaultUom,defaultPrice,minStockQuantity';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Import Data
          </h1>
          <p className="text-xs text-muted-foreground">
            Paste or upload a simple CSV file to bulk-create or update records.
          </p>
        </div>
      </div>

      <Card className="p-4 text-xs space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Import type
            </div>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={importType}
              onChange={(e) =>
                setImportType(e.target.value as ImportType)
              }
            >
              <option value="customers">Customers / Students</option>
              <option value="products">Products / Fees</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="text-[0.7rem] text-muted-foreground">
              CSV file
            </div>
            <Input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              Expected header row: <code>{sampleHeaders}</code>
            </p>
          </div>
          <div className="space-y-1">
            <div className="text-[0.7rem] text-muted-foreground">
              Options
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={dryRun}
                onCheckedChange={(v) => setDryRun(Boolean(v))}
              />
              <span className="text-[0.7rem]">
                Dry run only (validation, no writes)
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isSubmitting || !csvText.trim()}
            onClick={handleSubmit}
          >
            {isSubmitting
              ? 'Running...'
              : dryRun
              ? 'Validate'
              : 'Import Now'}
          </Button>
        </div>

        {result && (
          <div className="mt-3 space-y-2 border-t border-border pt-3 text-[0.7rem]">
            <div className="font-semibold text-foreground">
              Result ({dryRun ? 'dry run' : 'applied'}):
            </div>
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              <span>Total rows: {result.total}</span>
              <span>Created: {result.created}</span>
              <span>Updated: {result.updated}</span>
              <span>Errors: {result.errors.length}</span>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto rounded-md bg-muted px-2 py-2">
                {result.errors.slice(0, 50).map((err, idx) => (
                  <div key={`${err.index}-${idx}`}>
                    Row {err.index + 2}: {err.message}
                  </div>
                ))}
                {result.errors.length > 50 && (
                  <div className="mt-1 text-muted-foreground">
                    + {result.errors.length - 50} more...
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