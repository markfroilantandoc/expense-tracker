import type { ExpenseKind, TransactionType } from './transactions';

export const categories = [
  'Housing', 'Utilities', 'Grocery', 'Transportation', 'Food', 'Shopping', 'Subscription',
  'Stocks', 'Interest Account', 'Salary', 'Interest', 'Repayment', 'Transfer', 'Other',
] as const;

export type Category = typeof categories[number];

export type CategorySuggestion = {
  category: Category;
  expenseKind?: ExpenseKind;
};

type CategoryRule = CategorySuggestion & {
  patterns: string[];
  transactionTypes?: TransactionType[];
};

const categoryRules: CategoryRule[] = [
  { category: 'Transfer', patterns: ['payment', 'autopay', 'auto pay', 'transfer', 'e-transfer', 'credit card payment'], transactionTypes: ['transfer'] },
  { category: 'Salary', patterns: ['payroll', 'salary', 'direct deposit', 'paycheque', 'paycheck'], transactionTypes: ['income'] },
  { category: 'Interest', patterns: ['interest paid', 'interest credit', 'interest'], transactionTypes: ['income'] },
  { category: 'Repayment', patterns: ['refund', 'reimbursement', 'repayment', 'cashback', 'cash back'], transactionTypes: ['income'] },
  { category: 'Stocks', patterns: ['wealthsimple', 'questrade', 'interactive brokers', 'brokerage', 'stock', 'investment'] },
  { category: 'Interest Account', patterns: ['savings account', 'high interest', 'hisa', 'gic'] },
  { category: 'Housing', expenseKind: 'fixed', patterns: ['rent', 'mortgage', 'strata', 'property tax', 'home insurance'], transactionTypes: ['expense'] },
  { category: 'Utilities', expenseKind: 'fixed', patterns: ['hydro', 'electric', 'water', 'utility', 'internet', 'telus', 'rogers', 'shaw', 'fortis'], transactionTypes: ['expense'] },
  { category: 'Grocery', expenseKind: 'fixed', patterns: ['grocery', 'superstore', 'save on foods', 'safeway', 'costco', 'walmart', 'whole foods', 'no frills'], transactionTypes: ['expense'] },
  { category: 'Transportation', expenseKind: 'fixed', patterns: ['translink', 'compass', 'shell', 'chevron', 'esso', 'petro', 'parking', 'insurance corporation'], transactionTypes: ['expense'] },
  { category: 'Subscription', expenseKind: 'flexible', patterns: ['netflix', 'spotify', 'apple.com/bill', 'google', 'amazon prime', 'subscription', 'patreon'], transactionTypes: ['expense'] },
  { category: 'Food', expenseKind: 'flexible', patterns: ['restaurant', 'cafe', 'coffee', 'starbucks', 'tim hortons', 'mcdonald', 'subway', 'doordash', 'uber eats'], transactionTypes: ['expense'] },
  { category: 'Shopping', expenseKind: 'flexible', patterns: ['amazon', 'best buy', 'ikea', 'home depot', 'store', 'shop', 'marketplace'], transactionTypes: ['expense'] },
];

export function suggestCategory(description: string, type: TransactionType): CategorySuggestion {
  const normalizedDescription = description.toLowerCase();
  const matchedRule = categoryRules.find((rule) =>
    (!rule.transactionTypes || rule.transactionTypes.includes(type)) &&
    rule.patterns.some((pattern) => normalizedDescription.includes(pattern)),
  );

  if (matchedRule) {
    return {
      category: matchedRule.category,
      ...(type === 'expense' ? { expenseKind: matchedRule.expenseKind ?? 'flexible' } : {}),
    };
  }

  if (type === 'transfer') {
    return { category: 'Transfer' };
  }

  return type === 'expense' ? { category: 'Other', expenseKind: 'flexible' } : { category: 'Other' };
}
