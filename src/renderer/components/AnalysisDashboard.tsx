import { useEffect, useMemo, useState } from 'react';
import {
  buildAnalysisMonthOptions,
  buildExpenseAnalysisReport,
  formatMonthLabel,
  getDefaultAnalysisMonth,
  type AnalysisBreakdownItem,
  type AnalysisComparisonItem,
} from '../../domain/analysis';
import type { Account } from '../../domain/accounts';
import type { SavedReviewData } from '../../domain/persistence';
import { SummaryItem } from './SummaryItem';

type AnalysisDashboardProps = {
  savedReviewData: SavedReviewData;
};

export function AnalysisDashboard({ savedReviewData }: AnalysisDashboardProps) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => getDefaultAnalysisMonth(savedReviewData.transactions));
  const monthOptions = useMemo(
    () => buildAnalysisMonthOptions(savedReviewData.transactions),
    [savedReviewData.transactions],
  );
  const report = useMemo(
    () =>
      buildExpenseAnalysisReport(savedReviewData, {
        accountId: selectedAccountId,
        month: selectedMonth,
      }),
    [savedReviewData, selectedAccountId, selectedMonth],
  );

  useEffect(() => {
    if (monthOptions.length > 0 && !monthOptions.some((option) => option.value === selectedMonth)) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [monthOptions, selectedMonth]);

  const selectedAccount = savedReviewData.accounts.find((account) => account.id === selectedAccountId);
  const hasTransactions = savedReviewData.transactions.length > 0;

  return (
    <section className="analysis-section" aria-labelledby="analysis-title">
      <div className="section-header analysis-header">
        <div>
          <h2 id="analysis-title">Analysis</h2>
          <span>{getAnalysisSummary(report.transactionCount, selectedAccount, selectedMonth)}</span>
        </div>
        <div className="analysis-filters">
          <label>
            Account
            <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
              <option value="">All accounts</option>
              {savedReviewData.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Month
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              disabled={monthOptions.length === 0}
            >
              {monthOptions.length === 0 ? (
                <option value={selectedMonth}>{formatMonthLabel(selectedMonth)}</option>
              ) : (
                monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.transactionCount})
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </div>

      {!hasTransactions ? (
        <p className="analysis-empty-state">Save reviewed transactions to unlock monthly analysis.</p>
      ) : (
        <>
          <div className="analysis-summary">
            <SummaryItem label="Income" value={formatCurrency(report.incomeTotal)} />
            <SummaryItem label="Expenses" value={formatCurrency(report.expenseTotal)} />
            <SummaryItem label="Transfers" value={formatCurrency(report.transferTotal)} />
            <SummaryItem label="Net Cash Flow" value={formatSignedCurrency(report.netCashFlow)} />
            <SummaryItem label="Savings Rate" value={formatPercent(report.savingsRate)} />
          </div>

          <div className="analysis-grid">
            <BreakdownPanel title="Top Categories" emptyMessage="No categorized expenses yet." items={report.categoryBreakdown} />
            <BreakdownPanel title="Top Merchants" emptyMessage="No merchant spending yet." items={report.merchantBreakdown} />
            <ComparisonPanel
              title="Month Comparison"
              previousMonth={report.previousMonth}
              currentMonth={report.month}
              items={report.categoryComparison}
            />
          </div>
        </>
      )}
    </section>
  );
}

function BreakdownPanel({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: AnalysisBreakdownItem[];
}) {
  return (
    <section className="analysis-panel" aria-label={title}>
      <div className="analysis-panel-header">
        <h3>{title}</h3>
        <span>{items.length} rows</span>
      </div>
      {items.length === 0 ? (
        <p className="panel-empty-state">{emptyMessage}</p>
      ) : (
        <div className="analysis-list">
          {items.map((item) => (
            <div className="analysis-list-row" key={item.name}>
              <div>
                <span>{item.name}</span>
                <small>{item.transactionCount} transactions</small>
              </div>
              <div className="analysis-value">
                <strong>{formatCurrency(item.amount)}</strong>
                <small>{formatPercent(item.percentOfExpenses)}</small>
              </div>
              <div className="analysis-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, item.percentOfExpenses * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ComparisonPanel({
  title,
  previousMonth,
  currentMonth,
  items,
}: {
  title: string;
  previousMonth: string;
  currentMonth: string;
  items: AnalysisComparisonItem[];
}) {
  return (
    <section className="analysis-panel" aria-label={title}>
      <div className="analysis-panel-header">
        <h3>{title}</h3>
        <span>
          {formatMonthLabel(previousMonth)} to {formatMonthLabel(currentMonth)}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="panel-empty-state">No expense categories to compare.</p>
      ) : (
        <div className="comparison-list">
          {items.map((item) => (
            <div className="comparison-row" key={item.name}>
              <div>
                <span>{item.name}</span>
                <small>
                  {formatCurrency(item.previousAmount)} to {formatCurrency(item.currentAmount)}
                </small>
              </div>
              <strong className={item.difference >= 0 ? 'negative-change' : 'positive-change'}>
                {formatSignedCurrency(item.difference)}
              </strong>
              <small>{item.percentChange === null ? 'New this month' : formatSignedPercent(item.percentChange)}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function getAnalysisSummary(transactionCount: number, selectedAccount: Account | undefined, selectedMonth: string): string {
  const accountScope = selectedAccount?.name ?? 'all accounts';
  return `${transactionCount} transactions for ${accountScope} in ${formatMonthLabel(selectedMonth)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatSignedCurrency(value: number): string {
  const formattedValue = formatCurrency(Math.abs(value));
  return value < 0 ? `-${formattedValue}` : formattedValue;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    style: 'percent',
  }).format(value);
}

function formatSignedPercent(value: number): string {
  const formattedValue = formatPercent(Math.abs(value));
  return value < 0 ? `-${formattedValue}` : `+${formattedValue}`;
}
