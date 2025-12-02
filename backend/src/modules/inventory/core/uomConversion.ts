import { Prisma } from '@prisma/client';
import type { UnitOfMeasure } from '@prisma/client';

/**
 * Given two paths from unit -> ... -> root, compute the conversion factor
 * such that: sourceQty * factor = targetQty.
 *
 * This is the pure math extracted from InventoryService.getConversionFactor
 * to make it easy to test.
 */
export function computeConversionFactorFromPaths(
  sourcePath: Pick<UnitOfMeasure, 'ratio'>[],
  targetPath: Pick<UnitOfMeasure, 'ratio'>[],
): Prisma.Decimal {
  const factorToRoot = (path: Pick<UnitOfMeasure, 'ratio'>[]) => {
    return path.reduce((acc, u, index) => {
      if (index === 0) return new Prisma.Decimal(1);
      return acc.mul(u.ratio);
    }, new Prisma.Decimal(1));
  };

  const sourceToRoot = factorToRoot(sourcePath);
  const targetToRoot = factorToRoot(targetPath);

  return sourceToRoot.div(targetToRoot);
}