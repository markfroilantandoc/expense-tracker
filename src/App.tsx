import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import {
  categoriesByGroup,
  categoryGroups,
  getDefaultCategory,
  suggestCategory,
  type CategoryGroup,
} from './categories';
import type { ExpenseTrackerApi } from './preload';
import type { PdfParseResult, StatementSource, TransactionCandidate, TransactionType } from './pdfImport';

declare global {
  interface Window {
    expenseTracker: ExpenseTrackerApi;
  }
}

type ImportStatus = 'idle' | 'parsing' | 'confirming' | 'parsed' | 'error';

type ImportError = {
  title: string;
  message: string;
};

type CategorizedTransaction = TransactionCandidate & {
  categoryGroup: CategoryGroup;
  category: string;
};

type CandidateDraft = Omit<CategorizedTransaction, 'amount'> & {
  amount: string;
};

type ConfirmedTransaction = CategorizedTransaction;

type SelectionTable = 'candidate' | 'confirmed';

const transactionTypes: TransactionType[] = ['expense', 'income', 'transfer'];

const emptySource: StatementSource = {
  issuer: '',
  account: '',
  statementPeriod: '',
};

export function App() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [parseResult, setParseResult] = useState<PdfParseResult | null>(null);
  const [sourceForm, setSourceForm] = useState<StatementSource>(emptySource);
  const [confirmedSource, setConfirmedSource] = useState<StatementSource | null>(null);
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [candidateDrafts, setCandidateDrafts] = useState<CandidateDraft[]>([]);
  const [confirmedTransactions, setConfirmedTransactions] = useState<ConfirmedTransaction[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [selectedConfirmedIds, setSelectedConfirmedIds] = useState<string[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const originalCandidatesById = useMemo(
    () => new Map((parseResult?.candidates ?? []).map((candidate) => [candidate.id, candidate])),
    [parseResult],
  );
  const invalidSelectedCandidateIds = useMemo(
    () =>
      candidateDrafts
        .filter((candidate) => selectedCandidateIds.includes(candidate.id) && !isValidAmount(candidate.amount))
        .map((candidate) => candidate.id),
    [candidateDrafts, selectedCandidateIds],
  );
  const sortedConfirmedTransactions = useMemo(
    () => [...confirmedTransactions].sort(compareConfirmedTransactions),
    [confirmedTransactions],
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setImportError({
        title: 'Unsupported file',
        message: 'Choose a PDF statement file.',
      });
      setStatus('error');
      resetReviewState();
      return;
    }

    setStatus('parsing');
    setParseResult(null);
    setConfirmedSource(null);
    setImportError(null);
    resetReviewState();

    try {
      const data = await file.arrayBuffer();
      const result = await window.expenseTracker.parsePdfStatement(file.name, data);

      setParseResult(result);
      setCandidateDrafts(result.candidates.map(candidateToDraft));
      setSourceForm({
        issuer: sourceValue(result.source.issuer),
        account: sourceValue(result.source.account),
        statementPeriod: sourceValue(result.source.statementPeriod),
      });
      setStatus('confirming');
    } catch (error) {
      setImportError({
        title: 'Could not parse PDF',
        message: error instanceof Error ? error.message : 'The selected statement could not be read.',
      });
      setStatus('error');
    }
  }

  function handleSourceChange(field: keyof StatementSource, value: string) {
    setSourceForm((currentSource) => ({
      ...currentSource,
      [field]: value,
    }));
  }

  function handleSourceConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setConfirmedSource({
      issuer: sourceForm.issuer.trim() || 'Unknown',
      account: sourceForm.account.trim() || 'Unknown',
      statementPeriod: sourceForm.statementPeriod.trim() || 'Unknown',
    });
    setStatus('parsed');
  }

  function handleCandidateFieldChange(id: string, field: keyof CandidateDraft, value: string) {
    setCandidateDrafts((currentCandidates) =>
      currentCandidates.map((candidate) => (candidate.id === id ? { ...candidate, [field]: value } : candidate)),
    );
    setReviewError(null);
  }

  function handleCandidateTypeChange(id: string, value: TransactionType) {
    setCandidateDrafts((currentCandidates) =>
      currentCandidates.map((candidate) => (candidate.id === id ? { ...candidate, type: value } : candidate)),
    );
  }

  function handleCandidateCategoryGroupChange(id: string, value: CategoryGroup) {
    setCandidateDrafts((currentCandidates) =>
      currentCandidates.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              categoryGroup: value,
              category: getDefaultCategory(value),
            }
          : candidate,
      ),
    );
  }

  function handleCandidateCategoryChange(id: string, value: string) {
    setCandidateDrafts((currentCandidates) =>
      currentCandidates.map((candidate) => (candidate.id === id ? { ...candidate, category: value } : candidate)),
    );
  }

  function toggleRowSelection(table: SelectionTable, id: string) {
    const setSelection = table === 'candidate' ? setSelectedCandidateIds : setSelectedConfirmedIds;
    setSelection((currentSelection) =>
      currentSelection.includes(id)
        ? currentSelection.filter((selectedId) => selectedId !== id)
        : [...currentSelection, id],
    );
  }

  function toggleAllCandidates(checked: boolean) {
    setSelectedCandidateIds(checked ? candidateDrafts.map((candidate) => candidate.id) : []);
  }

  function toggleAllConfirmed(checked: boolean) {
    setSelectedConfirmedIds(checked ? sortedConfirmedTransactions.map((transaction) => transaction.id) : []);
  }

  function confirmSelectedCandidates() {
    if (selectedCandidateIds.length === 0) {
      return;
    }

    if (invalidSelectedCandidateIds.length > 0) {
      setReviewError('Fix invalid selected amounts before confirming transactions.');
      return;
    }

    const selectedIds = new Set(selectedCandidateIds);
    const selectedDrafts = candidateDrafts.filter((candidate) => selectedIds.has(candidate.id));
    const confirmedRows = selectedDrafts.map(draftToConfirmed);

    setConfirmedTransactions((currentConfirmedTransactions) =>
      [...currentConfirmedTransactions, ...confirmedRows].sort(compareConfirmedTransactions),
    );
    setCandidateDrafts((currentCandidates) => currentCandidates.filter((candidate) => !selectedIds.has(candidate.id)));
    setSelectedCandidateIds([]);
    setReviewError(null);
  }

  function returnSelectedConfirmed() {
    if (selectedConfirmedIds.length === 0) {
      return;
    }

    const selectedIds = new Set(selectedConfirmedIds);
    const restoredCandidates = selectedConfirmedIds
      .map((id) => originalCandidatesById.get(id))
      .filter((candidate): candidate is TransactionCandidate => candidate !== undefined)
      .map(candidateToDraft);

    setCandidateDrafts((currentCandidates) =>
      [...currentCandidates, ...restoredCandidates].sort((a, b) => a.lineNumber - b.lineNumber),
    );
    setConfirmedTransactions((currentTransactions) =>
      currentTransactions.filter((transaction) => !selectedIds.has(transaction.id)),
    );
    setSelectedConfirmedIds([]);
    setReviewError(null);
  }

  function resetReviewState() {
    setCandidateDrafts([]);
    setConfirmedTransactions([]);
    setSelectedCandidateIds([]);
    setSelectedConfirmedIds([]);
    setReviewError(null);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>Expense Tracker</h1>
          <p>Import credit card statements and review extracted transactions locally.</p>
        </div>
        <label className="upload-button">
          <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} disabled={status === 'parsing'} />
          {status === 'parsing' ? 'Parsing PDF...' : 'Upload PDF Statement'}
        </label>
      </header>

      {status === 'parsing' ? <StatusBanner tone="info" title="Parsing statement" message="Extracting selectable text from the PDF." /> : null}

      {status === 'error' && importError ? (
        <StatusBanner tone="error" title={importError.title} message={importError.message} />
      ) : null}

      {reviewError ? <StatusBanner tone="error" title="Review issue" message={reviewError} /> : null}

      {parseResult && status !== 'parsing' ? (
        <section className="import-section" aria-labelledby="import-title">
          <div className="section-header">
            <h2 id="import-title">Import Review</h2>
            <span>{parseResult.fileName}</span>
          </div>

          <div className="import-summary">
            <SummaryItem label="Pages" value={String(parseResult.pageCount)} />
            <SummaryItem label="Text lines" value={String(parseResult.lineCount)} />
            <SummaryItem label="Remaining" value={String(candidateDrafts.length)} />
            <SummaryItem label="Confirmed" value={String(confirmedTransactions.length)} />
          </div>

          {parseResult.warnings.length > 0 ? (
            <div className="warning-list">
              {parseResult.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {status === 'confirming' ? (
            <form className="source-form" onSubmit={handleSourceConfirmation}>
              <label>
                Issuer
                <input value={sourceForm.issuer} onChange={(event) => handleSourceChange('issuer', event.target.value)} />
              </label>
              <label>
                Account
                <input value={sourceForm.account} onChange={(event) => handleSourceChange('account', event.target.value)} />
              </label>
              <label>
                Statement period
                <input
                  value={sourceForm.statementPeriod}
                  onChange={(event) => handleSourceChange('statementPeriod', event.target.value)}
                />
              </label>
              <button type="submit">Confirm Source</button>
            </form>
          ) : null}

          {status === 'parsed' && confirmedSource ? (
            <div className="confirmed-source">
              <span>{confirmedSource.issuer}</span>
              <span>Account {confirmedSource.account}</span>
              <span>{confirmedSource.statementPeriod}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="transactions-section" aria-labelledby="transactions-title">
        <div className="section-header table-toolbar">
          <div>
            <h2 id="transactions-title">Transaction Candidates</h2>
            <span>{candidateDrafts.length} remaining</span>
          </div>
          <button type="button" onClick={confirmSelectedCandidates} disabled={selectedCandidateIds.length === 0}>
            Confirm Selected
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="select-column">
                  <input
                    aria-label="Select all candidate transactions"
                    type="checkbox"
                    checked={candidateDrafts.length > 0 && selectedCandidateIds.length === candidateDrafts.length}
                    onChange={(event) => toggleAllCandidates(event.target.checked)}
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
              {candidateDrafts.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={7}>
                    Upload a PDF and confirm its source to review candidates, or return confirmed rows for more edits.
                  </td>
                </tr>
              ) : (
                candidateDrafts.map((transaction) => (
                  <tr key={transaction.id} title={transaction.originalText}>
                    <td className="select-column">
                      <input
                        aria-label={`Select candidate line ${transaction.lineNumber}`}
                        type="checkbox"
                        checked={selectedCandidateIds.includes(transaction.id)}
                        onChange={() => toggleRowSelection('candidate', transaction.id)}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input date-input"
                        value={transaction.date}
                        onChange={(event) => handleCandidateFieldChange(transaction.id, 'date', event.target.value)}
                      />
                    </td>
                    <td>
                      <div className="description-cell">
                        <input
                          className="table-input description-input"
                          value={transaction.description}
                          onChange={(event) => handleCandidateFieldChange(transaction.id, 'description', event.target.value)}
                        />
                      </div>
                    </td>
                    <td>
                      <select
                        className="table-input type-select"
                        value={transaction.type}
                        onChange={(event) => handleCandidateTypeChange(transaction.id, event.target.value as TransactionType)}
                      >
                        {transactionTypes.map((transactionType) => (
                          <option key={transactionType} value={transactionType}>
                            {transactionType}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="table-input category-group-select"
                        value={transaction.categoryGroup}
                        onChange={(event) =>
                          handleCandidateCategoryGroupChange(transaction.id, event.target.value as CategoryGroup)
                        }
                      >
                        {categoryGroups.map((categoryGroup) => (
                          <option key={categoryGroup} value={categoryGroup}>
                            {categoryGroup}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="table-input category-select"
                        value={transaction.category}
                        onChange={(event) => handleCandidateCategoryChange(transaction.id, event.target.value)}
                      >
                        {categoriesByGroup[transaction.categoryGroup].map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="amount-column">
                      <input
                        className={`table-input amount-input ${isValidAmount(transaction.amount) ? '' : 'input-invalid'}`}
                        value={transaction.amount}
                        onChange={(event) => handleCandidateFieldChange(transaction.id, 'amount', event.target.value)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="transactions-section" aria-labelledby="confirmed-transactions-title">
        <div className="section-header table-toolbar">
          <div>
            <h2 id="confirmed-transactions-title">Confirmed Transactions</h2>
            <span>{confirmedTransactions.length} selected for import</span>
          </div>
          <button type="button" onClick={returnSelectedConfirmed} disabled={selectedConfirmedIds.length === 0}>
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
                    checked={
                      sortedConfirmedTransactions.length > 0 &&
                      selectedConfirmedIds.length === sortedConfirmedTransactions.length
                    }
                    onChange={(event) => toggleAllConfirmed(event.target.checked)}
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
              {sortedConfirmedTransactions.length === 0 ? (
                <tr>
                  <td className="empty-state" colSpan={7}>
                    Confirm selected candidates to build the temporary transaction list.
                  </td>
                </tr>
              ) : (
                sortedConfirmedTransactions.map((transaction) => (
                  <tr key={transaction.id} title={transaction.originalText}>
                    <td className="select-column">
                      <input
                        aria-label={`Select confirmed line ${transaction.lineNumber}`}
                        type="checkbox"
                        checked={selectedConfirmedIds.includes(transaction.id)}
                        onChange={() => toggleRowSelection('confirmed', transaction.id)}
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

      {parseResult ? (
        <section className="diagnostics-section" aria-labelledby="diagnostics-title">
          <div className="section-header">
            <h2 id="diagnostics-title">Parser Diagnostics</h2>
            <span>{parseResult.candidateLines.length} candidate lines</span>
          </div>
          <div className="diagnostics-grid">
            <TextPanel title="Candidate lines" text={parseResult.candidateLines.join('\n') || 'No candidate lines detected.'} />
            <TextPanel title="Extracted text" text={parseResult.extractedText || 'No selectable text extracted.'} />
          </div>
        </section>
      ) : null}
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBanner({ tone, title, message }: { tone: 'info' | 'error'; title: string; message: string }) {
  return (
    <section className={`status-banner status-banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      <span>{message}</span>
    </section>
  );
}

function TextPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="text-panel">
      <h3>{title}</h3>
      <pre>{text}</pre>
    </div>
  );
}

function candidateToDraft(candidate: TransactionCandidate): CandidateDraft {
  const suggestedCategory = suggestCategory(candidate.description, candidate.type);

  return {
    ...candidate,
    amount: candidate.amount.toFixed(2),
    categoryGroup: suggestedCategory.group,
    category: suggestedCategory.name,
  };
}

function draftToConfirmed(candidate: CandidateDraft): ConfirmedTransaction {
  return {
    ...candidate,
    amount: parseAmount(candidate.amount),
  };
}

function compareConfirmedTransactions(a: ConfirmedTransaction, b: ConfirmedTransaction): number {
  const dateComparison = a.date.localeCompare(b.date);
  return dateComparison === 0 ? a.lineNumber - b.lineNumber : dateComparison;
}

function isValidAmount(value: string): boolean {
  const amount = parseAmount(value);
  return Number.isFinite(amount) && amount > 0;
}

function parseAmount(value: string): number {
  return Number(value.replace(/[$,\s]/g, ''));
}

function sourceValue(value: string): string {
  return value === 'Unknown' ? '' : value;
}
