import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

type Shift = {
  id: string;
  openedAt: string;
  openingFloat: string;
  status: 'OPEN' | 'CLOSED';
  closingFloat?: string | null;
  expectedClosingCash?: string | null;
  variance?: string | null;
};

export function PosPage() {
  const [scan, setScan] = React.useState('');
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [customerName, setCustomerName] = React.useState('');
  const [couponCode, setCouponCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [openingFloat, setOpeningFloat] = React.useState('');
  const [closingFloat, setClosingFloat] = React.useState('');
  const [isOpeningShift, setIsOpeningShift] = React.useState(false);
  const [isClosingShift, setIsClosingShift] = React.useState(false);
  const queryClient = useQueryClient();

  const {
    data: currentShift,
    isLoading: isLoadingShift,
    refetch: refetchShift,
  } = useQuery({
    queryKey: ['currentShift'],
    queryFn: async () => {
      const res = await apiClient.get<{ shift: Shift | null }>('/shifts/current');
      return res.data.shift ?? null;
    },
    staleTime: 30 * 1000,
  });

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
        // unitPrice omitted: server will apply dynamic pricing / price lists
        uomId: undefined,
        hsCode: '999999',
        taxRate: 'VAT_16',
      }));
      const today = new Date();
      const res = await apiClient.post('/invoices', {
        customerId,
        issueDate: today.toISOString(),
        couponCode: couponCode || undefined,
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
    if (!currentShift) {
      alert('Open a shift with an opening float before checkout.');
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

  const handleOpenShift = async () => {
    const value = Number(openingFloat);
    if (Number.isNaN(value) || value < 0) {
      alert('Opening float must be a non-negative number.');
      return;
    }
    setIsOpeningShift(true);
    try {
      await apiClient.post('/shifts/open', {
        openingFloat: value,
      });
      setOpeningFloat('');
      await refetchShift();
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to open shift.',
      );
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) {
      alert('No open shift to close.');
      return;
    }
    const value = Number(closingFloat);
    if (Number.isNaN(value) || value < 0) {
      alert('Closing float must be a non-negative number.');
      return;
    }
    setIsClosingShift(true);
    try {
      const res = await apiClient.post<Shift>('/shifts/close', {
        closingFloat: value,
      });
      setClosingFloat('');
      await refetchShift();
      const variance = res.data.variance
        ? Number(res.data.variance).toLocaleString()
        : '0';
      alert(
        `Shift closed. Variance recorded: KES ${variance}. Check audit log for details.`,
      );
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to close shift.',
      );
    } finally {
      setIsClosingShift(false);
    }
  };

  const openedAtLabel =
    currentShift && currentShift.openedAt
      ? new Date(currentShift.openedAt).toLocaleTimeString()
      : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Point of Sale</h1>
        <span className="text-[0.75rem] text-muted-foreground">
          Scan, confirm, collect — tied to real invoices.
        </span>
      </div>
      <Card className="p-4 shadow-neo space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-xs">
          <div className="text-[0.75rem] font-semibold text-foreground">
            Shift status
          </div>
          {isLoadingShift ? (
            <div className="text-[0.7rem] text-muted-foreground">
              Loading shift...
            </div>
          ) : currentShift ? (
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
              <span>
                Open since {openedAtLabel} • Opening float:{' '}
                {Number(currentShift.openingFloat).toLocaleString(undefined, {
                  style: 'currency',
                  currency: 'KES',
                })}
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Closing cash"
                  value={closingFloat}
                  onChange={(e) => setClosingFloat(e.target.value)}
                  className="h-8 w-32"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isClosingShift}
                  onClick={handleCloseShift}
                >
                  {isClosingShift ? 'Closing...' : 'Close Shift'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
              <span>No open shift.</span>
              <Input
                type="number"
                placeholder="Opening cash"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="h-8 w-32"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={isOpeningShift}
                onClick={handleOpenShift}
              >
                {isOpeningShift ? 'Opening...' : 'Open Shift'}
              </Button>
            </div>
          )}
        </div>

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
              <p className="text-[0.7rem] text-muted-foreground mt-1">
                POS uses the default walk-in customer by default. Set
                default_customer_id in localStorage to point to that record.
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-[0.75rem] font-semibold text-foreground">
                Coupon code
              </div>
              <Input
                placeholder="e.g. FUNDIS10"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />
              <p className="text-[0.7rem] text-muted-foreground mt-1">
                If valid, the coupon will be applied to this ticket before
                checkout.
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
            <p className="text-[0.7rem] text-muted-foreground mt-1">
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