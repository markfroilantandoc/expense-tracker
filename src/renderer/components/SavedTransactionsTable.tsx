import { useEffect, useMemo, useState } from 'react';
import type { Account } from '../../domain/accounts';
import { categoryGroups, type CategoryGroup } from '../../domain/categories';
import type { SavedTransaction } from '../../domain/persistence';
import { transactionTypes, type TransactionType } from '../../domain/transactions';

type TransactionFilters = {
  dateFrom: string;
  dateTo: string;
  description: string;
  source: string;
  type: '' | TransactionType;
  categoryGroup: '' | CategoryGroup;
  category: string;
  amountMin: string;
  amountMax: string;
};

type SavedTransactionsTableProps = {
  transactions: SavedTransaction[];
  accounts: Account[];
  selectedAccountId: string;
  totalTransactionCount: number;
  importCount: number;
  isLoading: boolean;
  onAccountFilterChange: (accountId: string) => void;
};

export function SavedTransactionsTable({
  transactions,
  accounts,
  selectedAccountId,
  totalTransactionCount,
  importCount,
  isLoading,
  onAccountFilterChange,
}: SavedTransactionsTableProps) {
  const [filters, setFilters] = useState<TransactionFilters>(emptyTransactionFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const selectedAccount = accountsById.get(selectedAccountId);
  const hasColumnFilters = hasActiveColumnFilters(filters);
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, accountsById, filters),
    [accountsById, filters, transactions],
  );
  const sortedTransactions = useMemo(
    () =>
      [...filteredTransactions].sort((a, b) => {
        const dateComparison = a.date.localeCompare(b.date);
        return dateComparison === 0 ? a.description.localeCompare(b.description) : dateComparison;
      }),
    [filteredTransactions],
  );
  const pageCount = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const boundedCurrentPage = Math.min(currentPage, pageCount);
  const pageStartIndex = (boundedCurrentPage - 1) * pageSize;
  const pageTransactions = sortedTransactions.slice(pageStartIndex, pageStartIndex + pageSize);
  const firstVisibleRow = sortedTransactions.length === 0 ? 0 : pageStartIndex + 1;
  const lastVisibleRow = Math.min(pageStartIndex + pageSize, sortedTransactions.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize, selectedAccountId]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  function updateFilter<Field extends keyof TransactionFilters>(field: Field, value: TransactionFilters[Field]) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
  }

  return (
    <section className="transactions-section" aria-labelledby="saved-transactions-title">
      <div className="section-header table-toolbar">
        <div>
          <h2 id="saved-transactions-title">Saved Transactions</h2>
          <span>
            {isLoading
              ? 'Loading saved review data'
              : getTableSummary(
                  sortedTransactions.length,
                  transactions.length,
                  totalTransactionCount,
                  importCount,
                  selectedAccount?.name,
                  hasColumnFilters,
                )}
          </span>
        </div>
        <div className="saved-table-actions">
          <label className="account-filter">
            Account
            <select value={selectedAccountId} onChange={(event) => onAccountFilterChange(event.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={() => setFilters(emptyTransactionFilters)}
            disabled={!hasColumnFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="table-scroll saved-table-scroll">
        <table>
          <thead>
            <tr className="table-label-row">
              <th>Date</th>
              <th>Description</th>
              <th>Source</th>
              <th>Type</th>
              <th>Group</th>
              <th>Category</th>
              <th className="amount-column">Amount</th>
            </tr>
            <tr className="table-filter-row">
              <th>
                <div className="stacked-filter">
                  <input
                    aria-label="Date from"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(event) => updateFilter('dateFrom', event.target.value)}
                  />
                  <input
                    aria-label="Date to"
                    type="date"
                    value={filters.dateTo}
                    onChange={(event) => updateFilter('dateTo', event.target.value)}
                  />
                </div>
              </th>
              <th>
                <input
                  aria-label="Filter by description"
                  placeholder="Search description"
                  value={filters.description}
                  onChange={(event) => updateFilter('description', event.target.value)}
                />
              </th>
              <th>
                <input
                  aria-label="Filter by source"
                  placeholder="Account or issuer"
                  value={filters.source}
                  onChange={(event) => updateFilter('source', event.target.value)}
                />
              </th>
              <th>
                <select
                  aria-label="Filter by transaction type"
                  value={filters.type}
                  onChange={(event) => updateFilter('type', event.target.value as TransactionFilters['type'])}
                >
                  <option value="">Any type</option>
                  {transactionTypes.map((transactionType) => (
                    <option key={transactionType} value={transactionType}>
                      {transactionType}
                    </option>
                  ))}
                </select>
              </th>
              <th>
                <select
                  aria-label="Filter by category group"
                  value={filters.categoryGroup}
                  onChange={(event) =>
                    updateFilter('categoryGroup', event.target.value as TransactionFilters['categoryGroup'])
                  }
                >
                  <option value="">Any group</option>
                  {categoryGroups.map((categoryGroup) => (
                    <option key={categoryGroup} value={categoryGroup}>
                      {categoryGroup}
                    </option>
                  ))}
                </select>
              </th>
              <th>
                <input
                  aria-label="Filter by category"
                  placeholder="Search category"
                  value={filters.category}
                  onChange={(event) => updateFilter('category', event.target.value)}
                />
              </th>
              <th className="amount-column">
                <div className="stacked-filter">
                  <input
                    aria-label="Minimum amount"
                    inputMode="decimal"
                    placeholder="Min"
                    value={filters.amountMin}
                    onChange={(event) => updateFilter('amountMin', event.target.value)}
                  />
                  <input
                    aria-label="Maximum amount"
                    inputMode="decimal"
                    placeholder="Max"
                    value={filters.amountMax}
                    onChange={(event) => updateFilter('amountMax', event.target.value)}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={7}>
                  {getEmptyStateMessage(totalTransactionCount, selectedAccount?.name, hasColumnFilters)}
                </td>
              </tr>
            ) : (
              pageTransactions.map((transaction) => (
                <tr key={transaction.id} title={transaction.originalText}>
                  <td>{transaction.date}</td>
                  <td>
                    <div className="description-cell">
                      <span>{transaction.description}</span>
                    </div>
                  </td>
                  <td>
                    <div className="source-cell">
                      <span>{accountsById.get(transaction.accountId)?.name ?? 'Unknown account'}</span>
                      <small>{transaction.source.issuer}</small>
                    </div>
                  </td>
                  <td>{transaction.type}</td>
                  <td>{transaction.categoryGroup}</td>
                  <td>{transaction.category}</td>
                  <td className="amount-column">${transaction.amount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar">
        <span>
          Showing {firstVisibleRow}-{lastVisibleRow} of {sortedTransactions.length}
        </span>
        <label>
          Rows
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {[10, 25, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="pagination-actions">
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={boundedCurrentPage === 1}
          >
            First
          </button>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={boundedCurrentPage === 1}
          >
            Previous
          </button>
          <span>
            Page {boundedCurrentPage} of {pageCount}
          </span>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
            disabled={boundedCurrentPage === pageCount}
          >
            Next
          </button>
          <button
            className="secondary-button compact-button"
            type="button"
            onClick={() => setCurrentPage(pageCount)}
            disabled={boundedCurrentPage === pageCount}
          >
            Last
          </button>
        </div>
      </div>
    </section>
  );
}

const emptyTransactionFilters: TransactionFilters = {
  dateFrom: '',
  dateTo: '',
  description: '',
  source: '',
  type: '',
  categoryGroup: '',
  category: '',
  amountMin: '',
  amountMax: '',
};

function getTableSummary(
  filteredTransactionCount: number,
  accountTransactionCount: number,
  totalTransactionCount: number,
  importCount: number,
  selectedAccountName?: string,
  hasColumnFilters = false,
): string {
  if (hasColumnFilters) {
    const scope = selectedAccountName ? ` for ${selectedAccountName}` : '';
    return `${filteredTransactionCount} of ${accountTransactionCount} transactions${scope} match filters`;
  }

  if (selectedAccountName) {
    return `${accountTransactionCount} of ${totalTransactionCount} transactions for ${selectedAccountName}`;
  }

  return `${totalTransactionCount} transactions across ${importCount} imports`;
}

function filterTransactions(
  transactions: SavedTransaction[],
  accountsById: Map<string, Account>,
  filters: TransactionFilters,
): SavedTransaction[] {
  const normalizedDescription = normalizeSearch(filters.description);
  const normalizedSource = normalizeSearch(filters.source);
  const normalizedCategory = normalizeSearch(filters.category);
  const amountMin = parseOptionalAmount(filters.amountMin);
  const amountMax = parseOptionalAmount(filters.amountMax);

  return transactions.filter((transaction) => {
    const account = accountsById.get(transaction.accountId);
    const sourceText = normalizeSearch(
      [account?.name, account?.issuer, account?.lastDigits, transaction.source.issuer, transaction.source.account]
        .filter(Boolean)
        .join(' '),
    );

    return (
      (!filters.dateFrom || transaction.date >= filters.dateFrom) &&
      (!filters.dateTo || transaction.date <= filters.dateTo) &&
      (!normalizedDescription || normalizeSearch(transaction.description).includes(normalizedDescription)) &&
      (!normalizedSource || sourceText.includes(normalizedSource)) &&
      (!filters.type || transaction.type === filters.type) &&
      (!filters.categoryGroup || transaction.categoryGroup === filters.categoryGroup) &&
      (!normalizedCategory || normalizeSearch(transaction.category).includes(normalizedCategory)) &&
      (amountMin === null || transaction.amount >= amountMin) &&
      (amountMax === null || transaction.amount <= amountMax)
    );
  });
}

function hasActiveColumnFilters(filters: TransactionFilters): boolean {
  return Object.values(filters).some((value) => value.trim() !== '');
}

function parseOptionalAmount(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const amount = Number(trimmedValue.replace(/[$,\s]/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function getEmptyStateMessage(
  totalTransactionCount: number,
  selectedAccountName: string | undefined,
  hasColumnFilters: boolean,
): string {
  if (totalTransactionCount === 0) {
    return 'Saved reviewed imports will appear here after you save confirmed transactions.';
  }

  if (hasColumnFilters) {
    return 'No saved transactions match the current filters.';
  }

  if (selectedAccountName) {
    return `No saved transactions for ${selectedAccountName}.`;
  }

  return 'No saved transactions match the current view.';
}
