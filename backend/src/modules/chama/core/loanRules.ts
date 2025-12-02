import { Prisma } from '@prisma/client';

/**
 * Return true if a requested principal is within the allowed
 * maxLoanRatio * totalContributions window.
 */
export function isLoanWithinMaxRatio(
  totalContributions: Prisma.Decimal,
  maxLoanRatio: Prisma.Decimal,
  principal: Prisma.Decimal,
): boolean {
  const maxAllowed = totalContributions.mul(maxLoanRatio);
  return !principal.gt(maxAllowed);
}