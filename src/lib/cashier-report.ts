export type CashierRevenue = {
  id: string; name: string; transactions: number; total: number;
  cash: number; qris: number; debit: number; other: number;
};
export type CashierReport = {
  rows: CashierRevenue[];
  totals: Omit<CashierRevenue, 'id' | 'name'>;
};

export function summarizeCashiers(rows: CashierRevenue[]): CashierReport {
  const totals = { transactions: 0, total: 0, cash: 0, qris: 0, debit: 0, other: 0 };
  for (const row of rows) {
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += row[key];
  }
  return { rows, totals };
}
