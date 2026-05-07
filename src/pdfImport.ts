import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export type TransactionType = 'expense' | 'income' | 'transfer';

export type StatementSource = {
  issuer: string;
  account: string;
  statementPeriod: string;
};

export type TransactionCandidate = {
  id: string;
  lineNumber: number;
  originalText: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  confidence: 'medium' | 'low';
};

export type PdfParseResult = {
  fileName: string;
  pageCount: number;
  characterCount: number;
  lineCount: number;
  source: StatementSource;
  candidates: TransactionCandidate[];
  candidateLines: string[];
  extractedText: string;
  warnings: string[];
};

type ParsePdfInput = {
  fileName: string;
  data: Uint8Array;
};

type PdfTextItem = {
  str: string;
  transform?: number[];
  hasEOL?: boolean;
};

type PdfTextContent = {
  items: Array<PdfTextItem | { type: string }>;
};

type PdfPage = {
  getTextContent: () => Promise<PdfTextContent>;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void> | void;
};

type PdfLoadingTask = {
  promise: Promise<PdfDocument>;
};

type PdfJsModule = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  VerbosityLevel: {
    ERRORS: number;
  };
  getDocument: (options: {
    data: Uint8Array;
    disableFontFace: boolean;
    isEvalSupported: boolean;
    useSystemFonts: boolean;
    verbosity: number;
  }) => PdfLoadingTask;
};

export async function parsePdfStatement(input: ParsePdfInput): Promise<PdfParseResult> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfJsModule;
  pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfWorkerSrc();
  const loadingTask = pdfjs.getDocument({
    data: input.data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  const document = await loadingTask.promise;

  try {
    const pageLines: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pageLines.push(...extractLines(textContent));
    }

    const lines = pageLines.map(normalizeWhitespace).filter(Boolean);
    const extractedText = lines.join('\n');
    const source = detectSource(lines);
    const statementYear = detectStatementYear(source.statementPeriod, lines);
    const candidates = lines
      .map((line, index) => parseCandidate(line, index + 1, statementYear))
      .filter((candidate): candidate is TransactionCandidate => candidate !== null);

    const warnings: string[] = [];

    if (extractedText.length === 0) {
      warnings.push('No selectable text was found. Scanned PDFs require OCR, which is not implemented yet.');
    }

    if (candidates.length === 0 && extractedText.length > 0) {
      warnings.push('Text was extracted, but no transaction-like lines were detected.');
    }

    return {
      fileName: input.fileName,
      pageCount: document.numPages,
      characterCount: extractedText.length,
      lineCount: lines.length,
      source,
      candidates,
      candidateLines: candidates.map((candidate) => candidate.originalText),
      extractedText,
      warnings,
    };
  } finally {
    await document.destroy();
  }
}

function resolvePdfWorkerSrc(): string {
  const requireFromBundle = createRequire(__filename);
  return pathToFileURL(requireFromBundle.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
}

function extractLines(textContent: PdfTextContent): string[] {
  const positionedItems = textContent.items
    .filter(isTextItem)
    .map((item) => ({
      text: item.str,
      x: item.transform?.[4],
      y: item.transform?.[5],
      hasEOL: item.hasEOL === true,
    }))
    .filter((item) => item.text.trim().length > 0);

  if (positionedItems.some((item) => typeof item.x === 'number' && typeof item.y === 'number')) {
    const rows: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = [];

    positionedItems.forEach((item) => {
      if (typeof item.x !== 'number' || typeof item.y !== 'number') {
        return;
      }

      const row = rows.find((candidateRow) => Math.abs(candidateRow.y - item.y) <= 3);

      if (row) {
        row.parts.push({ x: item.x, text: item.text });
      } else {
        rows.push({ y: item.y, parts: [{ x: item.x, text: item.text }] });
      }
    });

    return rows
      .sort((a, b) => b.y - a.y)
      .map((row) =>
        row.parts
          .sort((a, b) => a.x - b.x)
          .map((part) => part.text)
          .join(' '),
      );
  }

  const lines: string[] = [];
  let currentLine = '';

  positionedItems.forEach((item) => {
    currentLine = `${currentLine} ${item.text}`.trim();

    if (item.hasEOL) {
      lines.push(currentLine);
      currentLine = '';
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function isTextItem(item: PdfTextItem | { type: string }): item is PdfTextItem {
  return 'str' in item;
}

function detectSource(lines: string[]): StatementSource {
  const headerText = lines.slice(0, 60).join(' ');
  const issuer =
    findMatch(headerText, /\b(chase|td|rbc|scotiabank|bmo|cibc|capital one|american express|amex|citi|wells fargo|bank of america|discover)\b/i) ??
    'Unknown';
  const account =
    findMatch(headerText, /(?:account|card|acct)[^\d]{0,20}((?:x{2,}|\*{2,}|ending in|ending)\s*)?(\d{4})/i, 2) ??
    'Unknown';
  const statementPeriod =
    findMatch(
      headerText,
      /(?:statement period|billing period|period)\s*:?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\s*(?:-|to|through)\s*[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    ) ?? 'Unknown';

  return {
    issuer: toTitleCase(issuer),
    account,
    statementPeriod,
  };
}

function parseCandidate(
  line: string,
  lineNumber: number,
  statementYear: number | null,
): TransactionCandidate | null {
  const dateMatch = line.match(
    /^\s*((?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)|(?:\d{4}-\d{1,2}-\d{1,2})|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*(?:\d{4})?))\b/i,
  );

  if (!dateMatch) {
    return null;
  }

  const amountMatch = findLastAmount(line);

  if (!amountMatch) {
    return null;
  }

  const date = normalizeDate(dateMatch[1], statementYear);

  if (!date) {
    return null;
  }

  const amount = Math.abs(parseAmount(amountMatch.value));
  const description = normalizeWhitespace(
    line.slice(dateMatch.index + dateMatch[0].length, amountMatch.index).replace(/\s{2,}/g, ' '),
  );
  const type = inferTransactionType(line, amountMatch.value);

  if (!description || Number.isNaN(amount) || amount === 0) {
    return null;
  }

  return {
    id: `${lineNumber}-${date}-${amount.toFixed(2)}`,
    lineNumber,
    originalText: line,
    date,
    description,
    type,
    amount,
    confidence: hasAmbiguousSignals(line) ? 'low' : 'medium',
  };
}

function findLastAmount(line: string): { value: string; index: number } | null {
  const matches = [...line.matchAll(/(?:[$(+-]?\s*)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})(?:\))?/g)];
  const match = matches[matches.length - 1];

  if (!match || typeof match.index !== 'number') {
    return null;
  }

  return {
    value: match[0],
    index: match.index,
  };
}

function inferTransactionType(line: string, rawAmount: string): TransactionType {
  if (/\b(payment|transfer|autopay|auto pay|online payment)\b/i.test(line)) {
    return 'transfer';
  }

  if (/\b(credit|refund|cashback|cash back|deposit|interest)\b/i.test(line) || /[-(]/.test(rawAmount)) {
    return 'income';
  }

  return 'expense';
}

function hasAmbiguousSignals(line: string): boolean {
  return /\b(balance|total|minimum|previous|summary|limit|available)\b/i.test(line);
}

function normalizeDate(rawDate: string, statementYear: number | null): string | null {
  const trimmedDate = rawDate.replace(',', '').trim();
  const isoMatch = trimmedDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    return formatDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const numericMatch = trimmedDate.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);

  if (numericMatch) {
    const year = normalizeYear(numericMatch[3], statementYear);
    return year ? formatDate(year, Number(numericMatch[1]), Number(numericMatch[2])) : null;
  }

  const monthNameMatch = trimmedDate.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s+(\d{4}))?$/);

  if (monthNameMatch) {
    const month = monthNameToNumber(monthNameMatch[1]);
    const year = normalizeYear(monthNameMatch[3], statementYear);
    return month && year ? formatDate(year, month, Number(monthNameMatch[2])) : null;
  }

  return null;
}

function normalizeYear(rawYear: string | undefined, statementYear: number | null): number | null {
  if (!rawYear) {
    return statementYear;
  }

  const year = Number(rawYear);

  if (rawYear.length === 2) {
    return year >= 70 ? 1900 + year : 2000 + year;
  }

  return year;
}

function formatDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function monthNameToNumber(monthName: string): number | null {
  const month = monthName.toLowerCase().slice(0, 3);
  const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(
    month,
  );

  return monthIndex === -1 ? null : monthIndex + 1;
}

function parseAmount(rawAmount: string): number {
  const cleanedAmount = rawAmount.replace(/[$,\s()+]/g, '');
  return Number(cleanedAmount);
}

function detectStatementYear(statementPeriod: string, lines: string[]): number | null {
  const periodYear = statementPeriod.match(/\b(20\d{2}|19\d{2})\b/g)?.pop();

  if (periodYear) {
    return Number(periodYear);
  }

  const firstYear = lines.join(' ').match(/\b(20\d{2}|19\d{2})\b/)?.[1];
  return firstYear ? Number(firstYear) : null;
}

function findMatch(text: string, pattern: RegExp, group = 1): string | null {
  return text.match(pattern)?.[group]?.trim() ?? null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
