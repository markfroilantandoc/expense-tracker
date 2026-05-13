export type AccountType = 'credit_card' | 'checking' | 'savings' | 'other';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  issuer: string;
  lastDigits?: string;
  openingBalance: number;
  createdAt: string;
  updatedAt: string;
};

export type AccountDraft = {
  name: string;
  type: AccountType;
  issuer: string;
  lastDigits: string;
  openingBalance: string;
};

export type CreateAccountPayload = AccountDraft;

export const accountTypes: AccountType[] = ['credit_card', 'checking', 'savings', 'other'];

export const emptyAccountDraft: AccountDraft = {
  name: '',
  type: 'credit_card',
  issuer: '',
  lastDigits: '',
  openingBalance: '',
};

export function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'credit_card':
      return 'Credit card';
    case 'checking':
      return 'Checking';
    case 'savings':
      return 'Savings';
    case 'other':
      return 'Other';
  }
}
