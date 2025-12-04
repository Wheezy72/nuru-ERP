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
 * Extract VAT from a VAT-inclusive amount.
 *
 * Example for 16%:
 *   base = amount / 1.16
 *   tax  = amount - base
 */
export function extractVatInclusive(
  amount: Prisma.Decimal,
  rateDecimal: Prisma.Decimal,
): { base: Prisma.Decimal; tax: Prisma.Decimal } {
  const one = new Prisma.Decimal(1);
  if (rateDecimal.lte(0)) {
    return { base: amount, tax: new Prisma.Decimal(0) };
  }
  const divisor = one.add(rateDecimal);
  const base = amount.div(divisor);
  const tax = amount.sub(base);
  return { base, tax };
}

/**
 * Pure tax math used by InvoiceService.buildKraPayload and dashboard tax liability.
 * Assumes lineTotal is VAT-inclusive for VAT_16 / VAT_8 items.
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
    const rate = item.taxRate;

    if (rate === 'VAT_16' || rate === 'VAT_8') {
      const r = rateFor(rate);
      const { base, tax } = extractVatInclusive(amount, r);

      if (rate === 'VAT_16') {
        breakdown.vat16.taxable = breakdown.vat16.taxable.add(base);
        breakdown.vat16.tax = breakdown.vat16.tax.add(tax);
      } else {
        breakdown.vat8.taxable = breakdown.vat8.taxable.add(base);
        breakdown.vat8.tax = breakdown.vat8.tax.add(tax);
      }

      breakdown.totalTax = breakdown.totalTax.add(tax);
    } else if (rate === 'EXEMPT') {
      breakdown.exempt.amount = breakdown.exempt.amount.add(amount);
    } else if (rate === 'ZERO') {
      breakdown.zeroRated.amount = breakdown.zeroRated.amount.add(amount);
    }
  }

  return breakdown;
}