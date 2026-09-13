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

function patchWorkspace() {
  let source = read('app/workspace.tsx');

  source = replaceOnce(
    source,
    "const ISSUE_STATUS_OPTIONS = alphaSorted(['Open', 'Under Review', 'Answered', 'Closed']);",
    "const ISSUE_STATUS_OPTIONS = alphaSorted(['Open', 'Under Review', 'Resolved', 'Closed']);",
    'SLR lifecycle statuses',
  );

  source = replaceOnce(
    source,
    "response: 'Included', responseReason: '', numberLocked: false, numberReleasedAt: '', rfis: [], recommendBaseBids: [], checklistQuestions: [] });",
    "response: 'Included', responseReason: '', numberLocked: false, numberReleasedAt: '', rbbScopeLetterMap: {}, rfis: [], recommendBaseBids: [], checklistQuestions: [] });",
    'blank issue scope-letter map',
  );

  source = replaceOnce(
    source,
    "    const selectedIssue = issues.find((item) => item.uid === selectedUid);\n    if (selectedIssue?.numberLocked) return message('Customer-Visible SLR', `${selectedIssue.id} has appeared in an Official Release. Its permanent number and history cannot be deleted. Resolve, close, or supersede its child records instead.`);",
    "    const selectedIssue = issues.find((item) => item.uid === selectedUid);\n    const hasCustomerVisibleChild = Boolean(selectedIssue && (selectedIssue.rfis.some((child) => child.locked) || selectedIssue.recommendBaseBids.some((rbb) => Object.values(rbb.sections).some((section) => section.locked || section.contentReleased)) || selectedIssue.checklistQuestions.some((child) => child.locked)));\n    if (selectedIssue?.numberLocked || hasCustomerVisibleChild) return message('Customer-Visible SLR History', `${selectedIssue?.id || 'This SLR'} contains information that has appeared in an Official Release. It cannot be hard-deleted. Resolve or close the SLR, or supersede the affected child record instead.`);",
    'parent delete child-history guard',
  );

  source = replaceOnce(
    source,
    "      templateDraft.numberLocked = false; templateDraft.numberReleasedAt = '';\n      templateDraft.rfis = templateDraft.rfis.map((child) => ({ ...child, number: '', locked: false, releasedAt: '', status: child.status === 'Closed' ? 'Draft' : child.status }));\n      templateDraft.recommendBaseBids = templateDraft.recommendBaseBids.map((rbb) => ({ ...rbb, baseSequence: 0, baseNumber: '', sections: Object.fromEntries(Object.entries(rbb.sections).map(([system, section]) => [system, { ...section, suffix: '', displayNumber: '', locked: false, contentReleased: false, releasedAt: '', supersedesNumber: '' }])) }));\n      templateDraft.checklistQuestions = templateDraft.checklistQuestions.map((child) => ({ ...child, number: '', locked: false, releasedAt: '' }));",
    "      templateDraft.numberLocked = false; templateDraft.numberReleasedAt = ''; templateDraft.rbbScopeLetterMap = {};\n      templateDraft.rfis = templateDraft.rfis.map((child) => ({ ...child, number: '', locked: false, releasedAt: '', status: 'Draft', response: '', responseDate: '', responseSource: '', relatedChildNumbers: [] }));\n      templateDraft.recommendBaseBids = templateDraft.recommendBaseBids.map((rbb) => ({ ...rbb, baseSequence: 0, baseNumber: '', sections: Object.fromEntries(Object.entries(rbb.sections).map(([system, section]) => [system, { ...section, suffix: '', displayNumber: '', status: 'Current', locked: false, contentReleased: false, releasedAt: '', supersedesNumber: '', basedOnRfiUids: [] }])) }));\n      templateDraft.checklistQuestions = templateDraft.checklistQuestions.map((child) => ({ ...child, number: '', status: 'Open', response: 'Included', responseReason: '', locked: false, releasedAt: '', verifiesRbbNumbers: [] }));",
    'template lifecycle reset',
  );

  source = replaceOnce(
    source,
    "      const archived = await saveOfficialRelease(projectId, project.revision, project.versionDate, fileName, notes, kinds, blob, releaseSnapshot);\n      setIssues(() => lockedIssues);\n      const url = URL.createObjectURL(blob);",
    "      const archived = await saveOfficialRelease(projectId, project.revision, project.versionDate, fileName, notes, kinds, blob, releaseSnapshot);\n      const targetIssueProjectIds = sharedIssueProjectIds.length ? sharedIssueProjectIds : [projectId];\n      const lockedIssuesByProject = targetIssueProjectIds.reduce<Record<string, Issue[]>>((next, id) => ({ ...next, [id]: lockedIssues }), { ...cloudSnapshot.issuesByProject });\n      let lockSyncWarning = '';\n      try {\n        await saveWorkspaceToCloud({ ...cloudSnapshot, issuesByProject: lockedIssuesByProject });\n        skipNextCloudSync.current = true;\n        writeLocalSyncMeta({ pendingCloudChanges: false, lastCloudSyncAt: new Date().toISOString() });\n        setSyncState('synced');\n        setCloudStatus((current) => ({ ...current, cloudRevision: current.cloudRevision + 1, lastCloudSyncAt: new Date().toISOString() }));\n      } catch (cause) {\n        lockSyncWarning = cause instanceof Error ? cause.message : 'Customer-visible numbering locks could not be synchronized immediately.';\n        writeLocalSyncMeta({ pendingCloudChanges: true, changedAt: new Date().toISOString(), lastCloudSyncAt: readLocalSyncMeta().lastCloudSyncAt });\n        setSyncState('error');\n        setSyncError(lockSyncWarning);\n      }\n      setIssues(() => lockedIssues);\n      const url = URL.createObjectURL(blob);",
    'immediate release lock persistence',
  );

  source = replaceOnce(
    source,
    "      message('Official Release Created', `Release ${String(archived.releaseNumber).padStart(3, '0')} was archived as an immutable cloud record and downloaded.`);",
    "      message(lockSyncWarning ? 'Official Release Created — Sync Required' : 'Official Release Created', lockSyncWarning ? `Release ${String(archived.releaseNumber).padStart(3, '0')} was archived and downloaded, but its customer-visible numbering locks still need cloud synchronization: ${lockSyncWarning}` : `Release ${String(archived.releaseNumber).padStart(3, '0')} was archived as an immutable cloud record, its numbering locks were persisted, and the PDF was downloaded.`);",
    'release lock sync message',
  );

  write('app/workspace.tsx', source);
}

function patchModel() {
  let source = read('app/slr-model.ts');

  source = replaceOnce(
    source,
    "export type SlrChildFields = {\n  numberLocked: boolean;\n  numberReleasedAt: string;",
    "export type SlrChildFields = {\n  numberLocked: boolean;\n  numberReleasedAt: string;\n  rbbScopeLetterMap: Record<string, string>;",
    'scope-letter map type',
  );

  source = replaceOnce(
    source,
    "  issue.numberLocked = Boolean(issue.numberLocked);\n  issue.numberReleasedAt = text(issue.numberReleasedAt);\n  return syncLegacyFields(issue);",
    "  issue.numberLocked = Boolean(issue.numberLocked);\n  issue.numberReleasedAt = text(issue.numberReleasedAt);\n  issue.rbbScopeLetterMap = issue.rbbScopeLetterMap && typeof issue.rbbScopeLetterMap === 'object' ? Object.fromEntries(Object.entries(issue.rbbScopeLetterMap).map(([system, suffix]) => [text(system), text(suffix).toUpperCase()]).filter(([system, suffix]) => system && suffix)) : {};\n  return syncLegacyFields(issue);",
    'scope-letter map normalization',
  );

  source = replaceOnce(
    source,
    "  const suffixBySystem = new Map<string, string>();\n  const usedSuffixes = new Set<string>();\n  const captureSuffix = (system: string, suffix: string) => {",
    "  const suffixBySystem = new Map<string, string>();\n  const usedSuffixes = new Set<string>();\n  const captureSuffix = (system: string, suffix: string) => {",
    'scope-letter capture anchor',
  );

  source = replaceOnce(
    source,
    "  issues.forEach((issue) => issue.recommendBaseBids.forEach((rbb) => Object.values(rbb.sections).forEach((section) => {\n    if (section.locked || section.contentReleased) captureSuffix(section.system, section.suffix);\n  })));",
    "  issues.forEach((issue) => Object.entries(issue.rbbScopeLetterMap || {}).forEach(([system, suffix]) => captureSuffix(system, suffix)));\n  issues.forEach((issue) => issue.recommendBaseBids.forEach((rbb) => Object.values(rbb.sections).forEach((section) => {\n    if (section.locked || section.contentReleased) captureSuffix(section.system, section.suffix);\n  })));",
    'persisted scope-letter map seed',
  );

  source = replaceOnce(
    source,
    "  const lockedChecklist = new Set<number>();",
    "  const persistedScopeLetterMap = Object.fromEntries(suffixBySystem.entries());\n  issues.forEach((issue) => { issue.rbbScopeLetterMap = { ...persistedScopeLetterMap }; });\n\n  const lockedChecklist = new Set<number>();",
    'persist scope-letter map onto issues',
  );

  source = replaceOnce(
    source,
    "  issue.rfis.forEach((rfi) => { if (text(rfi.number)) values.push(`${rfi.number} — ${rfi.status}`); });\n  issue.recommendBaseBids.forEach((rbb) => rbb.selectedSystems.forEach((system) => {\n    const section = rbb.sections[system];\n    if (section?.displayNumber) values.push(`${section.displayNumber} — ${section.status}`);\n  }));",
    "  issue.rfis.forEach((rfi) => { if (text(rfi.number) && text(rfi.question) && (rfi.locked || rfi.status !== 'Draft')) values.push(`${rfi.number} — ${rfi.status}`); });\n  issue.recommendBaseBids.forEach((rbb) => rbb.selectedSystems.forEach((system) => {\n    const section = rbb.sections[system];\n    const customerReady = Boolean(section && text(section.recommendation) && ['Current', 'Confirmed'].includes(section.status));\n    const historical = Boolean(section && (section.locked || section.contentReleased));\n    if (section?.displayNumber && (customerReady || historical)) values.push(`${section.displayNumber} — ${section.status}`);\n  }));",
    'clarification child visibility gating',
  );

  source = replaceOnce(
    source,
    "      rfi.locked = true; rfi.releasedAt ||= releasedAt;\n      if (kinds.includes('rfi') && rfi.status === 'Draft') rfi.status = 'Issued';",
    "      rfi.locked = true; rfi.releasedAt ||= releasedAt;\n      if (rfi.status === 'Draft') rfi.status = 'Issued';",
    'customer-visible RFI issued status',
  );

  write('app/slr-model.ts', source);
}

function patchEditor() {
  let source = read('app/slr-child-editor.tsx');

  source = replaceOnce(source,
    '<label className="field"><span>RFI Title / Subject</span><input value={rfi.title} onChange={(event) => commit((next) => { next.rfis[index].title = event.target.value; })} /></label>',
    '<label className="field"><span>RFI Title / Subject</span><input readOnly={rfi.locked} value={rfi.title} onChange={(event) => commit((next) => { next.rfis[index].title = event.target.value; })} /></label>',
    'lock released RFI title');
  source = replaceOnce(source,
    '<label className="field"><span>Document Reference</span><input value={rfi.reference} onChange={(event) => commit((next) => { next.rfis[index].reference = event.target.value; })} /></label>',
    '<label className="field"><span>Document Reference</span><input readOnly={rfi.locked} value={rfi.reference} onChange={(event) => commit((next) => { next.rfis[index].reference = event.target.value; })} /></label>',
    'lock released RFI reference');
  source = replaceOnce(source,
    '<label className="field"><span>Question</span><textarea rows={3} value={rfi.question} onChange={(event) => commit((next) => { next.rfis[index].question = event.target.value; })} /></label>',
    '<label className="field"><span>Question</span><textarea rows={3} readOnly={rfi.locked} value={rfi.question} onChange={(event) => commit((next) => { next.rfis[index].question = event.target.value; })} /></label>',
    'lock released RFI question');
  source = replaceOnce(source,
    'type="checkbox" checked={rfi.systems.includes(system)} onChange=',
    'type="checkbox" checked={rfi.systems.includes(system)} disabled={rfi.locked} onChange=',
    'lock released RFI systems');
  source = replaceOnce(source,
    '<label><input type="checkbox" checked={rfi.includeInFormalRfi} onChange=',
    '<label><input type="checkbox" checked={rfi.includeInFormalRfi} disabled={rfi.locked} onChange=',
    'lock released RFI inclusion');

  const oldStatus = `                  <select value={section.status} onChange={(event) => commit((next) => { next.recommendBaseBids[rbbIndex].sections[system].status = event.target.value as typeof section.status; })}>\n                    {['Draft', 'Current', 'Confirmed', 'Superseded'].map((status) => <option key={status}>{status}</option>)}\n                  </select>`;
  const newStatus = `                  {(section.locked || section.contentReleased) ? <div className="slr-child-actions">\n                    {section.status !== 'Superseded' && <button className="secondary" type="button" onClick={() => commit((next) => { next.recommendBaseBids[rbbIndex].sections[system].status = 'Confirmed'; })}>Confirm</button>}\n                    {section.status !== 'Superseded' && <button className="secondary" type="button" onClick={() => commit((next) => {\n                      const currentSection = next.recommendBaseBids[rbbIndex].sections[system];\n                      currentSection.status = 'Superseded';\n                      const replacement = blankRbbChild(system);\n                      replacement.forceSuffix = Boolean(currentSection.suffix);\n                      replacement.sections[system].suffix = currentSection.suffix;\n                      replacement.sections[system].supersedesNumber = currentSection.displayNumber;\n                      next.recommendBaseBids.push(replacement);\n                    })}>Supersede & Create Replacement</button>}\n                    {section.status === 'Superseded' && <span className="status-badge">Superseded</span>}\n                  </div> : <select value={section.status} onChange={(event) => commit((next) => { next.recommendBaseBids[rbbIndex].sections[system].status = event.target.value as typeof section.status; })}>\n                    {['Draft', 'Current', 'Confirmed', 'Superseded'].map((status) => <option key={status}>{status}</option>)}\n                  </select>}`;
  source = replaceOnce(source, oldStatus, newStatus, 'released RBB lifecycle actions');

  source = replaceOnce(source,
    '<label className="field"><span>System</span><select value={item.system} onChange=',
    '<label className="field"><span>System</span><select value={item.system} disabled={item.locked} onChange=',
    'lock released checklist system');
  source = replaceOnce(source,
    '<label className="field"><span>Checklist Question / Requirement</span><textarea rows={3} value={item.question} onChange=',
    '<label className="field"><span>Checklist Question / Requirement</span><textarea rows={3} readOnly={item.locked} value={item.question} onChange=',
    'lock released checklist question');

  write('app/slr-child-editor.tsx', source);
}

function patchCloud() {
  let source = read('lib/cloud-workspace-legacy.ts');
  source = replaceOnce(source,
    "  numberReleasedAt: string;\n  rfis: any[];",
    "  numberReleasedAt: string;\n  rbbScopeLetterMap: Record<string, string>;\n  rfis: any[];",
    'cloud issue scope-letter type');
  source = replaceOnce(source,
    "      numberReleasedAt: text(row.number_released_at),\n      rfis: Array.isArray(row.rfi_children) ? row.rfi_children : [],",
    "      numberReleasedAt: text(row.number_released_at),\n      rbbScopeLetterMap: row.rbb_scope_letter_map && typeof row.rbb_scope_letter_map === 'object' ? Object.fromEntries(Object.entries(row.rbb_scope_letter_map).map(([key, value]) => [key, text(value)])) : {},\n      rfis: Array.isArray(row.rfi_children) ? row.rfi_children : [],",
    'cloud load scope-letter map');
  source = replaceOnce(source,
    "      number_released_at: issue.numberReleasedAt || null,\n      rfi_children: issue.rfis || [],",
    "      number_released_at: issue.numberReleasedAt || null,\n      rbb_scope_letter_map: issue.rbbScopeLetterMap || {},\n      rfi_children: issue.rfis || [],",
    'cloud save scope-letter map');
  write('lib/cloud-workspace-legacy.ts', source);
}

function patchMigration() {
  let source = read('supabase/migrations/20260913000100_scopelogic_slr_parent_child_rbb.sql');
  source = replaceOnce(source,
    "  add column if not exists number_locked boolean not null default false,\n  add column if not exists number_released_at timestamptz;",
    "  add column if not exists number_locked boolean not null default false,\n  add column if not exists number_released_at timestamptz,\n  add column if not exists rbb_scope_letter_map jsonb not null default '{}'::jsonb;",
    'migration scope-letter column');

  source = replaceOnce(source,
    "where entry.id = history.id;\n\nnotify pgrst, 'reload schema';",
    `where entry.id = history.id;\n\n-- Convert legacy customer-visible RFI numbers into locked child records so an\n-- upgrade can never silently renumber a previously issued RFI.\nwith legacy_rfi_visibility as (\n  select e.id, min(rp.released_at) as first_released_at\n  from public.slr_entries e\n  join public.release_packages rp on rp.project_id = e.project_id\n  where coalesce(e.rfi_number, '') <> ''\n    and coalesce(e.rfi_question, '') <> ''\n    and (\n      coalesce(rp.snapshot_data -> 'deliverables', '[]'::jsonb) ? 'rfi'\n      or coalesce(rp.snapshot_data -> 'deliverables', '[]'::jsonb) ? 'clarifications'\n    )\n    and exists (\n      select 1 from jsonb_array_elements(coalesce(rp.snapshot_data -> 'issues', '[]'::jsonb)) snapshot_issue\n      where coalesce(snapshot_issue ->> 'uid', '') = coalesce(e.legacy_uid, '')\n         or coalesce(snapshot_issue ->> 'id', '') = e.display_number\n    )\n  group by e.id\n), legacy_rfi_payload as (\n  select e.id, visibility.first_released_at\n  from public.slr_entries e\n  left join legacy_rfi_visibility visibility on visibility.id = e.id\n  where coalesce(e.rfi_number, '') <> ''\n    and coalesce(e.rfi_question, '') <> ''\n    and (e.rfi_children is null or e.rfi_children = '[]'::jsonb)\n)\nupdate public.slr_entries entry\nset rfi_children = jsonb_build_array(jsonb_build_object(\n  'uid', gen_random_uuid()::text,\n  'number', entry.rfi_number,\n  'title', entry.scope_item,\n  'systems', case when jsonb_typeof(entry.systems) = 'array' and jsonb_array_length(entry.systems) > 0 then entry.systems else jsonb_build_array(coalesce(nullif(entry.system_name, ''), 'Structured Cabling')) end,\n  'question', entry.rfi_question,\n  'reference', entry.reference,\n  'status', case when coalesce(entry.resolution, '') <> '' then 'Answered' when payload.first_released_at is not null then 'Issued' else 'Draft' end,\n  'response', entry.resolution,\n  'responseDate', '',\n  'responseSource', '',\n  'includeInFormalRfi', entry.include_formal_rfi,\n  'locked', payload.first_released_at is not null,\n  'releasedAt', coalesce(payload.first_released_at::text, ''),\n  'relatedChildNumbers', '[]'::jsonb\n))\nfrom legacy_rfi_payload payload\nwhere entry.id = payload.id;\n\nnotify pgrst, 'reload schema';`,
    'legacy RFI lock migration');
  write('supabase/migrations/20260913000100_scopelogic_slr_parent_child_rbb.sql', source);
}

patchWorkspace();
patchModel();
patchEditor();
patchCloud();
patchMigration();
console.log('SLR lifecycle hardening applied. Run npm run build and git diff --check next.');
