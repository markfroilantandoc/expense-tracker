import type { Category } from './categories';
import { reviewDataVersion, type SavedReviewData, type SavedTransaction } from './persistence';
import type { ExpenseKind } from './transactions';

export type LoadedReviewData = { data: SavedReviewData; migrated: boolean };

export function parseSavedReviewData(value: unknown): LoadedReviewData {
  if (!isRecord(value)) {
    throw new Error('The saved data file is not a valid object.');
  }

  if (value.version !== 1 && value.version !== reviewDataVersion) {
    throw new Error(`Unsupported saved data version: ${String(value.version)}.`);
  }

  if (!Array.isArray(value.accounts) || !Array.isArray(value.imports) || !Array.isArray(value.transactions)) {
    throw new Error('The saved data file is missing accounts, imports, or transactions.');
  }

  const accountIds = new Set<string>();
  for (const account of value.accounts) {
    if (!isRecord(account) || typeof account.id !== 'string') {
      throw new Error('The saved data file contains an invalid account.');
    }
    accountIds.add(account.id);
  }

  for (const savedImport of value.imports) {
    if (!isRecord(savedImport) || typeof savedImport.accountId !== 'string' ||
        !accountIds.has(savedImport.accountId) ||
        !Number.isFinite(savedImport.statementOpeningBalance) ||
        !Number.isFinite(savedImport.statementEndingBalance)) {
      throw new Error('The saved data file contains an invalid import.');
    }
  }

  const migrated = value.version === 1;
  const transactions = value.transactions.map((transaction, index) => {
    if (!isRecord(transaction) || typeof transaction.id !== 'string' ||
        typeof transaction.accountId !== 'string' || !accountIds.has(transaction.accountId) ||
        typeof transaction.category !== 'string' || !transaction.category.trim() ||
        !['expense', 'income', 'transfer'].includes(String(transaction.type))) {
      throw new Error(`The saved data file contains an invalid transaction at row ${index + 1}.`);
    }

    if (migrated) {
      const categoryGroup = transaction.categoryGroup;
      const rest = { ...transaction };
      delete rest.categoryGroup;
      delete rest.expenseKind;
      if (transaction.type !== 'expense') {
        return rest as SavedTransaction;
      }

      let expenseKind: ExpenseKind;
      if (categoryGroup === 'Fixed Expenses') {
        expenseKind = 'fixed';
      } else if (categoryGroup === 'Discretionary Expenses') {
        expenseKind = 'flexible';
      } else {
        throw new Error(`Cannot classify expense ${transaction.id}: unexpected group ${String(categoryGroup)}.`);
      }

      return { ...rest, category: transaction.category as Category, expenseKind } as SavedTransaction;
    }

    if (transaction.type === 'expense' && transaction.expenseKind !== 'fixed' && transaction.expenseKind !== 'flexible') {
      throw new Error(`Expense ${transaction.id} is missing a valid Fixed/Flexible value.`);
    }
    if (transaction.type !== 'expense' && transaction.expenseKind !== undefined) {
      throw new Error(`Non-expense transaction ${transaction.id} has a Fixed/Flexible value.`);
    }
    if ('categoryGroup' in transaction) {
      throw new Error(`Transaction ${transaction.id} still has a legacy category group.`);
    }

    return transaction as SavedTransaction;
  });

  return {
    migrated,
    data: {
      version: reviewDataVersion,
      accounts: value.accounts as SavedReviewData['accounts'],
      imports: value.imports as SavedReviewData['imports'],
      transactions,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
