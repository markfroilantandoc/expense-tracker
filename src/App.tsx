import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import type { ExpenseTrackerApi } from './preload';
import type { PdfParseResult, StatementSource, TransactionCandidate } from './pdfImport';

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

  const transactions = useMemo<TransactionCandidate[]>(
    () => (status === 'parsed' && parseResult ? parseResult.candidates : []),
    [parseResult, status],
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
      return;
    }

    setStatus('parsing');
    setParseResult(null);
    setConfirmedSource(null);
    setImportError(null);

    try {
      const data = await file.arrayBuffer();
      const result = await window.expenseTracker.parsePdfStatement(file.name, data);

      setParseResult(result);
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

      {parseResult && status !== 'parsing' ? (
        <section className="import-section" aria-labelledby="import-title">
          <div className="section-header">
            <h2 id="import-title">Import Review</h2>
            <span>{parseResult.fileName}</span>
          </div>

          <div className="import-summary">
            <SummaryItem label="Pages" value={String(parseResult.pageCount)} />
            <SummaryItem label="Text lines" value={String(parseResult.lineCount)} />
            <SummaryItem label="Characters" value={String(parseResult.characterCount)} />
            <SummaryItem label="Candidates" value={String(parseResult.candidates.length)} />
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
        <div className="section-header">
          <h2 id="transactions-title">Transaction Candidates</h2>
          <span>{transactions.length} detected</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th>Confidence</th>
              <th className="amount-column">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={5}>
                  Upload a credit card statement PDF and confirm its source to review detected transaction candidates.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} title={transaction.originalText}>
                  <td>{transaction.date}</td>
                  <td>
                    <div className="description-cell">
                      <span>{transaction.description}</span>
                      <small>Line {transaction.lineNumber}</small>
                    </div>
                  </td>
                  <td>{transaction.type}</td>
                  <td>{transaction.confidence}</td>
                  <td className="amount-column">${transaction.amount.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

function sourceValue(value: string): string {
  return value === 'Unknown' ? '' : value;
}
