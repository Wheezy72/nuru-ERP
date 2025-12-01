import { PrismaClient } from '@prisma/client';

let globalPrisma: PrismaClient | undefined;

const getBaseClient = () => {
  if (!globalPrisma) {
    globalPrisma = new PrismaClient();
  }
  return globalPrisma;
};

/**
 * Returns a Prisma client instance extended with RLS support.
 * For every query, it wraps execution in a transaction where the
 * PostgreSQL GUC `app.current_tenant_id` is set.
 *
 * This ensures all RLS policies that rely on this setting are enforced.
 */
export const createTenantPrismaClient = (tenantId: string) => {
  const base = getBaseClient();

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return base.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
            // Queries executed after set_config in this transaction
            // will see the correct tenant id.
            return query(args);
          });
        },
      },
    },
  });
};