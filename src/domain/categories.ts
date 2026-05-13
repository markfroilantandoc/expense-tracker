import type { TransactionType } from './transactions';

export type CategoryGroup = 'Fixed Expenses' | 'Discretionary Expenses' | 'Savings' | 'Income' | 'Transfer';

export type Category = {
  group: CategoryGroup;
  name: string;
};

type CategoryRule = {
  group: CategoryGroup;
  category: string;
  patterns: string[];
  transactionTypes?: TransactionType[];
};

export const categoryGroups: CategoryGroup[] = [
  'Fixed Expenses',
  'Discretionary Expenses',
  'Savings',
  'Income',
  'Transfer',
];

export const categoriesByGroup: Record<CategoryGroup, string[]> = {
  'Fixed Expenses': ['Housing', 'Utilities', 'Grocery', 'Transportation', 'Other'],
  'Discretionary Expenses': ['Food', 'Shopping', 'Subscription', 'Other'],
  Savings: ['Stocks', 'Interest Account', 'Other'],
  Income: ['Salary', 'Interest', 'Repayment', 'Other'],
  Transfer: ['Transfer'],
};

const defaultCategoryByGroup: Record<CategoryGroup, string> = {
  'Fixed Expenses': 'Other',
  'Discretionary Expenses': 'Other',
  Savings: 'Other',
  Income: 'Other',
  Transfer: 'Transfer',
};

const categoryRules: CategoryRule[] = [
  {
    group: 'Transfer',
    category: 'Transfer',
    patterns: ['payment', 'autopay', 'auto pay', 'transfer', 'e-transfer', 'credit card payment'],
    transactionTypes: ['transfer'],
  },
  {
    group: 'Income',
    category: 'Salary',
    patterns: ['payroll', 'salary', 'direct deposit', 'paycheque', 'paycheck'],
    transactionTypes: ['income'],
  },
  {
    group: 'Income',
    category: 'Interest',
    patterns: ['interest paid', 'interest credit', 'interest'],
    transactionTypes: ['income'],
  },
  {
    group: 'Income',
    category: 'Repayment',
    patterns: ['refund', 'reimbursement', 'repayment', 'cashback', 'cash back'],
    transactionTypes: ['income'],
  },
  {
    group: 'Savings',
    category: 'Stocks',
    patterns: ['wealthsimple', 'questrade', 'interactive brokers', 'brokerage', 'stock', 'investment'],
  },
  {
    group: 'Savings',
    category: 'Interest Account',
    patterns: ['savings account', 'high interest', 'hisa', 'gic'],
  },
  {
    group: 'Fixed Expenses',
    category: 'Housing',
    patterns: ['rent', 'mortgage', 'strata', 'property tax', 'home insurance'],
    transactionTypes: ['expense'],
  },
  {
    group: 'Fixed Expenses',
    category: 'Utilities',
    patterns: ['hydro', 'electric', 'water', 'utility', 'internet', 'telus', 'rogers', 'shaw', 'fortis'],
    transactionTypes: ['expense'],
  },
  {
    group: 'Fixed Expenses',
    category: 'Grocery',
    patterns: ['grocery', 'superstore', 'save on foods', 'safeway', 'costco', 'walmart', 'whole foods', 'no frills'],
    transactionTypes: ['expense'],
  },
  {
    group: 'Fixed Expenses',
    category: 'Transportation',
    patterns: ['translink', 'compass', 'shell', 'chevron', 'esso', 'petro', 'parking', 'insurance corporation'],
    transactionTypes: ['expense'],
  },
  {
    group: 'Discretionary Expenses',
    category: 'Subscription',
    patterns: ['netflix', 'spotify', 'apple.com/bill', 'google', 'amazon prime', 'subscription', 'patreon'],
    transactionTypes: ['expense'],
  },
  {
    group: 'Discretionary Expenses',
    category: 'Food',
    patterns: ['restaurant', 'cafe', 'coffee', 'starbucks', 'tim hortons', 'mcdonald', 'subway', 'doordash', 'uber eats'],
    transactionTypes: ['expense'],
  },
  {
    group: 'Discretionary Expenses',
    category: 'Shopping',
    patterns: ['amazon', 'best buy', 'ikea', 'home depot', 'store', 'shop', 'marketplace'],
    transactionTypes: ['expense'],
  },
];

export function suggestCategory(description: string, type: TransactionType): Category {
  const normalizedDescription = description.toLowerCase();
  const matchedRule = categoryRules.find((rule) => {
    const typeMatches = !rule.transactionTypes || rule.transactionTypes.includes(type);
    return typeMatches && rule.patterns.some((pattern) => normalizedDescription.includes(pattern));
  });

  if (matchedRule) {
    return {
      group: matchedRule.group,
      name: matchedRule.category,
    };
  }

  if (type === 'income') {
    return { group: 'Income', name: defaultCategoryByGroup.Income };
  }

  if (type === 'transfer') {
    return { group: 'Transfer', name: defaultCategoryByGroup.Transfer };
  }

  return { group: 'Discretionary Expenses', name: defaultCategoryByGroup['Discretionary Expenses'] };
}

export function getDefaultCategory(group: CategoryGroup): string {
  return defaultCategoryByGroup[group];
}
