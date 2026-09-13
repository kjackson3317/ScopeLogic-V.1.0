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
const replaceRegexOnce = (source, pattern, after, label) => {
  const matches = source.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)) || [];
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, found ${matches.length}`);
  return source.replace(pattern, after);
};

function patchWorkspace() {
  let source = read('app/workspace.tsx');

  source = replaceOnce(source,
    "import DrawingTakeoffPage, { type DrawingAnnotation, type DrawingMeasurement, type DrawingPageCalibration, type DrawingTakeoffMark, type DrawingTakeoffTool } from './drawing-takeoff';",
    "import DrawingTakeoffPage, { type DrawingAnnotation, type DrawingMeasurement, type DrawingPageCalibration, type DrawingTakeoffMark, type DrawingTakeoffTool } from './drawing-takeoff';\nimport SlrChildEditor from './slr-child-editor';\nimport { associatedClarificationNumbers, checklistChildrenForDeliverable, lockIssuesForOfficialRelease, normalizeLegacyChildren, normalizeProjectIssueNumbers, recommendBaseBidSummary, rfiChildrenForDeliverable, syncLegacyFields, type SlrChildFields } from './slr-model';",
    'workspace imports');

  source = replaceOnce(source,
    "type Issue = {\n  uid: string;",
    "type Issue = {\n  uid: string;",
    'Issue type start');
  source = replaceOnce(source,
    "  responseReason: string;\n};\n\ntype Template =",
    "  responseReason: string;\n} & SlrChildFields;\n\ntype Template =",
    'Issue child fields');

  source = replaceRegexOnce(source,
    /const blankIssue = \(number: number\): Issue => \(\{[^\n]*\}\);/,
    "const blankIssue = (number: number): Issue => ({ uid: crypto.randomUUID(), id: `SLR-${String(number).padStart(3, '0')}`, system: 'Structured Cabling', customSystem: '', systems: ['Structured Cabling'], recommendations: {}, title: '', status: 'Open', concern: '', rfiQuestion: '', basis: '', reason: '', reference: '', sourceType: '', rfi: '', resolution: '', snippet: '', sow: true, clarification: true, formalRfi: false, checklist: false, checklistItem: '', checklistItems: {}, response: 'Included', responseReason: '', numberLocked: false, numberReleasedAt: '', rfis: [], recommendBaseBids: [], checklistQuestions: [] });",
    'blankIssue');

  source = replaceRegexOnce(source,
    /const recommendationSummary = \(issue: Issue\) => issueSystemKeys\(issue\)\.map\(\(system\) => \{[\s\S]*?\}\)\.join\('\\n\\n'\);/,
    "const recommendationSummary = (issue: Issue) => recommendBaseBidSummary(issue);",
    'recommendationSummary');

  source = replaceRegexOnce(source,
    /const normalizeIssues = \(items: Issue\[\]\) => \{[\s\S]*?\n\};\nconst normalizeProject =/,
    `const normalizeIssues = (items: Issue[]): Issue[] => {\n  let snippetNumber = 0;\n  return normalizeProjectIssueNumbers(items).map((item) => ({\n    ...(item as Issue),\n    snippet: item.snippet ? \`SNP-\${String(++snippetNumber).padStart(3, '0')}\` : '',\n  }));\n};\nconst normalizeProject =`,
    'normalizeIssues');

  source = replaceRegexOnce(source,
    /const normalizeIssue = \(issue: Partial<Issue> & Pick<Issue, 'uid' \| 'id'>\): Issue => \{[\s\S]*?\n\};\n\nconst dateKey/,
    `const normalizeIssue = (issue: Partial<Issue> & Pick<Issue, 'uid' | 'id'>): Issue => {\n  const legacyChecklistItem = issue.checklistItem ?? (issue.checklist ? issue.title || '' : '');\n  const systems = Array.from(new Set((Array.isArray(issue.systems) && issue.systems.length ? issue.systems : [issue.system || 'Structured Cabling']).map(String).filter(Boolean)));\n  const hasRecommendations = issue.recommendations && typeof issue.recommendations === 'object' && Object.keys(issue.recommendations).length > 0;\n  const recommendations = hasRecommendations ? { ...issue.recommendations } : { [systems[0]]: issue.basis || '' };\n  const hasChecklistItems = issue.checklistItems && typeof issue.checklistItems === 'object' && Object.keys(issue.checklistItems).length > 0;\n  const checklistItems = hasChecklistItems ? { ...issue.checklistItems } : Object.fromEntries(systems.map((system) => [system, legacyChecklistItem || '']));\n  systems.forEach((system) => { if (!(system in recommendations)) recommendations[system] = ''; if (!(system in checklistItems)) checklistItems[system] = ''; });\n  const firstChecklistItem = systems.map((system) => checklistItems[system] || '').find((value) => value.trim()) || '';\n  return normalizeLegacyChildren({\n    ...blankIssue(1), ...issue, system: systems[0], systems, recommendations, checklistItems,\n    sourceType: sourceTypeText(sourceTypeValues(issue.sourceType || '')),\n    rfiQuestion: issue.rfiQuestion ?? (issue.formalRfi ? issue.concern || '' : ''),\n    checklistItem: firstChecklistItem, checklist: Boolean(firstChecklistItem.trim()),\n  } as Issue) as Issue;\n};\n\nconst dateKey`,
    'normalizeIssue');

  source = source.replaceAll("'Clarification Matrix'", "'Clarification Log'");
  source = source.replaceAll('Clarification Matrix', 'Clarification Log');
  source = source.replaceAll('Recommended Bid Basis by System', 'Recommend Base Bid');
  source = source.replaceAll('Recommended Bid Basis', 'Recommend Base Bid');

  source = replaceRegexOnce(source,
    /type DeliverableRow = \{ key: string; cells: string\[\] \};[\s\S]*?const snippetDeliverableRows/,
    `type DeliverableRow = { key: string; cells: string[] };\nconst sowDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.sow).map((issue) => ({\n  key: issue.uid, cells: [issue.id, systemName(issue), issue.title, issue.concern, recommendBaseBidSummary(issue), issue.reference],\n}));\nconst clarificationDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.filter((issue) => issue.clarification).map((issue) => ({\n  key: issue.uid,\n  cells: [[issue.id, ...associatedClarificationNumbers(issue)].join('\\n'), systemName(issue), issue.concern, recommendBaseBidSummary(issue), issue.resolution, issue.status, issue.reference],\n}));\nconst rfiDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.flatMap((issue) => rfiChildrenForDeliverable(issue).map((rfi) => ({\n  key: \`\${issue.uid}:\${rfi.uid}\`,\n  cells: [rfi.number, rfi.systems.join('; ') || systemName(issue), rfi.question, rfi.reference || issue.reference],\n})));\nconst checklistDeliverableRows = (issues: Issue[]): DeliverableRow[] => issues.flatMap((issue) => checklistChildrenForDeliverable(issue).map((item) => ({\n  key: \`\${issue.uid}:\${item.uid}\`, cells: [issue.id, item.system, item.question, 'Editable in PDF', 'Editable in PDF'],\n})));\nconst snippetDeliverableRows`,
    'deliverable rows');

  source = replaceOnce(source,
    "    if (!selectedUid) return;\n    confirmAction('Delete Submitted SLR?', 'The SLR will be deleted and all later SLR, RFI, and snippet numbers will be renumbered automatically.', () => {",
    "    if (!selectedUid) return;\n    const selectedIssue = issues.find((item) => item.uid === selectedUid);\n    if (selectedIssue?.numberLocked) return message('Customer-Visible SLR', `${selectedIssue.id} has appeared in an Official Release. Its permanent number and history cannot be deleted. Resolve, close, or supersede its child records instead.`);\n    confirmAction('Delete Submitted SLR?', 'This unreleased SLR will be deleted. Draft-only SLR, RFI, RBB, checklist, and snippet numbers may resequence automatically.', () => {",
    'locked SLR delete guard');

  source = replaceOnce(source,
    "      const { uid, id, rfi, snippet, ...issue } = draft;\n      setTemplates((items) => [...items, { uid: crypto.randomUUID(), name, issue }]);",
    `      const templateDraft = JSON.parse(JSON.stringify(draft)) as Issue;\n      templateDraft.numberLocked = false; templateDraft.numberReleasedAt = '';\n      templateDraft.rfis = templateDraft.rfis.map((child) => ({ ...child, number: '', locked: false, releasedAt: '', status: child.status === 'Closed' ? 'Draft' : child.status }));\n      templateDraft.recommendBaseBids = templateDraft.recommendBaseBids.map((rbb) => ({ ...rbb, baseSequence: 0, baseNumber: '', sections: Object.fromEntries(Object.entries(rbb.sections).map(([system, section]) => [system, { ...section, suffix: '', displayNumber: '', locked: false, contentReleased: false, releasedAt: '', supersedesNumber: '' }])) }));\n      templateDraft.checklistQuestions = templateDraft.checklistQuestions.map((child) => ({ ...child, number: '', locked: false, releasedAt: '' }));\n      const { uid, id, rfi, snippet, ...issue } = templateDraft;\n      setTemplates((items) => [...items, { uid: crypto.randomUUID(), name, issue }]);`,
    'template number stripping');

  source = replaceOnce(source,
    "      const plannedReleaseNumber = await getNextOfficialReleaseNumber(projectId);\n      const bytes = await buildReleasePackageBytes(project, issues, kinds, notes, plannedReleaseNumber);",
    "      const plannedReleaseNumber = await getNextOfficialReleaseNumber(projectId);\n      const lockedIssues = lockIssuesForOfficialRelease(issues, kinds) as Issue[];\n      const bytes = await buildReleasePackageBytes(project, lockedIssues, kinds, notes, plannedReleaseNumber);",
    'official release lock before PDF');
  source = replaceOnce(source,
    "        issues: JSON.parse(JSON.stringify(issues)),",
    "        issues: JSON.parse(JSON.stringify(lockedIssues)),",
    'release snapshot locked issues');
  source = replaceOnce(source,
    "      const archived = await saveOfficialRelease(projectId, project.revision, project.versionDate, fileName, notes, kinds, blob, releaseSnapshot);\n      const url = URL.createObjectURL(blob);",
    "      const archived = await saveOfficialRelease(projectId, project.revision, project.versionDate, fileName, notes, kinds, blob, releaseSnapshot);\n      setIssues(() => lockedIssues);\n      const url = URL.createObjectURL(blob);",
    'persist lock state after official release');

  source = source.replace('<TextArea label="Formal RFI Question" value={draft.rfiQuestion} onChange={(value) => patch(\'rfiQuestion\', value)} />', '');
  source = source.replace('<p className="help-text rfi-help">The Formal RFI uses the RFI Question. Scope Concern remains the internal and clarification statement.</p>', '');

  source = replaceRegexOnce(source,
    /<div className="recommendation-sections"><div className="recommendation-heading"><b>Recommend Base Bid<\/b>[\s\S]*?<p className="help-text checklist-help">Leave a system-specific field blank to omit this SLR from that system section of the Contractor Response Checklist\.<\/p>/,
    '<SlrChildEditor issue={draft} onChange={(next) => props.setDraft(next as Issue)} />',
    'legacy RBB/checklist editor');

  source = source.replace("columns={['RFI No.', 'Systems', 'Question', 'Document References', 'Answer']}", "columns={['RFI No.', 'Systems', 'Question', 'Document References']}");
  source = source.replace('Document References appear internally and on the PDF.', 'Document references remain on the customer-facing RFI; SLR cross-references and response tracking remain internal.');
  source = source.replace('RFI Resolution / Official Answer', 'RFI Response / Official Answer');

  write('app/workspace.tsx', source);
}

function patchPdfGenerator() {
  let source = read('app/pdf-generator.ts');
  source = replaceOnce(source,
    "import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';",
    "import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';\nimport { associatedClarificationNumbers, checklistChildrenForDeliverable, normalizeLegacyChildren, recommendBaseBidSummary, rfiChildrenForDeliverable, type SlrChecklistChild, type SlrChildFields, type SlrRfiChild } from './slr-model';",
    'PDF imports');
  source = replaceOnce(source, "  responseReason: string;\n};", "  responseReason: string;\n} & SlrChildFields;", 'PdfIssue children');
  source = replaceOnce(source,
    "type PdfRow = { issue: PdfIssue; system?: string; section?: string };",
    "type PdfRow = { issue: PdfIssue; system?: string; section?: string; rfi?: SlrRfiChild; checklist?: SlrChecklistChild };",
    'PdfRow children');
  source = replaceRegexOnce(source,
    /const recommendationSummary = \(issue: PdfIssue\) =>[^;]*;/,
    "const recommendationSummary = (issue: PdfIssue) => recommendBaseBidSummary(issue);",
    'PDF recommendation summary');

  source = replaceRegexOnce(source,
    /function configFor\(kind: PdfKind\): PdfConfig \{[\s\S]*?\n\}/,
    `function configFor(kind: PdfKind): PdfConfig {\n  if (kind === 'sow') return {\n    title: 'Recommended SOW Matrix',\n    headers: ['SLR', 'Systems', 'Scope Item', 'Scope Concern', 'Recommend Base Bid', 'Source Reference'],\n    ratios: [0.055, 0.125, 0.13, 0.22, 0.285, 0.185],\n    values: ({ issue }) => [issue.id, systemNames(issue), issue.title, issue.concern, recommendationSummary(issue), issue.reference],\n  };\n  if (kind === 'clarifications') return {\n    title: 'Clarification Log',\n    headers: ['SLR / Associated Records', 'Systems', 'Scope Concern', 'Recommend Base Bid', 'Resolution', 'Status', 'Source Reference'],\n    ratios: [0.105, 0.105, 0.20, 0.21, 0.14, 0.075, 0.165],\n    values: ({ issue }) => [[issue.id, ...associatedClarificationNumbers(issue)].join('\\n'), systemNames(issue), issue.concern, recommendationSummary(issue), issue.resolution, issue.status, issue.reference],\n  };\n  if (kind === 'rfi') return {\n    title: 'Formal RFI',\n    headers: ['RFI No.', 'Systems', 'Question', 'Document References'],\n    ratios: [0.1, 0.18, 0.48, 0.24],\n    values: ({ issue, rfi }) => [rfi?.number || '', rfi?.systems?.join('; ') || systemNames(issue), rfi?.question || '', rfi?.reference || issue.reference],\n  };\n  return {\n    title: 'Contractor Response Checklist',\n    headers: ['SLR', 'Checklist Scope Item', 'Response', 'Reason'],\n    ratios: [0.08, 0.39, 0.2, 0.33],\n    values: ({ issue, checklist }) => [issue.id, checklist?.question || '', '', ''],\n  };\n}`,
    'PDF config');

  source = replaceRegexOnce(source,
    /function rowsFor\(kind: PdfKind, issues: PdfIssue\[\]\): PdfRow\[\] \{[\s\S]*?\n\}/,
    `function rowsFor(kind: PdfKind, issues: PdfIssue[]): PdfRow[] {\n  const normalized = issues.map((issue) => normalizeLegacyChildren(issue) as PdfIssue);\n  if (kind === 'sow') return normalized.filter((issue) => issue.sow).map((issue) => ({ issue }));\n  if (kind === 'clarifications') return normalized.filter((issue) => issue.clarification).map((issue) => ({ issue }));\n  if (kind === 'rfi') return normalized.flatMap((issue) => rfiChildrenForDeliverable(issue).map((rfi) => ({ issue, rfi })));\n  if (kind === 'checklist') {\n    const rows = normalized.flatMap((issue) => checklistChildrenForDeliverable(issue).map((checklist) => ({ issue, checklist, system: checklist.system, section: checklist.system })));\n    return rows.sort((a, b) => { const ai = SYSTEM_ORDER.indexOf(a.system || ''); const bi = SYSTEM_ORDER.indexOf(b.system || ''); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || String(a.system || '').localeCompare(String(b.system || '')); });\n  }\n  return [];\n}`,
    'PDF rows');

  write('app/pdf-generator.ts', source);
}

function patchCloudWorkspace() {
  let source = read('lib/cloud-workspace-legacy.ts');
  source = replaceOnce(source,
    "  responseReason: string;\n};\n\nexport type Template =",
    "  responseReason: string;\n  numberLocked: boolean;\n  numberReleasedAt: string;\n  rfis: any[];\n  recommendBaseBids: any[];\n  checklistQuestions: any[];\n};\n\nexport type Template =",
    'cloud Issue children');

  source = replaceOnce(source,
    "      responseReason: text(row.contractor_response_reason),\n    });",
    "      responseReason: text(row.contractor_response_reason),\n      numberLocked: Boolean(row.number_locked),\n      numberReleasedAt: text(row.number_released_at),\n      rfis: Array.isArray(row.rfi_children) ? row.rfi_children : [],\n      recommendBaseBids: Array.isArray(row.recommend_base_bid_children) ? row.recommend_base_bid_children : [],\n      checklistQuestions: Array.isArray(row.contractor_checklist_children) ? row.contractor_checklist_children : [],\n    });",
    'cloud load children');

  source = replaceOnce(source,
    "      display_number: `SLR-${String(index + 1).padStart(3, '0')}`,",
    "      display_number: issue.id || `SLR-${String(index + 1).padStart(3, '0')}`,",
    'preserve locked SLR display number');

  source = replaceOnce(source,
    "      contractor_response_reason: issue.responseReason || '',\n    }));",
    "      contractor_response_reason: issue.responseReason || '',\n      number_locked: Boolean(issue.numberLocked),\n      number_released_at: issue.numberReleasedAt || null,\n      rfi_children: issue.rfis || [],\n      recommend_base_bid_children: issue.recommendBaseBids || [],\n      contractor_checklist_children: issue.checklistQuestions || [],\n    }));",
    'cloud save children');

  write('lib/cloud-workspace-legacy.ts', source);
}

function patchLayout() {
  let source = read('app/layout.tsx');
  if (!source.includes("import './commercial-facelift.css';")) {
    source = source.replace("import './globals.css';", "import './globals.css';\nimport './commercial-facelift.css';");
  }
  write('app/layout.tsx', source);
}

function writeFacelift() {
  write('app/commercial-facelift.css', `/* Presentation-only live-app facelift; no navigation or workflow reorder. */\n:root{--sl-green:#4b6623;--sl-green-dark:#3d5320;--sl-charcoal:#1f2937;--sl-muted:#667085;--sl-border:#d7dce2;--sl-border-strong:#c4cad2;--sl-canvas:#f3f5f7;--sl-panel:#fff;--sl-radius:8px;--sl-shadow:0 1px 3px rgba(16,24,40,.08)}\nbody,.app-shell,.main{background:var(--sl-canvas)!important;color:#20262e}.sidebar{background:#171c22!important;border-right:1px solid #2c333c!important;box-shadow:2px 0 8px rgba(16,24,40,.08)}.topbar{background:rgba(255,255,255,.97)!important;border-bottom:1px solid var(--sl-border)!important;box-shadow:0 1px 2px rgba(16,24,40,.04)}\n.panel,.card,.standard-card,.detail-card,.matrix-card,.release-card,.empty-panel,.auth-card,.dialog-card,.modal-card,.table-card,.template-bar,.recommendation-sections{background:var(--sl-panel)!important;border:1px solid var(--sl-border)!important;border-radius:var(--sl-radius)!important;box-shadow:var(--sl-shadow)}\ninput,select,textarea{border-color:var(--sl-border-strong)!important;border-radius:6px!important;background:#fff;color:#20262e}input:focus,select:focus,textarea:focus{outline:none!important;border-color:var(--sl-green)!important;box-shadow:0 0 0 3px rgba(75,102,35,.14)!important}button.primary,.primary-button{background:var(--sl-green)!important;border-color:var(--sl-green)!important;color:#fff!important;border-radius:6px!important}button.primary:hover,.primary-button:hover{background:var(--sl-green-dark)!important;border-color:var(--sl-green-dark)!important}button.secondary,.secondary-button{background:#fff!important;border:1px solid var(--sl-border-strong)!important;color:var(--sl-charcoal)!important;border-radius:6px!important}\nthead th{background:#eef1f3!important;color:#39414d!important;border-bottom:1px solid var(--sl-border-strong)!important;font-size:11px!important;font-weight:700!important}tbody td{border-bottom-color:#e5e8ec!important}tbody tr:hover td{background:#fafbf9!important}.detail-tabs button.active,.tabs button.active,.tab-row button.active{color:var(--sl-green-dark)!important;border-bottom-color:var(--sl-green)!important;background:#eef2e8!important}.help-text{color:var(--sl-muted)!important}\n.slr-child-card{border:1px solid var(--sl-border);border-radius:7px;background:#fff;margin:10px 0;overflow:hidden}.slr-child-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px;background:#f5f7f3;border-bottom:1px solid var(--sl-border)}.slr-child-card-body{padding:11px}.slr-child-number{font-weight:800;color:var(--sl-green-dark)}.slr-child-card-head small{display:block;margin-top:2px;color:var(--sl-muted)}.slr-child-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.slr-child-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.slr-lock-note{padding:8px 10px;margin-bottom:10px;border-left:3px solid var(--sl-green);background:#eef2e8;color:#44512f;font-size:12px}.slr-child-system-list{display:flex;flex-wrap:wrap;gap:8px 14px;padding:10px 0}.slr-child-system-list>span{width:100%;font-weight:700}.rbb-system-section{margin-top:12px;border:1px solid var(--sl-border);border-radius:6px;overflow:hidden}.rbb-system-section>.field{padding:10px;display:block}.rbb-system-section>.slr-lock-note{margin:0 10px 10px}@media(max-width:900px){.slr-child-grid{grid-template-columns:1fr}}\n`);
}

function writeMigration() {
  const file = 'supabase/migrations/20260913000100_scopelogic_slr_parent_child_rbb.sql';
  write(file, `-- Additive SLR parent/child storage. Existing flat fields remain for compatibility and rollback.\nalter table public.slr_entries\n  add column if not exists rfi_children jsonb not null default '[]'::jsonb,\n  add column if not exists recommend_base_bid_children jsonb not null default '[]'::jsonb,\n  add column if not exists contractor_checklist_children jsonb not null default '[]'::jsonb,\n  add column if not exists number_locked boolean not null default false,\n  add column if not exists number_released_at timestamptz;\n\ncreate index if not exists slr_entries_rfi_children_gin_idx on public.slr_entries using gin (rfi_children);\ncreate index if not exists slr_entries_rbb_children_gin_idx on public.slr_entries using gin (recommend_base_bid_children);\n\n-- Preserve customer-visible SLR numbers when an archived Official Release contains the same SLR.\nupdate public.slr_entries entry\nset number_locked = true,\n    number_released_at = coalesce(entry.number_released_at, history.first_released_at)\nfrom (\n  select e.id, min(rp.released_at) first_released_at\n  from public.slr_entries e\n  join public.release_packages rp on rp.project_id = e.project_id\n  where jsonb_typeof(coalesce(rp.snapshot_data -> 'issues', '[]'::jsonb)) = 'array'\n    and exists (\n      select 1 from jsonb_array_elements(coalesce(rp.snapshot_data -> 'issues', '[]'::jsonb)) snapshot_issue\n      where coalesce(snapshot_issue ->> 'uid', '') = coalesce(e.legacy_uid, '')\n         or coalesce(snapshot_issue ->> 'id', '') = e.display_number\n    )\n  group by e.id\n) history\nwhere entry.id = history.id;\n\nnotify pgrst, 'reload schema';\n`);
}

patchWorkspace();
patchPdfGenerator();
patchCloudWorkspace();
patchLayout();
writeFacelift();
writeMigration();
console.log('SLR parent/child upgrade patches applied. Run npm run build next.');
