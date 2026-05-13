import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { type CategoryGroup } from '../../domain/categories';
import { createEmptySavedReviewData, type SavedReviewData } from '../../domain/persistence';
import { confirmSource, emptySource, sourceValue, type PdfParseResult, type StatementSource } from '../../domain/statements';
import {
  candidateToDraft,
  compareCandidateDraftsByLine,
  compareConfirmedTransactions,
  draftToConfirmed,
  isValidAmount,
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
  const [sourceForm, setSourceForm] = useState<StatementSource>(emptySource);
  const [confirmedSource, setConfirmedSource] = useState<StatementSource | null>(null);
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [candidateDrafts, setCandidateDrafts] = useState<CandidateDraft[]>([]);
  const [confirmedTransactions, setConfirmedTransactions] = useState<ConfirmedTransaction[]>([]);
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

    setConfirmedSource(confirmSource(sourceForm));
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
    if (!parseResult || !confirmedSource || confirmedTransactions.length === 0) {
      return;
    }

    setPersistenceStatus('saving');
    setPersistenceError(null);
    setSaveMessage(null);

    try {
      const nextData = await window.expenseTracker.saveReviewedImport({
        fileName: parseResult.fileName,
        source: confirmedSource,
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
    setSelectedCandidateIds([]);
    setSelectedConfirmedIds([]);
    setReviewError(null);
  }

  return {
    status,
    parseResult,
    sourceForm,
    confirmedSource,
    importError,
    candidateDrafts,
    confirmedTransactions,
    sortedConfirmedTransactions,
    selectedCandidateIds,
    selectedConfirmedIds,
    reviewError,
    savedReviewData,
    persistenceStatus,
    persistenceError,
    saveMessage,
    handleFileChange,
    handleSourceChange,
    handleSourceConfirmation,
    handleCandidateFieldChange,
    handleCandidateTypeChange,
    handleCandidateCategoryGroupChange,
    handleCandidateCategoryChange,
    toggleRowSelection,
    toggleAllCandidates,
    toggleAllConfirmed,
    confirmSelectedCandidates,
    returnSelectedConfirmed,
    saveCurrentReviewedImport,
  };
}
