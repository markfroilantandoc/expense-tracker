import type { Account } from './accounts';
import type { SavedReviewData, SavedTransaction } from './persistence';

export type AnalysisMonthOption = {
  value: string;
  label: string;
  transactionCount: number;
};

export type AnalysisBreakdownItem = {
  name: string;
  amount: number;
  transactionCount: number;
  percentOfExpenses: number;
};

export type AnalysisComparisonItem = {
  name: string;
  currentAmount: number;
  previousAmount: number;
  difference: number;
  percentChange: number | null;
};

export type ExpenseAnalysisReport = {
  month: string;
  previousMonth: string;
  transactionCount: number;
  incomeTotal: number;
  expenseTotal: number;
  transferTotal: number;
  netCashFlow: number;
  savingsRate: number | null;
  categoryGroupBreakdown: AnalysisBreakdownItem[];
  categoryBreakdown: AnalysisBreakdownItem[];
  merchantBreakdown: AnalysisBreakdownItem[];
  categoryComparison: AnalysisComparisonItem[];
};

type AnalysisScope = {
  accountId: string;
  month: string;
};

export function buildAnalysisMonthOptions(transactions: SavedTransaction[]): AnalysisMonthOption[] {
  const monthCounts = transactions.reduce((counts, transaction) => {
    const month = getTransactionMonth(transaction);

    if (!month) {
      return counts;
    }

    counts.set(month, (counts.get(month) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return [...monthCounts.entries()]
    .sort(([monthA], [monthB]) => monthB.localeCompare(monthA))
    .map(([value, transactionCount]) => ({
      value,
      label: formatMonthLabel(value),
      transactionCount,
    }));
}

export function getDefaultAnalysisMonth(transactions: SavedTransaction[]): string {
  return buildAnalysisMonthOptions(transactions)[0]?.value ?? getCurrentMonth();
}

export function buildExpenseAnalysisReport(
  data: SavedReviewData,
  scope: AnalysisScope,
): ExpenseAnalysisReport {
  const currentTransactions = filterTransactionsForScope(data.transactions, scope);
  const previousMonth = getPreviousMonth(scope.month);
  const previousTransactions = filterTransactionsForScope(data.transactions, {
    ...scope,
    month: previousMonth,
  });
  const expenseTransactions = currentTransactions.filter((transaction) => transaction.type === 'expense');
  const previousExpenseTransactions = previousTransactions.filter((transaction) => transaction.type === 'expense');
  const incomeTotal = sumTransactionsByType(currentTransactions, 'income');
  const expenseTotal = sumTransactionsByType(currentTransactions, 'expense');
  const transferTotal = sumTransactionsByType(currentTransactions, 'transfer');

  return {
    month: scope.month,
    previousMonth,
    transactionCount: currentTransactions.length,
    incomeTotal,
    expenseTotal,
    transferTotal,
    netCashFlow: roundCurrency(incomeTotal - expenseTotal),
    savingsRate: incomeTotal > 0 ? roundRatio((incomeTotal - expenseTotal) / incomeTotal) : null,
    categoryGroupBreakdown: buildBreakdown(
      expenseTransactions,
      (transaction) => transaction.categoryGroup,
      expenseTotal,
    ),
    categoryBreakdown: buildBreakdown(expenseTransactions, getCategoryKey, expenseTotal),
    merchantBreakdown: buildBreakdown(expenseTransactions, getMerchantKey, expenseTotal).slice(0, 8),
    categoryComparison: buildCategoryComparison(expenseTransactions, previousExpenseTransactions),
  };
}

export function getAccountName(accounts: Account[], accountId: string): string {
  return accounts.find((account) => account.id === accountId)?.name ?? 'All accounts';
}

export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function filterTransactionsForScope(transactions: SavedTransaction[], scope: AnalysisScope): SavedTransaction[] {
  return transactions.filter(
    (transaction) =>
      (!scope.accountId || transaction.accountId === scope.accountId) && getTransactionMonth(transaction) === scope.month,
  );
}

function buildBreakdown(
  transactions: SavedTransaction[],
  getKey: (transaction: SavedTransaction) => string,
  expenseTotal: number,
): AnalysisBreakdownItem[] {
  const totals = transactions.reduce((items, transaction) => {
    const key = getKey(transaction);
    const currentItem = items.get(key) ?? {
      name: key,
      amount: 0,
      transactionCount: 0,
      percentOfExpenses: 0,
    };

    currentItem.amount = roundCurrency(currentItem.amount + transaction.amount);
    currentItem.transactionCount += 1;
    items.set(key, currentItem);
    return items;
  }, new Map<string, AnalysisBreakdownItem>());

  return [...totals.values()]
    .map((item) => ({
      ...item,
      percentOfExpenses: expenseTotal > 0 ? roundRatio(item.amount / expenseTotal) : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

function buildCategoryComparison(
  currentTransactions: SavedTransaction[],
  previousTransactions: SavedTransaction[],
): AnalysisComparisonItem[] {
  const currentTotals = buildTotalMap(currentTransactions, getCategoryKey);
  const previousTotals = buildTotalMap(previousTransactions, getCategoryKey);
  const names = new Set([...currentTotals.keys(), ...previousTotals.keys()]);

  return [...names]
    .map((name) => {
      const currentAmount = currentTotals.get(name) ?? 0;
      const previousAmount = previousTotals.get(name) ?? 0;
      const difference = roundCurrency(currentAmount - previousAmount);

      return {
        name,
        currentAmount,
        previousAmount,
        difference,
        percentChange: previousAmount > 0 ? roundRatio(difference / previousAmount) : null,
      };
    })
    .filter((item) => item.currentAmount > 0 || item.previousAmount > 0)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference) || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function buildTotalMap(
  transactions: SavedTransaction[],
  getKey: (transaction: SavedTransaction) => string,
): Map<string, number> {
  return transactions.reduce((totals, transaction) => {
    const key = getKey(transaction);
    totals.set(key, roundCurrency((totals.get(key) ?? 0) + transaction.amount));
    return totals;
  }, new Map<string, number>());
}

function sumTransactionsByType(transactions: SavedTransaction[], type: SavedTransaction['type']): number {
  return roundCurrency(
    transactions
      .filter((transaction) => transaction.type === type)
      .reduce((total, transaction) => total + transaction.amount, 0),
  );
}

function getTransactionMonth(transaction: SavedTransaction): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(transaction.date) ? transaction.date.slice(0, 7) : null;
}

function getCategoryKey(transaction: SavedTransaction): string {
  return `${transaction.categoryGroup}: ${transaction.category}`;
}

function getMerchantKey(transaction: SavedTransaction): string {
  const normalizedDescription = transaction.description
    .toLowerCase()
    .replace(/\b\d{2,}\b/g, ' ')
    .replace(/[^\w\s&'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedDescription) {
    return 'Unlabeled merchant';
  }

  return normalizedDescription
    .split(' ')
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getPreviousMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return date.toISOString().slice(0, 7);
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
