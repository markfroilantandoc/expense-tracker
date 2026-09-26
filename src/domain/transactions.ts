import { suggestCategory, type Category } from './categories';

export type TransactionType = 'expense' | 'income' | 'transfer';
export type ExpenseKind = 'fixed' | 'flexible';

export type TransactionCandidate = {
  id: string;
  lineNumber: number;
  originalText: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  confidence: 'medium' | 'low';
};

export type CategorizedTransaction = TransactionCandidate & {
  category: Category;
  expenseKind?: ExpenseKind;
};

export type CandidateDraft = Omit<CategorizedTransaction, 'amount'> & {
  amount: string;
};

export type ConfirmedTransaction = CategorizedTransaction;

export const transactionTypes: TransactionType[] = ['expense', 'income', 'transfer'];
export const expenseKinds: ExpenseKind[] = ['fixed', 'flexible'];

export function candidateToDraft(candidate: TransactionCandidate): CandidateDraft {
  return {
    ...candidate,
    amount: candidate.amount.toFixed(2),
    ...suggestCategory(candidate.description, candidate.type),
  };
}

export function draftToConfirmed(candidate: CandidateDraft): ConfirmedTransaction {
  return {
    ...candidate,
    amount: parseAmount(candidate.amount),
  };
}

export function updateDraftType(candidate: CandidateDraft, type: TransactionType): CandidateDraft {
  if (candidate.type === type) {
    return candidate;
  }

  const next: CandidateDraft = { ...candidate, type, ...suggestCategory(candidate.description, type) };
  if (type !== 'expense') {
    delete next.expenseKind;
  }
  return next;
}

export function getManualTransactionDraft(): CandidateDraft {
  return {
    id: 'manual_draft',
    lineNumber: Number.MAX_SAFE_INTEGER,
    originalText: 'Manual transaction',
    date: '',
    description: '',
    type: 'expense',
    amount: '',
    confidence: 'medium',
    category: 'Other',
    expenseKind: 'flexible',
  };
}

export function compareConfirmedTransactions(a: ConfirmedTransaction, b: ConfirmedTransaction): number {
  const dateComparison = a.date.localeCompare(b.date);
  return dateComparison === 0 ? a.lineNumber - b.lineNumber : dateComparison;
}

export function compareCandidateDraftsByLine(a: CandidateDraft, b: CandidateDraft): number {
  return a.lineNumber - b.lineNumber;
}

export function isValidAmount(value: string): boolean {
  const amount = parseAmount(value);
  return Number.isFinite(amount) && amount > 0;
}

export function isValidCurrencyAmount(value: string): boolean {
  const amount = parseAmount(value);
  return Number.isFinite(amount);
}

export function parseAmount(value: string): number {
  return Number(value.replace(/[$,\s]/g, ''));
}
