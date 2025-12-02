import { describe, expect, it } from 'vitest';
import { Prisma, TaxRate } from '@prisma/client';
import { computeTaxBreakdown } from '../src/modules/invoicing/core/taxMath';
import { computeConversionFactorFromPaths } from '../src/modules/inventory/core/uomConversion';
import { isLoanWithinMaxRatio } from '../src/modules/chama/core/loanRules';

describe('buildKraPayload tax math', () => {
  it('groups line totals by tax rate and computes tax correctly', () => {
    const items = [
      {
        lineTotal: new Prisma.Decimal(1000),
        taxRate: TaxRate.VAT_16,
      },
      {
        lineTotal: new Prisma.Decimal(500),
        taxRate: TaxRate.VAT_8,
      },
      {
        lineTotal: new Prisma.Decimal(200),
        taxRate: TaxRate.EXEMPT,
      },
      {
        lineTotal: new Prisma.Decimal(300),
        taxRate: TaxRate.ZERO,
      },
    ];

    const breakdown = computeTaxBreakdown(items);

    expect(breakdown.vat16.taxable.toNumber()).toBeCloseTo(1000);
    expect(breakdown.vat16.tax.toNumber()).toBeCloseTo(160);
    expect(breakdown.vat8.taxable.toNumber()).toBeCloseTo(500);
    expect(breakdown.vat8.tax.toNumber()).toBeCloseTo(40);
    expect(breakdown.exempt.amount.toNumber()).toBeCloseTo(200);
    expect(breakdown.zeroRated.amount.toNumber()).toBeCloseTo(300);
    expect(breakdown.totalTax.toNumber()).toBeCloseTo(200);
  });
});

describe('breakBulk inventory logic', () => {
  it('computes conversion factor along UoM tree', () => {
    const root = {
      id: 'root',
      ratio: new Prisma.Decimal(1),
    } as any;

    const box = {
      id: 'box',
      ratio: new Prisma.Decimal(12),
    } as any;

    const unit = {
      id: 'unit',
      ratio: new Prisma.Decimal(1),
    } as any;

    const sourcePath = [box, root];
    const targetPath = [unit, root];

    const factor = computeConversionFactorFromPaths(sourcePath, targetPath);
    expect(factor.toNumber()).toBeCloseTo(12);
  });
});

describe('createLoan Chama constitution limits', () => {
  it('allows principal within maxLoanRatio * contributions', () => {
    const contributions = new Prisma.Decimal(10000);
    const maxRatio = new Prisma.Decimal(2);
    const principal = new Prisma.Decimal(20000);

    expect(isLoanWithinMaxRatio(contributions, maxRatio, principal)).toBe(true);
  });

  it('rejects principal above maxLoanRatio * contributions', () => {
    const contributions = new Prisma.Decimal(10000);
    const maxRatio = new Prisma.Decimal(2);
    const principal = new Prisma.Decimal(25000);

    expect(isLoanWithinMaxRatio(contributions, maxRatio, principal)).toBe(false);
  });
});