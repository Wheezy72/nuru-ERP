import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  // Mobile money
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  // WhatsApp notifications
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  // Card/bank gateway (Pesapal in this deployment)
  'PESAPAL_CONSUMER_KEY',
  'PESAPAL_CONSUMER_SECRET',
];

type HealthReport = {
  missingEnv: string[];
  dbOk: boolean;
  dbError?: string;
  negativeStock: { productId: string; quantity: string }[];
  postedWithoutTransactions: { invoiceId: string; invoiceNo: string }[];
  todos: { file: string; line: number; text: string }[];
};

async function checkEnv(): Promise<string[]> {
  const missing: string[] = [];
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  return missing;
}

async function checkDatabaseAndIntegrity(): Promise<{
  ok: boolean;
  error?: string;
  negativeStock: { productId: string; quantity: string }[];
  postedWithoutTransactions: { invoiceId: string; invoiceNo: string }[];
}> {
  const prisma = new PrismaClient();
  try {
    // Simple connectivity check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$queryRaw<any>`SELECT 1`;

    const negativeStock = await prisma.stockQuant.findMany({
      where: {
        quantity: {
          lt: 0,
        },
      },
      select: {
        productId: true,
        quantity: true,
      },
    });

    const postedWithoutTransactions = await prisma.invoice.findMany({
      where: {
        status: 'Posted',
        transactions: {
          none: {},
        },
      },
      select: {
        id: true,
        invoiceNo: true,
      },
    });

    await prisma.$disconnect();
    return {
      ok: true,
      negativeStock: negativeStock.map((row) => ({
        productId: row.productId,
        quantity: row.quantity.toString(),
      })),
      postedWithoutTransactions: postedWithoutTransactions.map((inv) => ({
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
      })),
    };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Database connectivity / integrity check failed', err);
    await prisma.$disconnect();
    return {
      ok: false,
      error: err?.message || String(err),
      negativeStock: [],
      postedWithoutTransactions: [],
    };
  }
}



const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.turbo',
  '.next',
]);

function collectTodos(root: string): { file: string; line: number; text: string }[] {
  const results: { file: string; line: number; text: string }[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        if (!/\.(ts|tsx|js|jsx|md|sql)$/.test(entry.name)) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);
        lines.forEach((line, idx) => {
          if (line.includes('TODO')) {
            results.push({
              file: fullPath,
              line: idx + 1,
              text: line.trim(),
            });
          }
        });
      }
    }
  }

  walk(root);
  return results;
}

async function main() {
  const report: HealthReport = {
    missingEnv: [],
    dbOk: false,
    negativeStock: [],
    postedWithoutTransactions: [],
    todos: [],
  };

  report.missingEnv = await checkEnv();
  const dbResult = await checkDatabaseAndIntegrity();
  report.dbOk = dbResult.ok;
  report.dbError = dbResult.error;
  report.negativeStock = dbResult.negativeStock;
  report.postedWithoutTransactions = dbResult.postedWithoutTransactions;

  const root = process.cwd();
  report.todos = collectTodos(root);

  // Print a human-readable summary
  console.log('--- Nuru Health Check ---');
  console.log('Environment variables:');
  if (report.missingEnv.length === 0) {
    console.log('  OK - all required env vars present.');
  } else {
    console.log('  Missing:', report.missingEnv.join(', '));
  }

  console.log('\nDatabase connectivity:');
  if (report.dbOk) {
    console.log('  OK - database reachable.');
  } else {
    console.log('  FAILED -', report.dbError);
  }

  console.log('\nIntegrity checks:');
  if (report.negativeStock.length === 0) {
    console.log('  ✓ No negative stock quants.');
  } else {
    console.log('  ⚠ Negative stock found:');
    for (const row of report.negativeStock) {
      console.log(
        `    Product ${row.productId} has negative quantity ${row.quantity}`
      );
    }
  }
  if (report.postedWithoutTransactions.length === 0) {
    console.log('  ✓ All posted invoices have at least one transaction.');
  } else {
    console.log('  ⚠ Posted invoices without transactions:');
    for (const inv of report.postedWithoutTransactions) {
      console.log(
        `    Invoice ${inv.invoiceNo} (${inv.invoiceId}) has no linked transactions`
      );
    }
  }

  console.log('\nTODOs remaining in codebase:');
  if (report.todos.length === 0) {
    console.log('  None 🎯');
  } else {
    for (const todo of report.todos) {
      console.log(`  ${todo.file}:${todo.line} - ${todo.text}`);
    }
  }

  const hasErrors =
    report.missingEnv.length > 0 ||
    !report.dbOk ||
    report.negativeStock.length > 0 ||
    report.postedWithoutTransactions.length > 0;
  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Health check failed', err);
  process.exit(1);
});