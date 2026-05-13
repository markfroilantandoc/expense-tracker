import type { ConfirmedTransaction } from '../../domain/transactions';

type ConfirmedTransactionsTableProps = {
  transactions: ConfirmedTransaction[];
  selectedIds: string[];
  onReturnSelected: () => void;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (id: string) => void;
};

export function ConfirmedTransactionsTable({
  transactions,
  selectedIds,
  onReturnSelected,
  onToggleAll,
  onToggleRow,
}: ConfirmedTransactionsTableProps) {
  return (
    <section className="transactions-section" aria-labelledby="confirmed-transactions-title">
      <div className="section-header table-toolbar">
        <div>
          <h2 id="confirmed-transactions-title">Confirmed Transactions</h2>
          <span>{transactions.length} selected for import</span>
        </div>
        <button type="button" onClick={onReturnSelected} disabled={selectedIds.length === 0}>
          Return Selected
        </button>
      </div>

      <div className="table-scroll confirmed-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="select-column">
                <input
                  aria-label="Select all confirmed transactions"
                  type="checkbox"
                  checked={transactions.length > 0 && selectedIds.length === transactions.length}
                  onChange={(event) => onToggleAll(event.target.checked)}
                />
              </th>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th>Group</th>
              <th>Category</th>
              <th className="amount-column">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={7}>
                  Confirm selected candidates to build the temporary transaction list.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} title={transaction.originalText}>
                  <td className="select-column">
                    <input
                      aria-label={`Select confirmed line ${transaction.lineNumber}`}
                      type="checkbox"
                      checked={selectedIds.includes(transaction.id)}
                      onChange={() => onToggleRow(transaction.id)}
                    />
                  </td>
                  <td>{transaction.date}</td>
                  <td>
                    <div className="description-cell">
                      <span>{transaction.description}</span>
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
