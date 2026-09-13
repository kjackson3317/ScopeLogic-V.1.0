import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);
const replaceOnce = (source, before, after, label) => {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before, after);
};

function patchModel() {
  let source = read('app/slr-model.ts');

  source = replaceOnce(
    source,
    "  issue.systems = systems;\n  issue.system = systems[0] || 'Structured Cabling';",
    "  issue.systems = systems;\n  issue.system = systems[0] || 'Structured Cabling';\n  if (text(issue.status) === 'Answered') issue.status = 'Resolved';",
    'legacy parent status mapping',
  );

  source = replaceOnce(
    source,
    "    lines.push(`${system}\\n${section.recommendation}`);",
    "    const systemLabel = system === 'Other' ? text(issue.customSystem) || 'Other' : system;\n    lines.push(`${systemLabel}\\n${section.recommendation}`);",
    'custom Other system label',
  );

  source = replaceOnce(
    source,
    "    if (lockRfi) issue.rfis.forEach((rfi) => {\n      if (!rfi.includeInFormalRfi && !kinds.includes('clarifications')) return;\n      if (!text(rfi.question)) return;\n      rfi.locked = true; rfi.releasedAt ||= releasedAt;\n      if (rfi.status === 'Draft') rfi.status = 'Issued';\n    });",
    "    if (lockRfi) issue.rfis.forEach((rfi) => {\n      if (!text(rfi.question)) return;\n      const releasingFormalRfi = kinds.includes('rfi') && rfi.includeInFormalRfi;\n      const releasingClarification = kinds.includes('clarifications') && rfi.status !== 'Draft';\n      if (!releasingFormalRfi && !releasingClarification) return;\n      rfi.locked = true; rfi.releasedAt ||= releasedAt;\n      if (releasingFormalRfi && rfi.status === 'Draft') rfi.status = 'Issued';\n    });",
    'do not expose draft RFI through clarification release',
  );

  write('app/slr-model.ts', source);
}

function patchPdf() {
  let source = read('app/pdf-generator.ts');

  source = replaceOnce(
    source,
    "    headers: ['SLR / Associated Records', 'Systems', 'Scope Concern', 'Recommend Base Bid', 'Resolution', 'Status', 'Source Reference'],\n    ratios: [0.105, 0.105, 0.20, 0.21, 0.14, 0.075, 0.165],\n    values: ({ issue }) => [[issue.id, ...associatedClarificationNumbers(issue)].join('\\n'), systemNames(issue), issue.concern, recommendationSummary(issue), issue.resolution, issue.status, issue.reference],",
    "    headers: ['SLR / Associated Records', 'Systems', 'Scope Item', 'Scope Concern', 'Recommend Base Bid', 'Resolution', 'Status', 'Source Reference'],\n    ratios: [0.095, 0.09, 0.12, 0.18, 0.18, 0.12, 0.075, 0.14],\n    values: ({ issue }) => [[issue.id, ...associatedClarificationNumbers(issue)].join('\\n'), systemNames(issue), issue.title, issue.concern, recommendationSummary(issue), issue.resolution, issue.status, issue.reference],",
    'clarification scope item column',
  );

  source = replaceOnce(
    source,
    "    headers: ['RFI No.', 'Systems', 'Question', 'Document References'],\n    ratios: [0.1, 0.18, 0.48, 0.24],\n    values: ({ issue, rfi }) => [rfi?.number || '', rfi?.systems?.join('; ') || systemNames(issue), rfi?.question || '', rfi?.reference || issue.reference],",
    "    headers: ['RFI No.', 'Title / Subject', 'Systems', 'Question', 'Document References'],\n    ratios: [0.08, 0.16, 0.14, 0.42, 0.20],\n    values: ({ issue, rfi }) => [rfi?.number || '', rfi?.title || issue.title, rfi?.systems?.join('; ') || systemNames(issue), rfi?.question || '', rfi?.reference || issue.reference],",
    'formal RFI title column',
  );

  write('app/pdf-generator.ts', source);
}

function patchWorkspace() {
  let source = read('app/workspace.tsx');

  source = replaceOnce(
    source,
    "const ISSUE_STATUS_OPTIONS = alphaSorted(['Open', 'Under Review', 'Answered', 'Closed']);",
    "const ISSUE_STATUS_OPTIONS = alphaSorted(['Open', 'Under Review', 'Resolved', 'Closed']);",
    'parent SLR status options',
  );

  source = replaceOnce(
    source,
    "  cells: [[issue.id, ...associatedClarificationNumbers(issue)].join('\\n'), systemName(issue), issue.concern, recommendBaseBidSummary(issue), issue.resolution, issue.status, issue.reference],",
    "  cells: [[issue.id, ...associatedClarificationNumbers(issue)].join('\\n'), systemName(issue), issue.title, issue.concern, recommendBaseBidSummary(issue), issue.resolution, issue.status, issue.reference],",
    'clarification preview scope item',
  );

  source = replaceOnce(
    source,
    "  cells: [rfi.number, rfi.systems.join('; ') || systemName(issue), rfi.question, rfi.reference || issue.reference],",
    "  cells: [rfi.number, rfi.title || issue.title, rfi.systems.join('; ') || systemName(issue), rfi.question, rfi.reference || issue.reference],",
    'formal RFI preview title',
  );

  source = replaceOnce(
    source,
    "      templateDraft.numberLocked = false; templateDraft.numberReleasedAt = ''; templateDraft.rbbScopeLetterMap = {};",
    "      templateDraft.numberLocked = false; templateDraft.numberReleasedAt = ''; templateDraft.rbbScopeLetterMap = {};\n      templateDraft.resolution = ''; templateDraft.response = 'Included'; templateDraft.responseReason = '';",
    'template project response clearing',
  );

  source = replaceOnce(
    source,
    "          {view === 'clarifications' && <Deliverable title=\"Clarification Log\" eyebrow=\"GC Working Document\" description=\"Each SLR remains one record while all selected systems and system-specific recommendations are shown together.\" rows={clarificationDeliverableRows(issues)} columns={['SLR / RFI', 'Systems', 'Question / Issue', 'Recommend Base Bid', 'Resolution', 'Status', 'Source Reference']} update={() => updatePdf('clarifications', 'Clarification Log')} url={pdfUrls.clarifications} onDownload={() => recordDownload('Clarification_Matrix.pdf', 'Clarification Log')} preview={(url) => setPreview({ title: 'Clarification Log', url, mode: 'pdf' })} />}",
    "          {view === 'clarifications' && <Deliverable title=\"Clarification Log\" eyebrow=\"GC Working Document\" description=\"Each SLR remains one record while all selected systems and system-specific recommendations are shown together.\" rows={clarificationDeliverableRows(issues)} columns={['SLR / Associated Records', 'Systems', 'Scope Item', 'Scope Concern', 'Recommend Base Bid', 'Resolution', 'Status', 'Source Reference']} update={() => updatePdf('clarifications', 'Clarification Log')} url={pdfUrls.clarifications} onDownload={() => recordDownload('Clarification_Log.pdf', 'Clarification Log')} preview={(url) => setPreview({ title: 'Clarification Log', url, mode: 'pdf' })} />}",
    'clarification preview columns',
  );

  source = replaceOnce(
    source,
    "          {view === 'rfi' && <Deliverable title=\"Formal RFI\" eyebrow=\"A/E Deliverable\" description=\"Document references are visible here for internal coordination and remain included on the Formal RFI PDF.\" rows={rfiDeliverableRows(issues)} columns={['RFI No.', 'Systems', 'Question', 'Document References']} update={() => updatePdf('rfi', 'Formal RFI')} url={pdfUrls.rfi} onDownload={() => recordDownload('Formal_RFI.pdf', 'Formal RFI')} preview={(url) => setPreview({ title: 'Formal RFI', url, mode: 'pdf' })} />}",
    "          {view === 'rfi' && <Deliverable title=\"Formal RFI\" eyebrow=\"A/E Deliverable\" description=\"Customer-facing RFI output includes the RFI number, title/subject, systems, question, and document references; internal relationship and response metadata remain excluded.\" rows={rfiDeliverableRows(issues)} columns={['RFI No.', 'Title / Subject', 'Systems', 'Question', 'Document References']} update={() => updatePdf('rfi', 'Formal RFI')} url={pdfUrls.rfi} onDownload={() => recordDownload('Formal_RFI.pdf', 'Formal RFI')} preview={(url) => setPreview({ title: 'Formal RFI', url, mode: 'pdf' })} />}",
    'formal RFI preview columns',
  );

  write('app/workspace.tsx', source);
}

patchModel();
patchPdf();
patchWorkspace();
console.log('Final SLR specification alignment applied. Run git diff --check and npm run build.');
