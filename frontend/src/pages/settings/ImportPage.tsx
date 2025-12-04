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
  const [dryRun, setDryRun] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      alert('CSV file must have a header row and at least one data row.');
      setHeaders([]);
      setRows([]);
      setResult(null);
      return;
    }

    const headerRow = lines[0].split(',').map((h) => h.trim());
    const dataRows: Record<string, string>[] = lines.slice(1).map((line) => {
      const cols = line.split(',');
      const row: Record<string, string> = {};
      headerRow.forEach((h, idx) => {
        row[h] = (cols[idx] ?? '').trim();
      });
      return row;
    });

    setHeaders(headerRow);
    setRows(dataRows);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!rows.length) {
      alert('Select a CSV file first.');
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      const endpoint =
        importType === 'customers' ? '/import/customers' : '/import/products';
      const res = await apiClient.post<ImportResult>(endpoint, {
        rows,
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

  const errorsByIndex: Record<number, string[]> = {};
  if (result?.errors?.length) {
    for (const err of result.errors) {
      if (!errorsByIndex[err.index]) {
        errorsByIndex[err.index] = [];
      }
      errorsByIndex[err.index].push(err.message);
    }
  }

  const visibleRows = rows.slice(0, 200);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Import Data
          </h1>
          <p className="text-xs text-muted-foreground">
            Upload a CSV, fix any red rows inline, then import in one go.
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
              onChange={(e) => {
                setImportType(e.target.value as ImportType);
                setResult(null);
              }}
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
            disabled={isSubmitting || !rows.length}
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
              <p className="text-[0.65rem] text-rose-700">
                Fix the highlighted rows below, then run again with dry run
                disabled to apply changes.
              </p>
            )}
          </div>
        )}

        {headers.length > 0 && visibleRows.length > 0 && (
          <div className="mt-3 max-h-80 overflow-auto rounded-md border border-border bg-background">
            <table className="w-full border-collapse text-[0.7rem]">
              <thead className="sticky top-0 bg-muted/70">
                <tr>
                  <th className="border-b border-border px-2 py-1 text-left">
                    #
                  </th>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="border-b border-border px-2 py-1 text-left"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="border-b border-border px-2 py-1 text-left">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIndex) => {
                  const globalIndex = rowIndex;
                  const rowErrors = errorsByIndex[globalIndex] || [];
                  const hasError = rowErrors.length > 0;
                  return (
                    <tr
                      key={globalIndex}
                      className={
                        hasError ? 'bg-rose-50 border-b border-rose-100' : 'border-b border-border/40'
                      }
                    >
                      <td className="px-2 py-1 align-top">
                        {globalIndex + 2}
                      </td>
                      {headers.map((h) => (
                        <td key={h} className="px-2 py-1 align-top">
                          <Input
                            value={row[h] ?? ''}
                            onChange={(e) =>
                              setRows((prev) => {
                                const next = [...prev];
                                next[globalIndex] = {
                                  ...next[globalIndex],
                                  [h]: e.target.value,
                                };
                                return next;
                              })
                            }
                            className="h-7 text-[0.7rem]"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1 align-top text-rose-700">
                        {rowErrors.map((msg, i) => (
                          <div key={i}>{msg}</div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > visibleRows.length && (
              <div className="border-t border-border px-2 py-1 text-[0.65rem] text-muted-foreground">
                Showing first {visibleRows.length} rows out of {rows.length}.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}