import { accountTypeLabel } from '../../domain/accounts';
import type { AccountBalanceSummary } from '../../domain/balances';

type AccountsSummaryProps = {
  summaries: AccountBalanceSummary[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
};

export function AccountsSummary({ summaries, selectedAccountId, onSelectAccount }: AccountsSummaryProps) {
  return (
    <section className="accounts-section" aria-labelledby="accounts-summary-title">
      <div className="section-header">
        <div>
          <h2 id="accounts-summary-title">Accounts</h2>
          <span>{summaries.length} saved accounts</span>
        </div>
      </div>

      <div className="accounts-grid">
        {summaries.length === 0 ? (
          <p className="accounts-empty-state">Create an account during statement import to start tracking balances.</p>
        ) : (
          summaries.map((summary) => {
            const isSelected = selectedAccountId === summary.account.id;

            return (
              <button
                className={`account-summary-card ${isSelected ? 'account-summary-card-selected' : ''}`}
                key={summary.account.id}
                type="button"
                onClick={() => onSelectAccount(isSelected ? '' : summary.account.id)}
              >
                <div className="account-summary-heading">
                  <span>{summary.account.name}</span>
                  <small>{accountTypeLabel(summary.account.type)}</small>
                </div>
                <div className="account-summary-meta">
                  <span>{formatAccountSource(summary)}</span>
                  <span>{summary.importCount} imports</span>
                  <span>{summary.transactionCount} transactions</span>
                </div>
                <dl className="account-balance-grid">
                  <div>
                    <dt>{summary.account.type === 'credit_card' ? getCreditBalanceLabel(summary.currentBalance) : 'Balance'}</dt>
                    <dd>{formatLedgerBalance(summary.account.type, summary.currentBalance)}</dd>
                  </div>
                  <div>
                    <dt>Latest Statement</dt>
                    <dd>
                      {summary.latestStatementEndingBalance === null
                        ? 'No imports'
                        : formatLedgerBalance(summary.account.type, summary.latestStatementEndingBalance)}
                    </dd>
                  </div>
                </dl>
                <span className="account-summary-footer">
                  {summary.latestStatementEndDate
                    ? `Statement ended ${summary.latestStatementEndDate}`
                    : summary.latestImportSavedAt
                      ? `Imported ${summary.latestImportSavedAt.slice(0, 10)}`
                      : 'No saved statements'}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function formatAccountSource(summary: AccountBalanceSummary): string {
  const sourceParts = [summary.account.issuer, summary.account.lastDigits ? `Ending ${summary.account.lastDigits}` : '']
    .map((part) => part.trim())
    .filter(Boolean);
  return sourceParts.length > 0 ? sourceParts.join(' - ') : 'No issuer details';
}

function formatLedgerBalance(accountType: AccountBalanceSummary['account']['type'], balance: number): string {
  const displayAmount = accountType === 'credit_card' ? Math.abs(balance) : balance;
  return formatCurrency(displayAmount);
}

function getCreditBalanceLabel(balance: number): string {
  return balance <= 0 ? 'Owed' : 'Credit';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}
