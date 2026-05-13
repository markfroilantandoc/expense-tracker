import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  emptyAccountDraft,
  type Account,
  type AccountDraft,
  type AccountType,
} from '../../domain/accounts';
import { type CategoryGroup } from '../../domain/categories';
import { createEmptySavedReviewData, type SavedReviewData } from '../../domain/persistence';
import { sourceValue, type PdfParseResult, type StatementSource } from '../../domain/statements';
import {
  candidateToDraft,
  compareCandidateDraftsByLine,
  compareConfirmedTransactions,
  draftToConfirmed,
  getManualTransactionDraft,
  isValidCurrencyAmount,
  isValidAmount,
  parseAmount,
  updateDraftCategoryGroup,
  type CandidateDraft,
  type ConfirmedTransaction,
  type TransactionCandidate,
  type TransactionType,
} from '../../domain/transactions';

export type ImportStatus = 'idle' | 'parsing' | 'confirming' | 'parsed' | 'error';
export type PersistenceStatus = 'idle' | 'loading' | 'saving' | 'error';

type ImportError = {
  title: string;
  message: string;
};

type SelectionTable = 'candidate' | 'confirmed';

export function useImportReview() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [parseResult, setParseResult] = useState<PdfParseResult | null>(null);
  const [confirmedSource, setConfirmedSource] = useState<StatementSource | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountDraft, setAccountDraft] = useState<AccountDraft>(emptyAccountDraft);
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');
  const [statementOpeningBalance, setStatementOpeningBalance] = useState('');
  const [statementEndingBalance, setStatementEndingBalance] = useState('');
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [candidateDrafts, setCandidateDrafts] = useState<CandidateDraft[]>([]);
  const [confirmedTransactions, setConfirmedTransactions] = useState<ConfirmedTransaction[]>([]);
  const [manualTransactionDraft, setManualTransactionDraft] = useState<CandidateDraft>(getManualTransactionDraft);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [selectedConfirmedIds, setSelectedConfirmedIds] = useState<string[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [savedReviewData, setSavedReviewData] = useState<SavedReviewData>(createEmptySavedReviewData);
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('loading');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSavedData() {
      setPersistenceStatus('loading');

      try {
        const data = await window.expenseTracker.loadSavedReviewData();
        if (isActive) {
          setSavedReviewData(data);
          setPersistenceError(null);
          setPersistenceStatus('idle');
        }
      } catch (error) {
        if (isActive) {
          setPersistenceError(error instanceof Error ? error.message : 'Could not load saved review data.');
          setPersistenceStatus('error');
        }
      }
    }

    loadSavedData();

    return () => {
      isActive = false;
    };
  }, []);

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
  const selectedAccount = useMemo(
    () => savedReviewData.accounts.find((account) => account.id === selectedAccountId) ?? null,
    [savedReviewData.accounts, selectedAccountId],
  );
  const reconciliation = useMemo(
    () => getReconciliation(selectedAccount, statementOpeningBalance, statementEndingBalance, confirmedTransactions),
    [confirmedTransactions, selectedAccount, statementEndingBalance, statementOpeningBalance],
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
    setSaveMessage(null);
    resetReviewState();

    try {
      const data = await file.arrayBuffer();
      const result = await window.expenseTracker.parsePdfStatement(file.name, data);

      setParseResult(result);
      setCandidateDrafts(result.candidates.map(candidateToDraft));
      setAccountDraft({
        ...emptyAccountDraft,
        name: [sourceValue(result.source.issuer), sourceValue(result.source.account)].filter(Boolean).join(' '),
        issuer: sourceValue(result.source.issuer),
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

  function handleSelectedAccountChange(value: string) {
    setSelectedAccountId(value);
    setReviewError(null);
  }

  function handleAccountDraftChange(field: keyof AccountDraft, value: string) {
    setAccountDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
    setReviewError(null);
  }

  function handleAccountTypeChange(value: AccountType) {
    setAccountDraft((currentDraft) => ({
      ...currentDraft,
      type: value,
    }));
  }

  async function createAccountFromDraft() {
    if (!accountDraft.name.trim()) {
      setReviewError('Account name is required.');
      return;
    }

    if (!isValidCurrencyAmount(accountDraft.openingBalance)) {
      setReviewError('Opening balance must be a number.');
      return;
    }

    setPersistenceStatus('saving');
    setPersistenceError(null);

    try {
      const nextData = await window.expenseTracker.createAccount(accountDraft);
      const newestAccount = nextData.accounts[nextData.accounts.length - 1];
      setSavedReviewData(nextData);
      setSelectedAccountId(newestAccount?.id ?? '');
      setAccountDraft(emptyAccountDraft);
      setPersistenceStatus('idle');
      setReviewError(null);
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : 'Could not create account.');
      setPersistenceStatus('error');
    }
  }

  function handleStatementOpeningBalanceChange(value: string) {
    setStatementOpeningBalance(value);
    setReviewError(null);
  }

  function handleStatementStartDateChange(value: string) {
    setStatementStartDate(value);
    setReviewError(null);
  }

  function handleStatementEndDateChange(value: string) {
    setStatementEndDate(value);
    setReviewError(null);
  }

  function handleStatementEndingBalanceChange(value: string) {
    setStatementEndingBalance(value);
    setReviewError(null);
  }

  function handleSourceConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAccountId) {
      setReviewError('Choose or create an account before confirming the source.');
      return;
    }

    if (!selectedAccount) {
      setReviewError('Choose or create an account before confirming the source.');
      return;
    }

    if (!statementStartDate || !statementEndDate) {
      setReviewError('Enter the statement start and end dates before confirming the source.');
      return;
    }

    if (!isValidCurrencyAmount(statementOpeningBalance) || !isValidCurrencyAmount(statementEndingBalance)) {
      setReviewError('Enter statement opening and ending balances before confirming the source.');
      return;
    }

    setConfirmedSource({
      issuer: selectedAccount.issuer || selectedAccount.name,
      account: selectedAccount.lastDigits ? `Ending ${selectedAccount.lastDigits}` : selectedAccount.name,
      statementPeriod: `${statementStartDate} to ${statementEndDate}`,
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
        candidate.id === id ? updateDraftCategoryGroup(candidate, value) : candidate,
      ),
    );
  }

  function handleCandidateCategoryChange(id: string, value: string) {
    setCandidateDrafts((currentCandidates) =>
      currentCandidates.map((candidate) => (candidate.id === id ? { ...candidate, category: value } : candidate)),
    );
  }

  function handleManualTransactionFieldChange(field: keyof CandidateDraft, value: string) {
    setManualTransactionDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    setReviewError(null);
  }

  function handleManualTransactionTypeChange(value: TransactionType) {
    setManualTransactionDraft((currentDraft) => ({ ...currentDraft, type: value }));
  }

  function handleManualTransactionCategoryGroupChange(value: CategoryGroup) {
    setManualTransactionDraft((currentDraft) => updateDraftCategoryGroup(currentDraft, value));
  }

  function handleManualTransactionCategoryChange(value: string) {
    setManualTransactionDraft((currentDraft) => ({ ...currentDraft, category: value }));
  }

  function addManualTransaction() {
    if (!manualTransactionDraft.date.trim()) {
      setReviewError('Manual transaction date is required.');
      return;
    }

    if (!manualTransactionDraft.description.trim()) {
      setReviewError('Manual transaction description is required.');
      return;
    }

    if (!isValidAmount(manualTransactionDraft.amount)) {
      setReviewError('Manual transaction amount must be greater than zero.');
      return;
    }

    const confirmedRow = draftToConfirmed({
      ...manualTransactionDraft,
      id: `manual_${Date.now()}`,
      originalText: 'Manual transaction',
      lineNumber: Number.MAX_SAFE_INTEGER,
    });

    setConfirmedTransactions((currentConfirmedTransactions) =>
      [...currentConfirmedTransactions, confirmedRow].sort(compareConfirmedTransactions),
    );
    setManualTransactionDraft(getManualTransactionDraft());
    setReviewError(null);
    setSaveMessage(null);
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
    setSaveMessage(null);
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
      [...currentCandidates, ...restoredCandidates].sort(compareCandidateDraftsByLine),
    );
    setConfirmedTransactions((currentTransactions) =>
      currentTransactions.filter((transaction) => !selectedIds.has(transaction.id)),
    );
    setSelectedConfirmedIds([]);
    setReviewError(null);
    setSaveMessage(null);
  }

  async function saveCurrentReviewedImport() {
    if (!parseResult || !confirmedSource || !selectedAccount || confirmedTransactions.length === 0) {
      return;
    }

    if (!reconciliation.canSave) {
      setReviewError('Confirmed transactions must reconcile to the statement ending balance before saving.');
      return;
    }

    setPersistenceStatus('saving');
    setPersistenceError(null);
    setSaveMessage(null);

    try {
      const nextData = await window.expenseTracker.saveReviewedImport({
        fileName: parseResult.fileName,
        source: confirmedSource,
        accountId: selectedAccount.id,
        statementOpeningBalance: getLedgerBalance(selectedAccount.type, parseAmount(statementOpeningBalance)),
        statementEndingBalance: getLedgerBalance(selectedAccount.type, parseAmount(statementEndingBalance)),
        transactions: confirmedTransactions,
      });

      setSavedReviewData(nextData);
      setConfirmedTransactions([]);
      setSelectedConfirmedIds([]);
      setSaveMessage(`Saved ${confirmedTransactions.length} transactions from ${parseResult.fileName}.`);
      setPersistenceStatus('idle');
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : 'Could not save reviewed import.');
      setPersistenceStatus('error');
    }
  }

  function resetReviewState() {
    setCandidateDrafts([]);
    setConfirmedTransactions([]);
    setManualTransactionDraft(getManualTransactionDraft());
    setSelectedCandidateIds([]);
    setSelectedConfirmedIds([]);
    setReviewError(null);
    setSelectedAccountId('');
    setStatementStartDate('');
    setStatementEndDate('');
    setStatementOpeningBalance('');
    setStatementEndingBalance('');
  }

  return {
    status,
    parseResult,
    confirmedSource,
    selectedAccountId,
    selectedAccount,
    accountDraft,
    statementStartDate,
    statementEndDate,
    statementOpeningBalance,
    statementEndingBalance,
    reconciliation,
    importError,
    candidateDrafts,
    confirmedTransactions,
    manualTransactionDraft,
    sortedConfirmedTransactions,
    selectedCandidateIds,
    selectedConfirmedIds,
    reviewError,
    savedReviewData,
    persistenceStatus,
    persistenceError,
    saveMessage,
    handleFileChange,
    handleSelectedAccountChange,
    handleAccountDraftChange,
    handleAccountTypeChange,
    createAccountFromDraft,
    handleStatementStartDateChange,
    handleStatementEndDateChange,
    handleStatementOpeningBalanceChange,
    handleStatementEndingBalanceChange,
    handleSourceConfirmation,
    handleCandidateFieldChange,
    handleCandidateTypeChange,
    handleCandidateCategoryGroupChange,
    handleCandidateCategoryChange,
    handleManualTransactionFieldChange,
    handleManualTransactionTypeChange,
    handleManualTransactionCategoryGroupChange,
    handleManualTransactionCategoryChange,
    addManualTransaction,
    toggleRowSelection,
    toggleAllCandidates,
    toggleAllConfirmed,
    confirmSelectedCandidates,
    returnSelectedConfirmed,
    saveCurrentReviewedImport,
  };
}

function getReconciliation(
  account: Account | null,
  openingBalance: string,
  endingBalance: string,
  transactions: ConfirmedTransaction[],
) {
  const parsedOpeningBalance = parseAmount(openingBalance);
  const parsedEndingBalance = parseAmount(endingBalance);
  const hasValidBalances = Number.isFinite(parsedOpeningBalance) && Number.isFinite(parsedEndingBalance);
  const calculatedEndingBalance = hasValidBalances && account
    ? roundCurrency(
        transactions.reduce(
          (balance, transaction) => balance + getSignedTransactionEffect(account.type, transaction),
          getLedgerBalance(account.type, parsedOpeningBalance),
        ),
      )
    : null;
  const targetEndingBalance = account && hasValidBalances ? getLedgerBalance(account.type, parsedEndingBalance) : null;
  const difference = calculatedEndingBalance === null || targetEndingBalance === null
    ? null
    : roundCurrency(targetEndingBalance - calculatedEndingBalance);

  return {
    calculatedEndingBalance,
    difference,
    canSave: Boolean(account && hasValidBalances && difference === 0 && transactions.length > 0),
  };
}

function getSignedTransactionEffect(accountType: AccountType, transaction: ConfirmedTransaction): number {
  if (accountType === 'credit_card') {
    return transaction.type === 'expense' ? -transaction.amount : transaction.amount;
  }

  return transaction.type === 'income' ? transaction.amount : -transaction.amount;
}

function getLedgerBalance(accountType: AccountType, balanceInput: number): number {
  return accountType === 'credit_card' ? -Math.abs(balanceInput) : balanceInput;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
