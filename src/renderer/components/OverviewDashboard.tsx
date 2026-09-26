import { useMemo, useState } from 'react';
import { buildAnalysisMonthOptions, buildExpenseAnalysisReport, formatMonthLabel, getDefaultAnalysisMonth } from '../../domain/analysis';
import type { SavedReviewData } from '../../domain/persistence';
import { AccountsSummary } from './AccountsSummary';
import { buildAccountBalanceSummaries } from '../../domain/balances';

type OverviewDashboardProps = {
  data: SavedReviewData;
  isLoading: boolean;
  onImport: () => void;
  onTransactions: (accountId?: string) => void;
  onInsights: () => void;
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function OverviewDashboard({ data, isLoading, onImport, onTransactions, onInsights }: OverviewDashboardProps) {
  const monthOptions = useMemo(() => buildAnalysisMonthOptions(data.transactions), [data.transactions]);
  const [requestedMonth, setRequestedMonth] = useState('');
  const month = monthOptions.some((option) => option.value === requestedMonth)
    ? requestedMonth
    : getDefaultAnalysisMonth(data.transactions);
  const report = useMemo(() => buildExpenseAnalysisReport(data, { accountId: '', month }), [data, month]);
  const monthExpenses = useMemo(
    () => data.transactions.filter((transaction) => transaction.type === 'expense' && transaction.date.startsWith(`${month}-`)),
    [data.transactions, month],
  );
  const fixedTotal = monthExpenses.reduce((total, transaction) => total + (transaction.expenseKind === 'fixed' ? transaction.amount : 0), 0);
  const flexibleTotal = monthExpenses.reduce((total, transaction) => total + (transaction.expenseKind === 'flexible' ? transaction.amount : 0), 0);
  const recentTransactions = useMemo(
    () => [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5),
    [data.transactions],
  );
  const accountNames = useMemo(() => new Map(data.accounts.map((account) => [account.id, account.name])), [data.accounts]);
  const balances = useMemo(() => buildAccountBalanceSummaries(data), [data]);

  return (
    <div className="overview-page">
      <div className="overview-heading">
        <div>
          <span className="eyebrow">Your money at a glance</span>
          <h1>Overview</h1>
          <p>A clear view of your spending and the activity behind it.</p>
        </div>
        <label className="month-picker">
          Period
          <select value={month} onChange={(event) => setRequestedMonth(event.target.value)} disabled={monthOptions.length === 0}>
            {monthOptions.length === 0 ? <option value={month}>{formatMonthLabel(month)}</option> : null}
            {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {data.transactions.length === 0 ? (
        <section className="overview-welcome">
          <span className="eyebrow">Start here</span>
          <h2>{isLoading ? 'Loading your finances…' : 'Bring your finances into focus.'}</h2>
          <p>Import a PDF statement to review its transactions, reconcile the balance, and build your first overview.</p>
          <button className="primary-button" type="button" onClick={onImport}>Import a statement</button>
        </section>
      ) : (
        <>
          <div className="overview-metrics" aria-label={`${formatMonthLabel(month)} summary`}>
            <Metric label="Income" value={money.format(report.incomeTotal)} tone="income" />
            <Metric label="Expenses" value={money.format(report.expenseTotal)} tone="expense" />
            <Metric label="Net cash flow" value={money.format(report.netCashFlow)} tone={report.netCashFlow < 0 ? 'expense' : 'income'} />
          </div>

          <div className="overview-grid">
            <section className="overview-card spending-card">
              <div className="overview-card-heading">
                <div><span className="eyebrow">Spending mix</span><h2>Fixed & flexible</h2></div>
                <span className="overview-card-caption">{formatMonthLabel(month)}</span>
              </div>
              {report.expenseTotal > 0 ? (
                <>
                  <div className="spending-track" aria-label={`Fixed ${money.format(fixedTotal)}, flexible ${money.format(flexibleTotal)}`}>
                    <span style={{ width: `${fixedTotal / report.expenseTotal * 100}%` }} />
                  </div>
                  <div className="spending-split">
                    <div><span className="split-dot fixed-dot" />Fixed<strong>{money.format(fixedTotal)}</strong></div>
                    <div><span className="split-dot flexible-dot" />Flexible<strong>{money.format(flexibleTotal)}</strong></div>
                  </div>
                </>
              ) : <p className="overview-muted">No expenses in this period.</p>}
            </section>

            <section className="overview-card categories-card">
              <div className="overview-card-heading">
                <div><span className="eyebrow">Where it went</span><h2>Top categories</h2></div>
                <button className="text-button" type="button" onClick={onInsights}>All insights →</button>
              </div>
              {report.categoryBreakdown.length === 0 ? <p className="overview-muted">No category spending in this period.</p> : (
                <div className="overview-category-list">
                  {report.categoryBreakdown.slice(0, 4).map((item) => (
                    <div className="overview-category" key={item.name}>
                      <div><span>{item.name}</span><strong>{money.format(item.amount)}</strong></div>
                      <span className="category-track"><span style={{ width: `${Math.min(100, item.percentOfExpenses * 100)}%` }} /></span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      <section className="overview-card recent-card">
        <div className="overview-card-heading">
          <div><span className="eyebrow">Activity</span><h2>Recent transactions</h2></div>
          <button className="text-button" type="button" onClick={() => onTransactions()}>View all →</button>
        </div>
        {recentTransactions.length === 0 ? <p className="overview-muted">Your latest transactions will appear here after an import.</p> : (
          <div className="recent-list">
            {recentTransactions.map((transaction) => (
              <div className="recent-row" key={transaction.id}>
                <span className={`recent-type recent-type-${transaction.type}`} aria-hidden="true">{transaction.type === 'income' ? '↗' : transaction.type === 'transfer' ? '⇄' : '↘'}</span>
                <div className="recent-description"><strong>{transaction.description}</strong><span>{accountNames.get(transaction.accountId) ?? 'Unknown account'} · {transaction.date}</span></div>
                <span className={`recent-amount ${transaction.type === 'income' ? 'positive-change' : ''}`}>{transaction.type === 'expense' ? '−' : transaction.type === 'income' ? '+' : ''}{money.format(transaction.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="overview-accounts">
        <AccountsSummary summaries={balances} selectedAccountId="" onSelectAccount={(accountId) => onTransactions(accountId)} />
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' }) {
  return <div className={`overview-metric overview-metric-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}
