'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../../lib/supabase/client';
import {
  createProjectFileUrl,
  createWorkspaceBackup,
  loadWorkspaceFromCloud,
  removeProjectFile,
  saveWorkspaceToCloud,
  uploadProjectFile,
  type WorkspaceSnapshot,
} from '../../lib/cloud-workspace';
import { normalizeLegacyChildren, normalizeProjectIssueNumbers, syncLegacyFields } from '../slr-model';

type Props = {
  actualUserId: string;
  workspaceOwnerId: string;
};

type MasterOption = {
  id: string;
  project_number: string;
  name: string;
  is_archived: boolean;
};

type AnyRecord = Record<string, any>;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const nowIso = () => new Date().toISOString();
const copiedProjectName = (name: string) => `copy - ${String(name || '').replace(/^copy\s*-\s*/i, '')}`;

const resetQuoteLifecycle = (source: AnyRecord) => {
  const quote = clone(source);
  const groupIds = new Map<string, string>();
  const breakoutIds = new Map<string, string>();
  const alternateIds = new Map<string, string>();

  quote.id = crypto.randomUUID();
  quote.locked = false;
  quote.lockedAt = undefined;
  quote.generatedReleaseId = undefined;
  quote.createdAt = nowIso();
  quote.updatedAt = nowIso();

  quote.groups = (quote.groups || []).map((group: AnyRecord) => {
    const id = crypto.randomUUID();
    groupIds.set(String(group.id || ''), id);
    return { ...group, id };
  });
  quote.breakouts = (quote.breakouts || []).map((breakout: AnyRecord) => {
    const id = crypto.randomUUID();
    breakoutIds.set(String(breakout.id || ''), id);
    return { ...breakout, id };
  });
  quote.alternates = (quote.alternates || []).map((alternate: AnyRecord) => {
    const id = crypto.randomUUID();
    alternateIds.set(String(alternate.id || ''), id);
    return { ...alternate, id };
  });
  quote.lines = (quote.lines || []).map((line: AnyRecord) => ({
    ...line,
    id: crypto.randomUUID(),
    groupId: line.groupId ? groupIds.get(String(line.groupId)) || '' : '',
    breakoutId: line.breakoutId ? breakoutIds.get(String(line.breakoutId)) || '' : '',
    breakoutAllocations: Object.fromEntries(Object.entries(line.breakoutAllocations || {}).map(([id, qty]) => [breakoutIds.get(id) || '', qty]).filter(([id]) => Boolean(id))),
    alternateId: line.alternateId ? alternateIds.get(String(line.alternateId)) || '' : '',
  }));
  return quote;
};

function freshCopiedSlrs(sourceIssues: AnyRecord[]): AnyRecord[] {
  const oldNumberToIdentity = new Map<string, { kind: 'rfi' | 'rbb' | 'checklist'; uid: string; system?: string }>();
  const rfiRelations = new Map<string, string[]>();
  const checklistRelations = new Map<string, string[]>();
  const supersedesRelations = new Map<string, string>();

  const reset = sourceIssues.map((raw) => {
    const issue = normalizeLegacyChildren(clone(raw) as any) as AnyRecord;
    issue.uid = crypto.randomUUID();
    issue.numberLocked = false;
    issue.numberReleasedAt = '';
    issue.rbbScopeLetterMap = {};

    const rfiUidMap = new Map<string, string>();
    issue.rfis = (issue.rfis || []).map((sourceRfi: AnyRecord) => {
      const oldUid = String(sourceRfi.uid || '');
      const oldNumber = String(sourceRfi.number || '');
      const uid = crypto.randomUUID();
      if (oldUid) rfiUidMap.set(oldUid, uid);
      if (oldNumber) oldNumberToIdentity.set(oldNumber, { kind: 'rfi', uid });
      rfiRelations.set(uid, Array.isArray(sourceRfi.relatedChildNumbers) ? [...sourceRfi.relatedChildNumbers] : []);
      return {
        ...sourceRfi,
        uid,
        number: '',
        status: 'Draft',
        locked: false,
        releasedAt: '',
        relatedChildNumbers: [],
      };
    });

    issue.recommendBaseBids = (issue.recommendBaseBids || []).map((sourceRbb: AnyRecord) => {
      const rbbUid = crypto.randomUUID();
      const sections: Record<string, AnyRecord> = {};
      for (const system of sourceRbb.selectedSystems || []) {
        const sourceSection = sourceRbb.sections?.[system] || {};
        const uid = crypto.randomUUID();
        const oldNumber = String(sourceSection.displayNumber || '');
        if (oldNumber) oldNumberToIdentity.set(oldNumber, { kind: 'rbb', uid: rbbUid, system });
        supersedesRelations.set(uid, String(sourceSection.supersedesNumber || ''));
        sections[system] = {
          ...sourceSection,
          uid,
          suffix: '',
          displayNumber: '',
          locked: false,
          contentReleased: false,
          releasedAt: '',
          supersedesNumber: '',
          basedOnRfiUids: (sourceSection.basedOnRfiUids || []).map((oldUid: string) => rfiUidMap.get(String(oldUid)) || '').filter(Boolean),
        };
      }
      return {
        ...sourceRbb,
        uid: rbbUid,
        baseSequence: 0,
        baseNumber: '',
        forceSuffix: false,
        sections,
      };
    });

    issue.checklistQuestions = (issue.checklistQuestions || []).map((sourceItem: AnyRecord) => {
      const uid = crypto.randomUUID();
      const oldNumber = String(sourceItem.number || '');
      if (oldNumber) oldNumberToIdentity.set(oldNumber, { kind: 'checklist', uid });
      checklistRelations.set(uid, Array.isArray(sourceItem.verifiesRbbNumbers) ? [...sourceItem.verifiesRbbNumbers] : []);
      return {
        ...sourceItem,
        uid,
        number: '',
        locked: false,
        releasedAt: '',
        verifiesRbbNumbers: [],
      };
    });

    return syncLegacyFields(issue as any) as AnyRecord;
  });

  const normalized = normalizeProjectIssueNumbers(reset as any[]) as AnyRecord[];
  const identityToNumber = new Map<string, string>();
  normalized.forEach((issue) => {
    (issue.rfis || []).forEach((rfi: AnyRecord) => identityToNumber.set(`rfi:${rfi.uid}`, String(rfi.number || '')));
    (issue.recommendBaseBids || []).forEach((rbb: AnyRecord) => (rbb.selectedSystems || []).forEach((system: string) => {
      const section = rbb.sections?.[system];
      if (section) identityToNumber.set(`rbb:${rbb.uid}:${system}`, String(section.displayNumber || ''));
    }));
    (issue.checklistQuestions || []).forEach((item: AnyRecord) => identityToNumber.set(`checklist:${item.uid}`, String(item.number || '')));
  });

  const remapNumber = (oldNumber: string) => {
    const identity = oldNumberToIdentity.get(String(oldNumber || ''));
    if (!identity) return '';
    return identityToNumber.get(identity.kind === 'rbb' ? `rbb:${identity.uid}:${identity.system || ''}` : `${identity.kind}:${identity.uid}`) || '';
  };

  normalized.forEach((issue) => {
    (issue.rfis || []).forEach((rfi: AnyRecord) => {
      rfi.relatedChildNumbers = (rfiRelations.get(rfi.uid) || []).map(remapNumber).filter(Boolean);
    });
    (issue.recommendBaseBids || []).forEach((rbb: AnyRecord) => (rbb.selectedSystems || []).forEach((system: string) => {
      const section = rbb.sections?.[system];
      if (!section) return;
      section.supersedesNumber = remapNumber(supersedesRelations.get(section.uid) || '');
    }));
    (issue.checklistQuestions || []).forEach((item: AnyRecord) => {
      item.verifiesRbbNumbers = (checklistRelations.get(item.uid) || []).map(remapNumber).filter(Boolean);
    });
    syncLegacyFields(issue as any);
  });

  return normalized;
}

function synthesizeIssue(finding: AnyRecord): AnyRecord {
  const systems = Array.isArray(finding.systems) && finding.systems.length ? finding.systems : ['Structured Cabling'];
  return {
    uid: String(finding.legacy_uid || crypto.randomUUID()),
    id: String(finding.display_number || ''),
    system: systems[0] || 'Structured Cabling',
    customSystem: String(finding.custom_system || ''),
    systems,
    recommendations: finding.recommended_bid_basis_by_system || {},
    title: String(finding.scope_item || ''),
    status: String(finding.status || 'Open'),
    concern: String(finding.scope_concern || ''),
    rfiQuestion: String(finding.rfi_question || ''),
    basis: String(finding.recommended_bid_basis || ''),
    reason: String(finding.reason_basis || ''),
    reference: String(finding.reference || ''),
    sourceType: String(finding.source_type || ''),
    rfi: String(finding.rfi_number || ''),
    resolution: String(finding.resolution || ''),
    snippet: String(finding.snippet_number || ''),
    sow: finding.include_sow !== false,
    clarification: finding.include_clarification !== false,
    formalRfi: Boolean(finding.include_formal_rfi),
    checklist: Boolean(String(finding.checklist_scope_item || '').trim()),
    checklistItem: String(finding.checklist_scope_item || ''),
    checklistItems: finding.checklist_scope_items_by_system || {},
    response: String(finding.contractor_response || ''),
    responseReason: String(finding.contractor_response_reason || ''),
    numberLocked: false,
    numberReleasedAt: '',
    rbbScopeLetterMap: {},
    rfis: [],
    recommendBaseBids: [],
    checklistQuestions: [],
  };
}

export default function MasterProjectCopyControl({ actualUserId, workspaceOwnerId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [mounted, setMounted] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const [masters, setMasters] = useState<MasterOption[]>([]);
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    setHost(document.querySelector('.mp-topbar .mp-actions'));
    void supabase.from('master_projects').select('id,project_number,name,is_archived').order('project_number').then(({ data }) => setMasters((data || []) as MasterOption[]));
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) setOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, busy]);

  const selected = masters.find((master) => master.id === sourceId) || null;

  const copyMaster = async () => {
    if (!sourceId || !selected || busy) return;
    setBusy(true);
    setError('');
    setProgress('Reading source project…');
    const uploadedPaths: string[] = [];
    let newMasterId = '';

    try {
      const loaded = await loadWorkspaceFromCloud();
      if (!loaded.snapshot) throw new Error('The cloud workspace could not be loaded. No copy was created.');
      const original = loaded.snapshot as WorkspaceSnapshot;
      await createWorkspaceBackup(original, `Before copying Master Project ${selected.project_number}`, 'manual');

      const [masterResult, projectResult, findingResult, sourceSlrResult, assignmentResult, masterNoteResult, masterDocResult, masterEventResult] = await Promise.all([
        supabase.from('master_projects').select('*').eq('id', sourceId).single(),
        supabase.from('projects').select('*').eq('master_project_id', sourceId).order('created_at'),
        supabase.from('master_project_findings').select('*').eq('master_project_id', sourceId).order('sequence_number'),
        supabase.from('slr_entries').select('id,project_id,legacy_uid,master_finding_id').in('project_id', (await supabase.from('projects').select('id').eq('master_project_id', sourceId)).data?.map((row: AnyRecord) => row.id) || ['00000000-0000-0000-0000-000000000000']),
        supabase.from('master_project_assignments').select('user_id').eq('master_project_id', sourceId),
        supabase.from('master_project_internal_notes').select('notes').eq('master_project_id', sourceId).maybeSingle(),
        supabase.from('master_project_documents').select('*').eq('master_project_id', sourceId).order('created_at'),
        supabase.from('master_project_calendar_events').select('*').eq('master_project_id', sourceId).order('event_date'),
      ]);
      const readError = masterResult.error || projectResult.error || findingResult.error || sourceSlrResult.error || assignmentResult.error || masterNoteResult.error || masterDocResult.error || masterEventResult.error;
      if (readError) throw new Error(readError.message);

      const sourceMaster = masterResult.data as AnyRecord;
      const sourceProjects = (projectResult.data || []) as AnyRecord[];
      const sourceFindings = (findingResult.data || []) as AnyRecord[];
      const sourceSlrLinks = (sourceSlrResult.data || []) as AnyRecord[];
      const sourceMasterDocs = (masterDocResult.data || []) as AnyRecord[];
      const sourceMasterEvents = (masterEventResult.data || []) as AnyRecord[];
      const copyName = copiedProjectName(sourceMaster.name);
      const targetMasterLegacyId = makeId('master');
      const sourceSnapshotProjectByLegacy = new Map(original.projects.map((project) => [project.id, project]));

      for (const project of sourceProjects) {
        if (!project.legacy_id || !sourceSnapshotProjectByLegacy.has(String(project.legacy_id))) {
          throw new Error(`Client Engagement ${project.client_name || project.name || project.id} is not present in the current cloud workspace. Reload ScopeLogic before copying so no project content is omitted.`);
        }
      }

      setProgress('Copying project document files…');
      const sourceDocs = sourceProjects.flatMap((project) => original.docsByProject[String(project.legacy_id)] || []);
      const fileSources = new Map<string, { fileName: string; fileType: string }>();
      sourceMasterDocs.forEach((doc) => { if (doc.storage_path) fileSources.set(String(doc.storage_path), { fileName: String(doc.original_filename || doc.display_name || 'document'), fileType: String(doc.mime_type || 'application/octet-stream') }); });
      sourceDocs.forEach((doc: AnyRecord) => { if (doc.storagePath) fileSources.set(String(doc.storagePath), { fileName: String(doc.fileName || doc.name || 'document'), fileType: String(doc.fileType || 'application/octet-stream') }); });
      const storagePathMap = new Map<string, string>();
      for (const [sourcePath, meta] of fileSources) {
        const signedUrl = await createProjectFileUrl(sourcePath);
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error(`Could not read ${meta.fileName} while copying project documents.`);
        const blob = await response.blob();
        const targetPath = await uploadProjectFile(targetMasterLegacyId, makeId('doc'), blob, meta.fileName, meta.fileType);
        uploadedPaths.push(targetPath);
        storagePathMap.set(sourcePath, targetPath);
      }

      setProgress('Creating copied Master Project…');
      const masterInsert = await supabase.from('master_projects').insert({
        owner_id: workspaceOwnerId,
        created_by_user_id: actualUserId,
        legacy_id: targetMasterLegacyId,
        name: copyName,
        location: sourceMaster.location || '',
        status: sourceMaster.status || 'Planning',
        version_date: sourceMaster.version_date || null,
        revision: sourceMaster.revision || 'Rev 0',
        systems: sourceMaster.systems || [],
        notes: sourceMaster.notes || '',
        is_archived: false,
        archived_at: null,
      }).select('id,project_number').single();
      if (masterInsert.error || !masterInsert.data?.id) throw new Error(masterInsert.error?.message || 'The copied Master Project could not be created.');
      newMasterId = String(masterInsert.data.id);

      const targetBySourceLegacy = new Map<string, { dbId: string; legacyId: string }>();
      for (const sourceProject of sourceProjects) {
        const targetLegacyId = makeId('eng');
        const insert = await supabase.from('projects').insert({
          owner_id: workspaceOwnerId,
          assigned_user_id: sourceProject.assigned_user_id || actualUserId,
          legacy_id: targetLegacyId,
          master_project_id: newMasterId,
          name: copyName,
          client_name: sourceProject.client_name || '',
          customer_id: sourceProject.customer_id || null,
          version_date: sourceProject.version_date || null,
          status: sourceProject.status || 'Planning',
          revision: sourceProject.revision || 'Rev 0',
          modified_label: 'Now',
          engagement_label: sourceProject.engagement_label || 'Client Engagement',
          engagement_type: sourceProject.engagement_type || 'Product 1',
          is_quick_review: Boolean(sourceProject.is_quick_review),
        }).select('id').single();
        if (insert.error || !insert.data?.id) throw new Error(insert.error?.message || `Could not copy ${sourceProject.client_name || 'a Client Engagement'}.`);
        targetBySourceLegacy.set(String(sourceProject.legacy_id), { dbId: String(insert.data.id), legacyId: targetLegacyId });
      }

      setProgress('Resetting copied SLR release state and numbering…');
      const issueByUid = new Map<string, AnyRecord>();
      sourceProjects.forEach((project) => (original.issuesByProject[String(project.legacy_id)] || []).forEach((issue: AnyRecord) => issueByUid.set(String(issue.uid || ''), issue)));
      const findingUid = new Map<string, string>();
      sourceSlrLinks.forEach((row) => { if (row.master_finding_id && row.legacy_uid && !findingUid.has(String(row.master_finding_id))) findingUid.set(String(row.master_finding_id), String(row.legacy_uid)); });
      const canonicalSources = sourceFindings.length
        ? sourceFindings.map((finding) => clone(issueByUid.get(findingUid.get(String(finding.id)) || '') || synthesizeIssue(finding)))
        : clone(original.issuesByProject[String(sourceProjects[0]?.legacy_id || '')] || []);
      const copiedIssues = freshCopiedSlrs(canonicalSources);

      const next = clone(original) as WorkspaceSnapshot;
      for (const sourceProject of sourceProjects) {
        const sourceLegacyId = String(sourceProject.legacy_id);
        const target = targetBySourceLegacy.get(sourceLegacyId)!;
        const sourceSnapshotProject = sourceSnapshotProjectByLegacy.get(sourceLegacyId)!;
        next.projects.push({ ...clone(sourceSnapshotProject), id: target.legacyId, createdAt: nowIso(), name: copyName, modified: 'Now' });
        next.issuesByProject[target.legacyId] = clone(copiedIssues) as any;
        next.docsByProject[target.legacyId] = (original.docsByProject[sourceLegacyId] || []).map((doc: AnyRecord) => ({ ...clone(doc), storagePath: doc.storagePath ? storagePathMap.get(String(doc.storagePath)) || undefined : undefined }));
        next.notesByProject[target.legacyId] = String(original.notesByProject[sourceLegacyId] || '');
        next.exportsByProject[target.legacyId] = [];
        next.quotesByProject[target.legacyId] = (original.quotesByProject[sourceLegacyId] || []).map((quote: AnyRecord) => resetQuoteLifecycle(quote)) as any;
        next.takeoffEntriesByProject[target.legacyId] = clone(original.takeoffEntriesByProject[sourceLegacyId] || []);
        next.takeoffSettingsByProject[target.legacyId] = clone(original.takeoffSettingsByProject[sourceLegacyId] || { selectedSystems: [], activeRuleIds: [], averageCableLength: 250 });
        next.drawingTakeoffMarksByProject[target.legacyId] = clone(original.drawingTakeoffMarksByProject[sourceLegacyId] || []);
        next.drawingMeasurementsByProject[target.legacyId] = clone(original.drawingMeasurementsByProject[sourceLegacyId] || []);
        next.drawingCalibrationsByProject[target.legacyId] = clone(original.drawingCalibrationsByProject[sourceLegacyId] || {});
        next.drawingAnnotationsByProject[target.legacyId] = clone(original.drawingAnnotationsByProject[sourceLegacyId] || []);
        next.scopeOfWorkByProject[target.legacyId] = clone(original.scopeOfWorkByProject[sourceLegacyId] || { includedHtml: '', excludedHtml: '' });
      }

      const sourceProjectToTargetLegacy = new Map(sourceProjects.map((project) => [String(project.legacy_id), targetBySourceLegacy.get(String(project.legacy_id))!.legacyId]));
      next.calendarEntries.push(...original.calendarEntries.filter((entry) => sourceProjectToTargetLegacy.has(entry.projectId)).map((entry) => ({ ...clone(entry), id: crypto.randomUUID(), projectId: sourceProjectToTargetLegacy.get(entry.projectId)! })));

      setProgress('Copying Master Project baseline data…');
      if (masterNoteResult.data?.notes) {
        const noteSave = await supabase.from('master_project_internal_notes').upsert({ master_project_id: newMasterId, owner_id: workspaceOwnerId, notes: masterNoteResult.data.notes, updated_at: nowIso() });
        if (noteSave.error) throw new Error(noteSave.error.message);
      }
      const assignmentRows = (assignmentResult.data || []).map((row: AnyRecord) => ({ master_project_id: newMasterId, user_id: row.user_id, assigned_by_user_id: actualUserId }));
      if (assignmentRows.length) {
        const assignmentSave = await supabase.from('master_project_assignments').upsert(assignmentRows, { onConflict: 'master_project_id,user_id' });
        if (assignmentSave.error) throw new Error(assignmentSave.error.message);
      }

      for (const sourceDoc of sourceMasterDocs.filter((doc) => !doc.source_project_document_id)) {
        const insert = await supabase.from('master_project_documents').insert({
          owner_id: workspaceOwnerId,
          master_project_id: newMasterId,
          legacy_id: makeId('master-doc'),
          document_type: sourceDoc.document_type,
          display_name: sourceDoc.display_name,
          revision: sourceDoc.revision,
          issue_date: sourceDoc.issue_date,
          is_current: sourceDoc.is_current,
          notes: sourceDoc.notes,
          original_filename: sourceDoc.original_filename,
          mime_type: sourceDoc.mime_type,
          size_bytes: sourceDoc.size_bytes,
          storage_path: sourceDoc.storage_path ? storagePathMap.get(String(sourceDoc.storage_path)) || null : null,
          source_project_document_id: null,
        });
        if (insert.error) throw new Error(insert.error.message);
      }
      for (const sourceEvent of sourceMasterEvents.filter((event) => !event.source_calendar_event_id)) {
        const insert = await supabase.from('master_project_calendar_events').insert({
          owner_id: workspaceOwnerId,
          master_project_id: newMasterId,
          source_calendar_event_id: null,
          legacy_id: makeId('master-event'),
          event_date: sourceEvent.event_date,
          title: sourceEvent.title,
          event_type: sourceEvent.event_type,
        });
        if (insert.error) throw new Error(insert.error.message);
      }

      if (!sourceProjects.length && sourceFindings.length) {
        const rows = sourceFindings.map((finding, index) => ({
          owner_id: workspaceOwnerId,
          master_project_id: newMasterId,
          legacy_uid: crypto.randomUUID(),
          sequence_number: index + 1,
          display_number: `SLR-${String(index + 1).padStart(3, '0')}`,
          systems: finding.systems || [],
          custom_system: finding.custom_system || '',
          scope_item: finding.scope_item,
          status: finding.status || 'Open',
          scope_concern: finding.scope_concern || '',
          recommended_bid_basis: finding.recommended_bid_basis || '',
          recommended_bid_basis_by_system: finding.recommended_bid_basis_by_system || {},
          rfi_question: finding.rfi_question || '',
          reason_basis: finding.reason_basis || '',
          reference: finding.reference || '',
          source_type: finding.source_type || '',
          rfi_number: '',
          resolution: finding.resolution || '',
          snippet_number: finding.snippet_number || '',
          include_sow: finding.include_sow !== false,
          include_clarification: finding.include_clarification !== false,
          include_formal_rfi: Boolean(finding.include_formal_rfi),
          checklist_scope_item: finding.checklist_scope_item || '',
          checklist_scope_items_by_system: finding.checklist_scope_items_by_system || {},
          contractor_response: finding.contractor_response || 'Included',
          contractor_response_reason: finding.contractor_response_reason || '',
          ai_assistance: finding.ai_assistance || {},
          source_slr_entry_id: null,
        }));
        const findingSave = await supabase.from('master_project_findings').insert(rows);
        if (findingSave.error) throw new Error(findingSave.error.message);
      }

      setProgress('Saving copied working project data…');
      await saveWorkspaceToCloud(next);

      setProgress('Copy complete. Opening the new Master Project…');
      window.location.href = `/master-projects/${newMasterId}`;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The Master Project copy could not be completed.';
      setError(message);
      setProgress('');
      if (newMasterId) {
        const cleanup = await supabase.from('master_projects').delete().eq('id', newMasterId);
        if (cleanup.error) setError(`${message} Cleanup could not remove the partial copy: ${cleanup.error.message}`);
      }
      for (const path of uploadedPaths) {
        try { await removeProjectFile(path); } catch { /* best-effort cleanup; database error is surfaced above */ }
      }
      setBusy(false);
    }
  };

  if (!mounted || !host) return null;

  return <>
    {createPortal(<button className="mp-button secondary" type="button" onClick={() => { setError(''); setProgress(''); setOpen(true); }}>Copy Master Project</button>, host)}
    {open && createPortal(<div className="master-copy-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className="master-copy-modal" role="dialog" aria-modal="true" aria-labelledby="master-copy-title">
        <div className="master-copy-head"><div><span>Reuse a prior project baseline</span><h2 id="master-copy-title">Copy Master Project</h2></div><button type="button" disabled={busy} onClick={() => setOpen(false)}>×</button></div>
        <p>Select the prior Master Project to use as the starting point. ScopeLogic copies the working project content, Client Engagements, SLR content, documents, notes, estimating data, quotes, takeoff data, and project setup.</p>
        <label>Source Master Project<select value={sourceId} disabled={busy} onChange={(event) => setSourceId(event.target.value)}><option value="">Select a Master Project…</option>{masters.map((master) => <option key={master.id} value={master.id}>{master.project_number} — {master.name}{master.is_archived ? ' (Archived)' : ''}</option>)}</select></label>
        {selected && <div className="master-copy-preview"><span>New Project Name</span><b>{copiedProjectName(selected.name)}</b></div>}
        <div className="master-copy-rule"><b>Fresh customer-release state</b><span>The copied SLRs keep their scope content but are treated as not yet issued: SLR/RFI/RBB/Checklist release locks are cleared and their numbers are recalculated so additions and removals can resequence normally. Official Releases and Export Log history are not copied. Quote content is copied, but old official-release locks/links are cleared so the copied quote is editable.</span></div>
        {progress && <div className="master-copy-progress">{progress}</div>}
        {error && <div className="master-copy-error">{error}</div>}
        <div className="master-copy-actions"><button className="mp-button secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="mp-button" type="button" disabled={!sourceId || busy} onClick={() => void copyMaster()}>{busy ? 'Copying…' : 'Create Copy'}</button></div>
      </section>
      <style jsx global>{`
        .master-copy-backdrop{position:fixed;inset:0;z-index:7000;display:grid;place-items:center;padding:20px;background:rgba(20,24,20,.55)}
        .master-copy-modal{width:min(720px,96vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid #d4d9df;border-radius:5px;box-shadow:0 20px 60px rgba(0,0,0,.22);padding:20px;color:#20262e;font-family:Arial,Helvetica,sans-serif}
        .master-copy-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:1px solid #d4d9df;padding-bottom:11px;margin-bottom:13px}.master-copy-head span{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#59612b}.master-copy-head h2{margin:3px 0 0;font-size:22px}.master-copy-head>button{border:0;background:transparent;font-size:26px;cursor:pointer}.master-copy-modal>p{color:#596159;line-height:1.45;font-size:13px}.master-copy-modal label{display:block;font-size:11px;font-weight:800;margin-top:15px}.master-copy-modal select{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:8px 9px;border:1px solid #bfc6cf;border-radius:3px;background:#fff}.master-copy-preview{display:grid;gap:3px;padding:10px 11px;margin-top:12px;background:#f5f6f7;border:1px solid #d4d9df}.master-copy-preview span{font-size:10px;text-transform:uppercase;font-weight:800;color:#667085}.master-copy-rule{display:grid;gap:4px;padding:10px 11px;margin-top:12px;border-left:3px solid #4b6623;background:#f3f6ef}.master-copy-rule b{font-size:12px}.master-copy-rule span{font-size:12px;line-height:1.45;color:#4b5563}.master-copy-progress{margin-top:12px;padding:9px 10px;background:#f5f6f7;border:1px solid #d4d9df;font-size:12px;font-weight:700}.master-copy-error{margin-top:12px;padding:9px 10px;background:#fff1ef;border:1px solid #e0b9b4;color:#762d27;font-size:12px;line-height:1.4}.master-copy-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:17px}
      `}</style>
    </div>, document.body)}
  </>;
}
