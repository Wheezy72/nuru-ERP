import { Prisma, TaxRate } from '@prisma/client';

export type TaxItem = {
  lineTotal: Prisma.Decimal;
  taxRate: TaxRate;
};

export type TaxBreakdown = {
  vat16: { taxable: Prisma.Decimal; tax: Prisma.Decimal };
  vat8: { taxable: Prisma.Decimal; tax: Prisma.Decimal };
  exempt: { amount: Prisma.Decimal };
  zeroRated: { amount: Prisma.Decimal };
  totalTax: Prisma.Decimal;
};

/**
 * Pure tax math used by InvoiceService.buildKraPayload and unit tests.
 */
export function computeTaxBreakdown(items: TaxItem[]): TaxBreakdown {
  const breakdown: TaxBreakdown = {
    vat16: { taxable: new Prisma.Decimal(0), tax: new Prisma.Decimal(0) },
    vat8: { taxable: new Prisma.Decimal(0), tax: new Prisma.Decimal(0) },
    exempt: { amount: new Prisma.Decimal(0) },
    zeroRated: { amount: new Prisma.Decimal(0) },
    totalTax: new Prisma.Decimal(0),
  };

  const rateFor = (rate: TaxRate) => {
    switch (rate) {
      case 'VAT_16':
        return new Prisma.Decimal(0.16);
      case 'VAT_8':
        return new Prisma.Decimal(0.08);
      case 'EXEMPT':
      case 'ZERO':
      default:
        return new Prisma.Decimal(0);
    }
  };

  for (const item of items) {
    const amount = item.lineTotal;
    const r = rateFor(item.taxRate);
    const tax = amount.mul(r);

    if (item.taxRate === 'VAT_16') {
      breakdown.vat16.taxable = breakdown.vat16.taxable.add(amount);
      breakdown.vat16.tax = breakdown.vat16.tax.add(tax);
    } else if (item.taxRate === 'VAT_8') {
      breakdown.vat8.taxable = breakdown.vat8.taxable.add(amount);
      breakdown.vat8.tax = breakdown.vat8.tax.add(tax);
    } else if (item.taxRate === 'EXEMPT') {
      breakdown.exempt.amount = breakdown.exempt.amount.add(amount);
    } else if (item.taxRate === 'ZERO') {
      breakdown.zeroRated.amount = breakdown.zeroRated.amount.add(amount);
    }

    breakdown.totalTax = breakdown.totalTax.add(tax);
  }

  return breakdown;
}