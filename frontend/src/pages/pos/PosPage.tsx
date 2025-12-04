import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/apiClient';

type CartLine = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
};

export function PosPage() {
  const [scan, setScan] = React.useState('');
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [customerName, setCustomerName] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const queryClient = useQueryClient();

  const addScanToCart = async () => {
    if (!scan.trim()) return;
    try {
      const res = await apiClient.get('/inventory/products', {
        params: {
          page: 1,
          pageSize: 1,
          search: scan.trim(),
        },
      });
      const product = res.data.items?.[0];
      if (!product) {
        alert('No matching product found.');
        return;
      }
      setCart((prev) => {
        const existing = prev.find((p) => p.id === product.id);
        if (existing) {
          return prev.map((p) =>
            p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p,
          );
        }
        return [
          ...prev,
          {
            id: product.id,
            name: product.name,
            sku: product.sku,
            quantity: 1,
            unitPrice: Number(product.defaultPrice ?? 0),
          },
        ];
      });
      setScan('');
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to look up product for POS', err);
      alert(
        err?.response?.data?.message ||
          'Failed to look up product. Check your network/API.',
      );
    }
  };

  const total = cart.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!cart.length) {
        throw new Error('Cart is empty');
      }
      const customerId = localStorage.getItem('default_customer_id');
      if (!customerId) {
        throw new Error(
          'No default customer configured. Set default_customer_id in localStorage.',
        );
      }
      const items = cart.map((line) => ({
        productId: line.id,
        quantity: '1', // server interprets via Prisma.Decimal; one unit per line
        unitPrice: line.unitPrice.toString(),
        uomId: undefined,
        hsCode: '999999',
        taxRate: 'VAT_16',
      }));
      const today = new Date();
      const res = await apiClient.post('/invoices', {
        customerId,
        issueDate: today.toISOString(),
        items,
      });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const handleCheckout = async () => {
    if (!cart.length) {
      alert('Cart is empty.');
      return;
    }
    setSubmitting(true);
    try {
      const invoice = await checkoutMutation.mutateAsync();
      setCart([]);
      alert(
        `Invoice ${invoice.invoiceNo} created for KES ${Number(
          invoice.totalAmount,
        ).toLocaleString()}.`,
      );
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to create invoice.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Point of Sale</h1>
        <span className="text-[0.75rem] text-muted-foreground">
          Scan, confirm, collect — tied to real invoices.
        </span>
      </div>
      <Card className="p-4 shadow-neo space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Scan or enter product
            </label>
            <Input
              autoFocus
              placeholder="Scan barcode or type SKU/name..."
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addScanToCart();
                }
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" onClick={() => void addScanToCart()}>
              Add Item
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] font-semibold text-foreground">
                Ticket
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  className="text-[0.7rem] text-rose-600 hover:underline"
                  onClick={() => setCart([])}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="rounded-md border border-border bg-background">
              {cart.length === 0 ? (
                <div className="p-3 text-[0.75rem] text-muted-foreground">
                  No items yet. Scan or add a product to start a ticket.
                </div>
              ) : (
                <table className="w-full text-[0.75rem]">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-2 py-1 text-left font-medium">Item</th>
                      <th className="px-2 py-1 text-right font-medium">Qty</th>
                      <th className="px-2 py-1 text-right font-medium">
                        Price
                      </th>
                      <th className="px-2 py-1 text-right font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((line) => (
                      <tr key={line.id} className="border-b border-border/50">
                        <td className="px-2 py-1">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {line.name}
                            </span>
                            <span className="text-[0.65rem] text-muted-foreground">
                              {line.sku}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1 text-right">
                          {line.quantity}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {line.unitPrice.toLocaleString()}
                        </td>
                        <td className="px-2 py-1 text-right">
                          {(line.quantity * line.unitPrice).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-2 py-2 text-right font-semibold" colSpan={3}>
                        Total
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">
                        {total.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <div className="text-[0.75rem] font-semibold text-foreground">
                Customer (optional)
              </div>
              <Input
                placeholder="Name shown on receipt (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <p className="text-[0.65rem] text-muted-foreground">
                POS uses the default walk-in customer by default. Set
                default_customer_id in localStorage to point to that record.
              </p>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={submitting || cart.length === 0}
              onClick={handleCheckout}
            >
              {submitting ? 'Creating Invoice...' : 'Checkout & Create Invoice'}
            </Button>
            <p className="text-[0.65rem] text-muted-foreground">
              This flow creates a real invoice behind the scenes. If Training
              Mode is enabled in the header, those invoices will not touch stock
              or the ledger.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}