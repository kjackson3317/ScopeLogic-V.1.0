import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before, after);
}

function patchModel() {
  let source = read('app/slr-model.ts');

  source = replaceOnce(
    source,
    "  if (text(issue.status) === 'Answered') issue.status = 'Resolved';\n  if (text(issue.status) === 'Answered') issue.status = 'Resolved';",
    "  if (text(issue.status) === 'Answered') issue.status = 'Resolved';",
    'remove duplicate legacy status mapping',
  );

  source = replaceOnce(
    source,
    "  issue.systems = systems;\n  issue.system = systems[0] || 'Structured Cabling';\n  if (text(issue.status) === 'Answered') issue.status = 'Resolved';\n\n  const existingRfis = Array.isArray(issue.rfis) ? issue.rfis.map(normalizedRfi) : [];",
    "  issue.systems = systems;\n  issue.system = systems[0] || 'Structured Cabling';\n  if (text(issue.status) === 'Answered') issue.status = 'Resolved';\n  const legacyReleasedAt = text(issue.numberReleasedAt);\n  const legacyRfiReleased = Boolean(issue.numberLocked && issue.formalRfi);\n  const legacyRbbReleased = Boolean(issue.numberLocked && (issue.sow || issue.clarification));\n  const legacyChecklistReleased = Boolean(issue.numberLocked && issue.checklist);\n\n  const existingRfis = Array.isArray(issue.rfis) ? issue.rfis.map(normalizedRfi) : [];",
    'legacy child release fallbacks',
  );

  source = replaceOnce(
    source,
    "      reference: text(issue.reference), includeInFormalRfi: Boolean(issue.formalRfi),\n      status: text(issue.resolution) ? 'Answered' : 'Draft', response: text(issue.resolution),",
    "      reference: text(issue.reference), includeInFormalRfi: Boolean(issue.formalRfi),\n      status: text(issue.resolution) ? 'Answered' : legacyRfiReleased ? 'Issued' : 'Draft', response: text(issue.resolution),\n      locked: legacyRfiReleased, releasedAt: legacyRfiReleased ? legacyReleasedAt : '',",
    'legacy RFI release lock fallback',
  );

  source = replaceOnce(
    source,
    "        recommendation: text(recommendations[system]) || (system === issue.system ? text(issue.basis) : ''),\n        status: 'Current',",
    "        recommendation: text(recommendations[system]) || (system === issue.system ? text(issue.basis) : ''),\n        status: 'Current', locked: legacyRbbReleased, contentReleased: legacyRbbReleased,\n        releasedAt: legacyRbbReleased ? legacyReleasedAt : '',",
    'legacy RBB release lock fallback',
  );

  source = replaceOnce(
    source,
    "      if (text(question)) existingChecklist.push(normalizedChecklist({ system, question: text(question), response: text(issue.response), responseReason: text(issue.responseReason) }));",
    "      if (text(question)) existingChecklist.push(normalizedChecklist({ system, question: text(question), response: text(issue.response), responseReason: text(issue.responseReason), locked: legacyChecklistReleased, releasedAt: legacyChecklistReleased ? legacyReleasedAt : '' }));",
    'legacy checklist map release lock fallback',
  );

  source = replaceOnce(
    source,
    "      existingChecklist.push(normalizedChecklist({ system: text(issue.system) || systems[0], question: text(issue.checklistItem), response: text(issue.response), responseReason: text(issue.responseReason) }));",
    "      existingChecklist.push(normalizedChecklist({ system: text(issue.system) || systems[0], question: text(issue.checklistItem), response: text(issue.response), responseReason: text(issue.responseReason), locked: legacyChecklistReleased, releasedAt: legacyChecklistReleased ? legacyReleasedAt : '' }));",
    'legacy checklist scalar release lock fallback',
  );

  write('app/slr-model.ts', source);
}

function patchEditor() {
  let source = read('app/slr-child-editor.tsx');
  source = replaceOnce(
    source,
    "              {['Draft', 'Issued', 'Answered', 'Closed'].map((status) => <option key={status}>{status}</option>)}",
    "              {(rfi.locked ? ['Issued', 'Answered', 'Closed'] : ['Draft', 'Issued', 'Answered', 'Closed']).map((status) => <option key={status}>{status}</option>)}",
    'locked RFI cannot return to draft',
  );
  write('app/slr-child-editor.tsx', source);
}

function patchWorkspace() {
  let source = read('app/workspace.tsx');

  source = replaceOnce(
    source,
    "const ISSUE_STATUS_OPTIONS = alphaSorted(['Open', 'Under Review', 'Resolved', 'Closed']);",
    "const ISSUE_STATUS_OPTIONS = ['Open', 'Under Review', 'Resolved', 'Closed'];",
    'parent SLR workflow status order',
  );

  source = replaceOnce(
    source,
    "  cells: [rfi.number, rfi.title || issue.title, rfi.systems.join('; ') || systemName(issue), rfi.question, rfi.reference || issue.reference],",
    "  cells: [rfi.number, rfi.title || issue.title, rfi.systems.map((system) => displaySystem(issue, system)).join('; ') || systemName(issue), rfi.question, rfi.reference || issue.reference],",
    'RFI custom Other display label',
  );

  source = replaceOnce(
    source,
    "  key: `${issue.uid}:${item.uid}`, cells: [issue.id, item.system, item.question, 'Editable in PDF', 'Editable in PDF'],",
    "  key: `${issue.uid}:${item.uid}`, cells: [issue.id, displaySystem(issue, item.system), item.question, 'Editable in PDF', 'Editable in PDF'],",
    'checklist custom Other display label',
  );

  source = replaceOnce(
    source,
    "      const templateIssue = normalizeIssue({ ...JSON.parse(JSON.stringify(template.issue)), uid: issue.uid, id: issue.id });\n      Object.assign(issue, templateIssue, { uid: issue.uid, id: issue.id, rfi: '', snippet: '' });",
    "      const templateIssue = normalizeIssue({ ...JSON.parse(JSON.stringify(template.issue)), uid: issue.uid, id: issue.id });\n      const rfiUidMap = new Map<string, string>();\n      templateIssue.rfis = templateIssue.rfis.map((child) => {\n        const nextUid = crypto.randomUUID();\n        rfiUidMap.set(child.uid, nextUid);\n        return { ...child, uid: nextUid };\n      });\n      templateIssue.recommendBaseBids = templateIssue.recommendBaseBids.map((rbb) => ({\n        ...rbb,\n        uid: crypto.randomUUID(),\n        sections: Object.fromEntries(Object.entries(rbb.sections).map(([system, section]) => [system, {\n          ...section,\n          uid: crypto.randomUUID(),\n          basedOnRfiUids: section.basedOnRfiUids.map((oldUid) => rfiUidMap.get(oldUid)).filter((nextUid): nextUid is string => Boolean(nextUid)),\n        }])),\n      }));\n      templateIssue.checklistQuestions = templateIssue.checklistQuestions.map((child) => ({ ...child, uid: crypto.randomUUID(), verifiesRbbNumbers: [] }));\n      Object.assign(issue, templateIssue, { uid: issue.uid, id: issue.id, rfi: '', snippet: '' });",
    'template child identity regeneration',
  );

  write('app/workspace.tsx', source);
}

function patchPdf() {
  let source = read('app/pdf-generator.ts');

  source = replaceOnce(
    source,
    "    values: ({ issue, rfi }) => [rfi?.number || '', rfi?.title || issue.title, rfi?.systems?.join('; ') || systemNames(issue), rfi?.question || '', rfi?.reference || issue.reference],",
    "    values: ({ issue, rfi }) => [rfi?.number || '', rfi?.title || issue.title, rfi?.systems?.map((system) => displaySystem(issue, system)).join('; ') || systemNames(issue), rfi?.question || '', rfi?.reference || issue.reference],",
    'PDF RFI custom Other display label',
  );

  source = replaceOnce(
    source,
    "    const rows = normalized.flatMap((issue) => checklistChildrenForDeliverable(issue).map((checklist) => ({ issue, checklist, system: checklist.system, section: checklist.system })));",
    "    const rows = normalized.flatMap((issue) => checklistChildrenForDeliverable(issue).map((checklist) => ({ issue, checklist, system: checklist.system, section: displaySystem(issue, checklist.system) })));",
    'PDF checklist custom Other section label',
  );

  write('app/pdf-generator.ts', source);
}

patchModel();
patchEditor();
patchWorkspace();
patchPdf();
console.log('Final SLR production safety hardening applied. Run git diff --check and npm run build.');
