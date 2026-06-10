import type { Account, AccountType } from './accounts';
import type { SavedImportRecord, SavedReviewData } from './persistence';
import type { ConfirmedTransaction } from './transactions';

export type AccountBalanceSummary = {
  account: Account;
  currentBalance: number;
  latestStatementEndingBalance: number | null;
  latestStatementPeriod: string | null;
  latestStatementEndDate: string | null;
  latestImportSavedAt: string | null;
  transactionCount: number;
  importCount: number;
};

export function buildAccountBalanceSummaries(data: SavedReviewData): AccountBalanceSummary[] {
  return data.accounts.map((account) => {
    const transactions = data.transactions.filter((transaction) => transaction.accountId === account.id);
    const imports = data.imports.filter((savedImport) => savedImport.accountId === account.id);
    const latestImport = getLatestImport(imports);

    return {
      account,
      currentBalance: getAccountCurrentBalance(account, transactions),
      latestStatementEndingBalance: latestImport?.statementEndingBalance ?? null,
      latestStatementPeriod: latestImport?.source.statementPeriod ?? null,
      latestStatementEndDate: latestImport ? getStatementEndDate(latestImport) : null,
      latestImportSavedAt: latestImport?.savedAt ?? null,
      transactionCount: transactions.length,
      importCount: imports.length,
    };
  });
}

export function getAccountCurrentBalance(account: Account, transactions: ConfirmedTransaction[]): number {
  return roundCurrency(
    transactions.reduce(
      (balance, transaction) => balance + getSignedTransactionEffect(account.type, transaction),
      account.openingBalance,
    ),
  );
}

export function getSignedTransactionEffect(accountType: AccountType, transaction: ConfirmedTransaction): number {
  if (accountType === 'credit_card') {
    return transaction.type === 'expense' ? -transaction.amount : transaction.amount;
  }

  return transaction.type === 'income' ? transaction.amount : -transaction.amount;
}

export function getLatestImport(imports: SavedImportRecord[]): SavedImportRecord | null {
  return [...imports].sort(compareImportsByStatementDate).at(-1) ?? null;
}

export function getStatementEndDate(savedImport: SavedImportRecord): string | null {
  const endDate = savedImport.source.statementPeriod.match(/\bto\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1] ?? null;
  return endDate && isIsoDate(endDate) ? endDate : null;
}

function compareImportsByStatementDate(a: SavedImportRecord, b: SavedImportRecord): number {
  const aDate = getStatementEndDate(a) ?? a.savedAt;
  const bDate = getStatementEndDate(b) ?? b.savedAt;
  return aDate.localeCompare(bDate);
}

function isIsoDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
