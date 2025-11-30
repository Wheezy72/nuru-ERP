import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function PosPage() {
  const [scan, setScan] = React.useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Point of Sale</h1>
        <span className="text-[0.75rem] text-muted-foreground">
          Fast checkout for cashiers.
        </span>
      </div>
      <Card className="p-4 shadow-neo">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Scan or enter product
            </label>
            <Input
              autoFocus
              placeholder="Scan barcode or type SKU..."
              value={scan}
              onChange={(e) => setScan(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              onClick={() => {
                if (!scan) return;
                // Placeholder: in a full implementation this would add to the ticket.
                setScan('');
              }}
            >
              Add Item
            </Button>
          </div>
        </div>
        <div className="mt-6 rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
          Ticket details and payment flow will appear here. This screen is
          intentionally minimal for cashiers: scan, confirm, collect.
        </div>
      </Card>
    </div>
  );
}