import type { PdfParseResult } from '../../domain/statements';
import { TextPanel } from './TextPanel';

export function ParserDiagnostics({ parseResult }: { parseResult: PdfParseResult }) {
  return (
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
  );
}
