import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'MPESA_CONSUMER_KEY',
  'PESAPAL_CONSUMER_KEY',
];

type HealthReport = {
  missingEnv: string[];
  dbOk: boolean;
  dbError?: string;
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

async function checkDatabase(): Promise<{ ok: boolean; error?: string }> {
  const prisma = new PrismaClient();
  try {
    // Simple connectivity check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$queryRaw<any>`SELECT 1`;
    await prisma.$disconnect();
    return { ok: true };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Database connectivity check failed', err);
    await prisma.$disconnect();
    return { ok: false, error: err?.message || String(err) };
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
    todos: [],
  };

  report.missingEnv = await checkEnv();
  const dbResult = await checkDatabase();
  report.dbOk = dbResult.ok;
  report.dbError = dbResult.error;

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

  console.log('\nTODOs remaining in codebase:');
  if (report.todos.length === 0) {
    console.log('  None 🎯');
  } else {
    for (const todo of report.todos) {
      console.log(`  ${todo.file}:${todo.line} - ${todo.text}`);
    }
  }

  const hasErrors = report.missingEnv.length > 0 || !report.dbOk;
  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Health check failed', err);
  process.exit(1);
});