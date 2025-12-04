import { MpesaReconcileRow } from '../mpesa/MpesaReconciliationService';

export type ParsedCsvRow = Record<string, string>;

/**
 * Simple CSV parser for UTF-8 text.
 * - Assumes first row is a header.
 * - Uses comma as separator.
 * - Handles basic quoted fields.
 */
export function parseCsv(text: string): {
  headers: string[];
  rows: ParsedCsvRow[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"' && (i === 0 || line[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
        continue;
      }

      if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += ch;
    }

    if (current.length > 0) {
      result.push(current.trim());
    }

    return result;
  };

  const headerCols = parseLine(lines[0]).map((h) => h.trim());
  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row: ParsedCsvRow = {};
    headerCols.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });
    rows.push(row);
  }

  return { headers: headerCols, rows };
}

/**
 * Helper to map parsed CSV rows for M-Pesa reconciliation into MpesaReconcileRow[].
 */
export function mapToMpesaRows(parsed: {
  headers: string[];
  rows: ParsedCsvRow[];
}): MpesaReconcileRow[] {
  const headers = parsed.headers.map((h) => h.toLowerCase());

  const idx = (candidates: string[]) =>
    headers.findIndex((h) =>
      candidates.some((c) => h.includes(c.toLowerCase())),
    );

  const txIdx = idx([
    'transid',
    'transaction id',
    'mpesa receipt',
    'mpesareceiptnumber',
    'm-pesa receipt',
  ]);
  const amountIdx = idx(['amount', 'transamount', 'paid in']);
  const acctIdx = idx([
    'account reference',
    'bill reference',
    'accountref',
    'accref',
  ]);
  const msisdnIdx = idx(['msisdn', 'phone', 'payer']);
  const tsIdx = idx(['date', 'transdate', 'timestamp', 'transaction date']);

  const rows: MpesaReconcileRow[] = [];

  for (const row of parsed.rows) {
    if (txIdx < 0 || amountIdx < 0) {
      continue;
    }
    const headersArr = parsed.headers;
    const tx = row[headersArr[txIdx]] || '';
    const amtRaw = row[headersArr[amountIdx]] || '';
    const amount = Number(amtRaw.replace(/[^\d.-]/g, ''));

    if (!tx || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const mapped: MpesaReconcileRow = {
      transactionId: tx,
      amount,
    };

    if (acctIdx >= 0) {
      mapped.accountReference = row[headersArr[acctIdx]] || undefined;
    }
    if (msisdnIdx >= 0) {
      mapped.msisdn = row[headersArr[msisdnIdx]] || undefined;
    }
    if (tsIdx >= 0) {
      mapped.timestamp = row[headersArr[tsIdx]] || undefined;
    }

    rows.push(mapped);
  }

  return rows;
}