import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

// Banker's rounding mode (ROUND_HALF_EVEN) from decimal.js / Prisma.Decimal
const BANKERS_ROUNDING: number =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Decimal as any).ROUND_HALF_EVEN ?? 6;

export const money = (value: Prisma.Decimal.Value): Prisma.Decimal =>
  new Decimal(value ?? 0);

/**
 * Round a monetary value to the given number of decimal places
 * using Banker's Rounding (ROUND_HALF_EVEN).
 */
export const roundCurrency = (
  value: Prisma.Decimal.Value,
  decimals = 2,
): Prisma.Decimal => money(value).toDecimalPlaces(decimals, BANKERS_ROUNDING);

/**
 * Compute a line total (qty * unitPrice) with Banker's rounding
 * applied to the final result.
 */
export const computeLineTotal = (
  quantity: Prisma.Decimal,
  unitPrice: Prisma.Decimal,
): Prisma.Decimal => {
  const raw = quantity.mul(unitPrice);
  return roundCurrency(raw);
};