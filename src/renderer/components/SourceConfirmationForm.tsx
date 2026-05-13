import type { FormEvent } from 'react';
import {
  accountTypeLabel,
  accountTypes,
  type Account,
  type AccountDraft,
  type AccountType,
} from '../../domain/accounts';

type SourceConfirmationFormProps = {
  accounts: Account[];
  selectedAccountId: string;
  accountDraft: AccountDraft;
  statementStartDate: string;
  statementEndDate: string;
  statementOpeningBalance: string;
  statementEndingBalance: string;
  isSaving: boolean;
  onSelectedAccountChange: (value: string) => void;
  onAccountDraftChange: (field: keyof AccountDraft, value: string) => void;
  onAccountTypeChange: (value: AccountType) => void;
  onCreateAccount: () => void;
  onStatementStartDateChange: (value: string) => void;
  onStatementEndDateChange: (value: string) => void;
  onStatementOpeningBalanceChange: (value: string) => void;
  onStatementEndingBalanceChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SourceConfirmationForm({
  accounts,
  selectedAccountId,
  accountDraft,
  statementStartDate,
  statementEndDate,
  statementOpeningBalance,
  statementEndingBalance,
  isSaving,
  onSelectedAccountChange,
  onAccountDraftChange,
  onAccountTypeChange,
  onCreateAccount,
  onStatementStartDateChange,
  onStatementEndDateChange,
  onStatementOpeningBalanceChange,
  onStatementEndingBalanceChange,
  onSubmit,
}: SourceConfirmationFormProps) {
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const statementBalanceLabel = selectedAccount?.type === 'credit_card' ? 'amount owed' : 'balance';
  const accountOpeningLabel = accountDraft.type === 'credit_card' ? 'Opening amount owed ($)' : 'Opening balance ($)';

  return (
    <form className="source-form" onSubmit={onSubmit}>
      <label>
        Account
        <select value={selectedAccountId} onChange={(event) => onSelectedAccountChange(event.target.value)}>
          <option value="">Choose account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Statement start date
        <input
          type="date"
          value={statementStartDate}
          onChange={(event) => onStatementStartDateChange(event.target.value)}
        />
      </label>
      <label>
        Statement end date
        <input
          type="date"
          value={statementEndDate}
          onChange={(event) => onStatementEndDateChange(event.target.value)}
        />
      </label>
      <label>
        Opening {statementBalanceLabel} ($)
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={statementOpeningBalance}
          onChange={(event) => onStatementOpeningBalanceChange(event.target.value)}
        />
      </label>
      <label>
        Ending {statementBalanceLabel} ($)
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={statementEndingBalance}
          onChange={(event) => onStatementEndingBalanceChange(event.target.value)}
        />
      </label>
      <fieldset className="account-create-panel">
        <legend>Create Account</legend>
        <label>
          Name
          <input value={accountDraft.name} onChange={(event) => onAccountDraftChange('name', event.target.value)} />
        </label>
        <label>
          Type
          <select value={accountDraft.type} onChange={(event) => onAccountTypeChange(event.target.value as AccountType)}>
            {accountTypes.map((accountType) => (
              <option key={accountType} value={accountType}>
                {accountTypeLabel(accountType)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Issuer
          <input value={accountDraft.issuer} onChange={(event) => onAccountDraftChange('issuer', event.target.value)} />
        </label>
        <label>
          Last digits
          <input
            value={accountDraft.lastDigits}
            onChange={(event) => onAccountDraftChange('lastDigits', event.target.value)}
          />
        </label>
        <label>
          {accountOpeningLabel}
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={accountDraft.openingBalance}
            onChange={(event) => onAccountDraftChange('openingBalance', event.target.value)}
          />
        </label>
        <button type="button" onClick={onCreateAccount} disabled={isSaving}>
          {isSaving ? 'Creating...' : 'Create Account'}
        </button>
      </fieldset>
      <button type="submit">Confirm Source</button>
    </form>
  );
}
