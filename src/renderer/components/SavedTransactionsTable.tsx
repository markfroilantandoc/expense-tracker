import type { Account } from '../../domain/accounts';
import type { SavedTransaction } from '../../domain/persistence';

type SavedTransactionsTableProps = {
  transactions: SavedTransaction[];
  accounts: Account[];
  importCount: number;
  isLoading: boolean;
};

export function SavedTransactionsTable({ transactions, accounts, importCount, isLoading }: SavedTransactionsTableProps) {
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateComparison = a.date.localeCompare(b.date);
    return dateComparison === 0 ? a.description.localeCompare(b.description) : dateComparison;
  });
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  return (
    <section className="transactions-section" aria-labelledby="saved-transactions-title">
      <div className="section-header table-toolbar">
        <div>
          <h2 id="saved-transactions-title">Saved Transactions</h2>
          <span>
            {isLoading
              ? 'Loading saved review data'
              : `${transactions.length} transactions across ${importCount} imports`}
          </span>
        </div>
      </div>

      <div className="table-scroll saved-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Source</th>
              <th>Type</th>
              <th>Group</th>
              <th>Category</th>
              <th className="amount-column">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={7}>
                  Saved reviewed imports will appear here after you save confirmed transactions.
                </td>
              </tr>
            ) : (
              sortedTransactions.map((transaction) => (
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
    </section>
  );
}
