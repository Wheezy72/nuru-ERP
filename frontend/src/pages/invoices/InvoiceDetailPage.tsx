import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type InvoiceItemDto = {
  id: string;
  product: { name: string };
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  uom: { name: string };
};

type CustomerDto = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type InvoiceDto = {
  id: string;
  invoiceNo: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  totalAmount: string;
  controlCode?: string | null;
  qrCodeSignature?: string | null;
  customer: CustomerDto;
  items: InvoiceItemDto[];
};

type InvoiceDetailResponse = {
  invoice: InvoiceDto;
  paidAmount: number;
  balanceDue: number;
  coupon: {
    code: string;
    discount: number;
  } | null;
};

type PaymentDto = {
  id: string;
  amount: string;
  type: string;
  reference?: string | null;
  createdAt: string;
};

type LogDto = {
  id: string;
  action: string;
  createdAt: string;
  metadata?: any;
};

type HistoryResponse = {
  payments: PaymentDto[];
  logs: LogDto[];
};

export function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string | undefined;
  const [activeTab, setActiveTab] = React.useState<'summary' | 'history'>(
    'summary'
  );

  const {
    data: detail,
    isLoading: isDetailLoading,
    isError: isDetailError,
  } = useQuery({
    queryKey: ['invoiceDetail', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const res = await apiClient.get<InvoiceDetailResponse>(
        `/invoices/${invoiceId}`
      );
      return res.data;
    },
  });

  const {
    data: history,
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ['invoiceHistory', invoiceId],
    enabled: !!invoiceId && activeTab === 'history',
    queryFn: async () => {
      const res = await apiClient.get<HistoryResponse>(
        `/invoices/${invoiceId}/history`
      );
      return res.data;
    },
  });

  if (!invoiceId) {
    return (
      <div className="text-sm text-muted-foreground">
        Missing invoice id in route.
      </div>
    );
  }

  if (isDetailLoading) {
    return (
      <div className="text-sm text-muted-foreground">Loading invoice...</div>
    );
  }

  if (isDetailError || !detail) {
    return (
      <div className="text-sm text-rose-600">
        Failed to load invoice details.
      </div>
    );
  }

  const { invoice, paidAmount, balanceDue } = detail;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Invoice {invoice.invoiceNo}
          </h1>
          <p className="text-xs text-muted-foreground">
            {invoice.customer?.name || 'Customer'} •{' '}
            {new Date(invoice.issueDate).toLocaleDateString()} • Status{' '}
            <span className="font-semibold">{invoice.status}</span>
          </p>
          {invoice.controlCode && (
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              Tax Control Code:{' '}
              <span className="font-mono">{invoice.controlCode}</span>
            </p>
          )}
          {detail.coupon && (
            <p className="mt-1 text-[0.7rem] text-emerald-800">
              Coupon {detail.coupon.code} applied (
              {detail.coupon.discount.toLocaleString(undefined, {
                style: 'currency',
                currency: 'KES',
              })}{' '}
              off)
            </p>
          )}
        </div>
        <div className="flex flex-col items-end text-xs">
          <div className="text-muted-foreground">Total Amount</div>
          <div className="text-xl font-semibold text-foreground">
            {Number(invoice.totalAmount).toLocaleString(undefined, {
              style: 'currency',
              currency: 'KES',
            })}
          </div>
          <div className="mt-1 flex gap-3 text-[0.7rem]">
            <span className="text-emerald-700">
              Paid:{' '}
              {paidAmount.toLocaleString(undefined, {
                style: 'currency',
                currency: 'KES',
              })}
            </span>
            <span className="text-amber-700">
              Balance:{' '}
              {balanceDue.toLocaleString(undefined, {
                style: 'currency',
                currency: 'KES',
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 text-xs">
        <Button
          size="sm"
          variant={activeTab === 'summary' ? 'default' : 'outline'}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </Button>
        <Button
          size="sm"
          variant={activeTab === 'history' ? 'default' : 'outline'}
          onClick={() => setActiveTab('history')}
        >
          Payments &amp; History
        </Button>
      </div>

      {activeTab === 'summary' && (
        <div className="grid gap-4 md:grid-cols-3 auto-rows-min">
          <Card className="p-4 text-xs md:col-span-2">
            <div className="mb-2 text-sm font-semibold text-foreground">
              Line Items
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b text-[0.7rem] text-muted-foreground">
                  <th className="px-2 py-1 text-left">Item</th>
                  <th className="px-2 py-1 text-right">Qty</th>
                  <th className="px-2 py-1 text-right">Unit Price</th>
                  <th className="px-2 py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-none">
                    <td className="px-2 py-1">
                      <div className="font-medium text-foreground">
                        {item.product?.name}
                      </div>
                      <div className="text-[0.65rem] text-muted-foreground">
                        {item.uom?.name}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right">
                      {Number(item.quantity).toLocaleString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {Number(item.unitPrice).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'KES',
                      })}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {Number(item.lineTotal).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'KES',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-4 text-xs">
            <div className="mb-2 text-sm font-semibold text-foreground">
              Customer
            </div>
            <div className="space-y-1">
              <div className="font-medium text-foreground">
                {invoice.customer?.name}
              </div>
              {invoice.customer?.phone && (
                <div className="text-[0.7rem] text-muted-foreground">
                  Phone: {invoice.customer.phone}
                </div>
              )}
              {invoice.customer?.email && (
                <div className="text-[0.7rem] text-muted-foreground">
                  Email: {invoice.customer.email}
                </div>
              )}
              {invoice.dueDate && (
                <div className="text-[0.7rem] text-muted-foreground">
                  Due:{' '}
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="grid gap-4 md:grid-cols-2 auto-rows-min">
          <Card className="p-4 text-xs">
            <div className="mb-2 text-sm font-semibold text-foreground">
              Payments
            </div>
            {isHistoryLoading ? (
              <div className="text-xs text-muted-foreground">
                Loading payments...
              </div>
            ) : !history || history.payments.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No recorded payments yet.
              </div>
            ) : (
              <ul className="space-y-1">
                {history.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md bg-background px-2 py-1"
                  >
                    <div>
                      <div className="text-[0.7rem] font-medium text-foreground">
                        {new Date(p.createdAt).toLocaleString()}
                      </div>
                      <div className="text-[0.65rem] text-muted-foreground">
                        {p.type} • {p.reference || 'No reference'}
                      </div>
                    </div>
                    <div className="text-[0.7rem] font-semibold text-emerald-700">
                      {Number(p.amount).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'KES',
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 text-xs">
            <div className="mb-2 text-sm font-semibold text-foreground">
              Audit Log
            </div>
            {isHistoryLoading ? (
              <div className="text-xs text-muted-foreground">
                Loading history...
              </div>
            ) : !history || history.logs.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No system events recorded yet.
              </div>
            ) : (
              <ul className="space-y-1">
                {history.logs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-md bg-background px-2 py-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[0.7rem] font-medium text-foreground">
                        {log.action}
                      </div>
                      <div className="text-[0.65rem] text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {log.metadata && (
                      <div className="mt-1 text-[0.65rem] text-muted-foreground">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}