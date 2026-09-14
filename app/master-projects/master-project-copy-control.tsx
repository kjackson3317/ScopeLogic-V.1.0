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
} from '../../lib/cloud-workspace';
import { normalizeLegacyChildren, normalizeProjectIssueNumbers, syncLegacyFields } from '../slr-model';

type Props = { actualUserId: string; workspaceOwnerId: string };
type Row = Record<string, any>;
type MasterOption = { id: string; project_number: string; name: string; is_archived: boolean };

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const copyName = (name: string) => `copy - ${String(name || '').replace(/^copy\s*-\s*/i, '')}`;

function cloneQuotes(sourceQuotes: Row[]) {
  const quoteIds = new Map<string, string>();
  sourceQuotes.forEach((quote) => quoteIds.set(String(quote.id || ''), crypto.randomUUID()));

  return sourceQuotes.map((source) => {
    const quote = copy(source);
    const groupIds = new Map<string, string>();
    const breakoutIds = new Map<string, string>();
    const alternateIds = new Map<string, string>();

    quote.id = quoteIds.get(String(source.id || '')) || crypto.randomUUID();
    quote.parentQuoteId = source.parentQuoteId ? quoteIds.get(String(source.parentQuoteId)) || undefined : undefined;
    quote.locked = false;
    quote.lockedAt = undefined;
    quote.generatedReleaseId = undefined;
    quote.createdAt = now();
    quote.updatedAt = now();

    quote.groups = (source.groups || []).map((group: Row) => {
      const id = crypto.randomUUID();
      groupIds.set(String(group.id || ''), id);
      return { ...copy(group), id };
    });
    quote.breakouts = (source.breakouts || []).map((item: Row) => {
      const id = crypto.randomUUID();
      breakoutIds.set(String(item.id || ''), id);
      return { ...copy(item), id };
    });
    quote.alternates = (source.alternates || []).map((item: Row) => {
      const id = crypto.randomUUID();
      alternateIds.set(String(item.id || ''), id);
      return { ...copy(item), id };
    });
    quote.lines = (source.lines || []).map((line: Row) => ({
      ...copy(line),
      id: crypto.randomUUID(),
      groupId: line.groupId ? groupIds.get(String(line.groupId)) || '' : '',
      breakoutId: line.breakoutId ? breakoutIds.get(String(line.breakoutId)) || '' : '',
      breakoutAllocations: Object.fromEntries(
        Object.entries(line.breakoutAllocations || {})
          .map(([id, qty]) => [breakoutIds.get(id) || '', qty])
          .filter(([id]) => Boolean(id)),
      ),
      alternateId: line.alternateId ? alternateIds.get(String(line.alternateId)) || '' : '',
    }));
    return quote;
  });
}

function synthesizeIssue(finding: Row) {
  const systems = Array.isArray(finding.systems) && finding.systems.length ? finding.systems : ['Structured Cabling'];
  return {
    uid: String(finding.legacy_uid || crypto.randomUUID()), id: String(finding.display_number || ''),
    system: systems[0] || 'Structured Cabling', customSystem: String(finding.custom_system || ''), systems,
    recommendations: finding.recommended_bid_basis_by_system || {}, title: String(finding.scope_item || ''),
    status: String(finding.status || 'Open'), concern: String(finding.scope_concern || ''),
    rfiQuestion: String(finding.rfi_question || ''), basis: String(finding.recommended_bid_basis || ''),
    reason: String(finding.reason_basis || ''), reference: String(finding.reference || ''),
    sourceType: String(finding.source_type || ''), rfi: String(finding.rfi_number || ''),
    resolution: String(finding.resolution || ''), snippet: String(finding.snippet_number || ''),
    sow: finding.include_sow !== false, clarification: finding.include_clarification !== false,
    formalRfi: Boolean(finding.include_formal_rfi), checklist: Boolean(String(finding.checklist_scope_item || '').trim()),
    checklistItem: String(finding.checklist_scope_item || ''), checklistItems: finding.checklist_scope_items_by_system || {},
    response: String(finding.contractor_response || ''), responseReason: String(finding.contractor_response_reason || ''),
    numberLocked: false, numberReleasedAt: '', rbbScopeLetterMap: {}, rfis: [], recommendBaseBids: [], checklistQuestions: [],
  };
}

function freshSlrs(sourceIssues: Row[]) {
  const oldChildNumber = new Map<string, { kind: string; uid: string; system?: string }>();
  const oldRelated = new Map<string, string[]>();
  const oldVerifies = new Map<string, string[]>();
  const oldSupersedes = new Map<string, string>();
  const oldIssueUidToNew = new Map<string, string>();
  const oldIssueIdToIndex = new Map<string, number>();

  const reset = sourceIssues.map((raw, issueIndex) => {
    const original = normalizeLegacyChildren(copy(raw) as any) as Row;
    const oldIssueUid = String(original.uid || '');
    const oldIssueId = String(original.id || '');
    const newIssueUid = crypto.randomUUID();
    if (oldIssueUid) oldIssueUidToNew.set(oldIssueUid, newIssueUid);
    if (oldIssueId) oldIssueIdToIndex.set(oldIssueId, issueIndex);
    original.uid = newIssueUid;
    original.numberLocked = false;
    original.numberReleasedAt = '';
    original.rbbScopeLetterMap = {};

    const rfiUidMap = new Map<string, string>();
    original.rfis = (original.rfis || []).map((rfi: Row) => {
      const newUid = crypto.randomUUID();
      if (rfi.uid) rfiUidMap.set(String(rfi.uid), newUid);
      if (rfi.number) oldChildNumber.set(String(rfi.number), { kind: 'rfi', uid: newUid });
      oldRelated.set(newUid, Array.isArray(rfi.relatedChildNumbers) ? [...rfi.relatedChildNumbers] : []);
      return { ...rfi, uid: newUid, number: '', status: 'Draft', locked: false, releasedAt: '', relatedChildNumbers: [] };
    });

    original.recommendBaseBids = (original.recommendBaseBids || []).map((rbb: Row) => {
      const newRbbUid = crypto.randomUUID();
      const sections: Record<string, Row> = {};
      for (const system of rbb.selectedSystems || []) {
        const section = rbb.sections?.[system] || {};
        const newSectionUid = crypto.randomUUID();
        if (section.displayNumber) oldChildNumber.set(String(section.displayNumber), { kind: 'rbb', uid: newRbbUid, system });
        oldSupersedes.set(newSectionUid, String(section.supersedesNumber || ''));
        sections[system] = {
          ...section,
          uid: newSectionUid,
          suffix: '', displayNumber: '', locked: false, contentReleased: false, releasedAt: '', supersedesNumber: '',
          basedOnRfiUids: (section.basedOnRfiUids || []).map((oldUid: string) => rfiUidMap.get(String(oldUid)) || '').filter(Boolean),
        };
      }
      return { ...rbb, uid: newRbbUid, baseSequence: 0, baseNumber: '', forceSuffix: false, sections };
    });

    original.checklistQuestions = (original.checklistQuestions || []).map((item: Row) => {
      const newUid = crypto.randomUUID();
      if (item.number) oldChildNumber.set(String(item.number), { kind: 'checklist', uid: newUid });
      oldVerifies.set(newUid, Array.isArray(item.verifiesRbbNumbers) ? [...item.verifiesRbbNumbers] : []);
      return { ...item, uid: newUid, number: '', locked: false, releasedAt: '', verifiesRbbNumbers: [] };
    });

    return syncLegacyFields(original as any) as Row;
  });

  const issues = normalizeProjectIssueNumbers(reset as any[]) as Row[];
  const identityToNumber = new Map<string, string>();
  issues.forEach((issue) => {
    (issue.rfis || []).forEach((rfi: Row) => identityToNumber.set(`rfi:${rfi.uid}`, String(rfi.number || '')));
    (issue.recommendBaseBids || []).forEach((rbb: Row) => (rbb.selectedSystems || []).forEach((system: string) => {
      const section = rbb.sections?.[system];
      if (section) identityToNumber.set(`rbb:${rbb.uid}:${system}`, String(section.displayNumber || ''));
    }));
    (issue.checklistQuestions || []).forEach((item: Row) => identityToNumber.set(`checklist:${item.uid}`, String(item.number || '')));
  });
  const remapNumber = (old: string) => {
    const identity = oldChildNumber.get(String(old || ''));
    if (!identity) return '';
    const key = identity.kind === 'rbb' ? `rbb:${identity.uid}:${identity.system || ''}` : `${identity.kind}:${identity.uid}`;
    return identityToNumber.get(key) || '';
  };
  issues.forEach((issue) => {
    (issue.rfis || []).forEach((rfi: Row) => { rfi.relatedChildNumbers = (oldRelated.get(rfi.uid) || []).map(remapNumber).filter(Boolean); });
    (issue.recommendBaseBids || []).forEach((rbb: Row) => (rbb.selectedSystems || []).forEach((system: string) => {
      const section = rbb.sections?.[system];
      if (section) section.supersedesNumber = remapNumber(oldSupersedes.get(section.uid) || '');
    }));
    (issue.checklistQuestions || []).forEach((item: Row) => { item.verifiesRbbNumbers = (oldVerifies.get(item.uid) || []).map(remapNumber).filter(Boolean); });
    syncLegacyFields(issue as any);
  });

  const issueIdMap = new Map<string, string>();
  oldIssueIdToIndex.forEach((index, oldId) => { if (issues[index]) issueIdMap.set(oldId, String(issues[index].id || '')); });
  return { issues, issueUidMap: oldIssueUidToNew, issueIdMap };
}

export default function MasterProjectCopyControl({ actualUserId, workspaceOwnerId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [host, setHost] = useState<Element | null>(null);
  const [masters, setMasters] = useState<MasterOption[]>([]);
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setHost(document.querySelector('.mp-topbar .mp-actions'));
    void supabase.from('master_projects').select('id,project_number,name,is_archived').order('project_number').then(({ data }) => setMasters((data || []) as MasterOption[]));
  }, [supabase]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy]);

  const selected = masters.find((item) => item.id === sourceId) || null;

  const performCopy = async () => {
    if (!selected || busy) return;
    setBusy(true); setError(''); setProgress('Reading source project…');
    const uploadedPaths: string[] = [];
    let newMasterId = '';

    try {
      const loaded = await loadWorkspaceFromCloud();
      if (!loaded.snapshot) throw new Error('The cloud workspace could not be loaded. No copy was created.');
      const original: any = loaded.snapshot;
      await createWorkspaceBackup(original, `Before copying Master Project ${selected.project_number}`, 'manual');

      const projectIdsResult = await supabase.from('projects').select('id').eq('master_project_id', selected.id);
      if (projectIdsResult.error) throw new Error(projectIdsResult.error.message);
      const sourceDbProjectIds = (projectIdsResult.data || []).map((row: Row) => row.id);
      const slrQuery = sourceDbProjectIds.length
        ? supabase.from('slr_entries').select('id,project_id,legacy_uid,master_finding_id').in('project_id', sourceDbProjectIds)
        : Promise.resolve({ data: [], error: null } as any);

      const [masterR, projectsR, findingsR, slrR, assignmentsR, notesR, docsR, eventsR] = await Promise.all([
        supabase.from('master_projects').select('*').eq('id', selected.id).single(),
        supabase.from('projects').select('*').eq('master_project_id', selected.id).order('created_at'),
        supabase.from('master_project_findings').select('*').eq('master_project_id', selected.id).order('sequence_number'),
        slrQuery,
        supabase.from('master_project_assignments').select('user_id').eq('master_project_id', selected.id),
        supabase.from('master_project_internal_notes').select('notes').eq('master_project_id', selected.id).maybeSingle(),
        supabase.from('master_project_documents').select('*').eq('master_project_id', selected.id).order('created_at'),
        supabase.from('master_project_calendar_events').select('*').eq('master_project_id', selected.id).order('event_date'),
      ]);
      const readError = masterR.error || projectsR.error || findingsR.error || slrR.error || assignmentsR.error || notesR.error || docsR.error || eventsR.error;
      if (readError) throw new Error(readError.message);

      const sourceMaster: Row = masterR.data;
      const sourceProjects: Row[] = projectsR.data || [];
      const sourceFindings: Row[] = findingsR.data || [];
      const sourceLinks: Row[] = slrR.data || [];
      const masterDocs: Row[] = docsR.data || [];
      const masterEvents: Row[] = eventsR.data || [];
      const name = copyName(sourceMaster.name);
      const newMasterLegacyId = uid('master');
      const snapshotProject = new Map<string, any>(original.projects.map((project: any) => [String(project.id), project]));
      sourceProjects.forEach((project) => {
        if (!project.legacy_id || !snapshotProject.has(String(project.legacy_id))) throw new Error(`Client Engagement ${project.client_name || project.id} is missing from the loaded cloud workspace. Reload ScopeLogic before copying.`);
      });

      setProgress('Copying project document files…');
      const fileSources = new Map<string, { name: string; type: string }>();
      masterDocs.forEach((doc) => { if (doc.storage_path) fileSources.set(String(doc.storage_path), { name: String(doc.original_filename || doc.display_name || 'document'), type: String(doc.mime_type || 'application/octet-stream') }); });
      sourceProjects.forEach((project) => (original.docsByProject[String(project.legacy_id)] || []).forEach((doc: Row) => {
        if (doc.storagePath) fileSources.set(String(doc.storagePath), { name: String(doc.fileName || doc.name || 'document'), type: String(doc.fileType || 'application/octet-stream') });
      }));
      const pathMap = new Map<string, string>();
      for (const [sourcePath, meta] of fileSources) {
        const signed = await createProjectFileUrl(sourcePath);
        const response = await fetch(signed);
        if (!response.ok) throw new Error(`Could not read ${meta.name} while copying project documents.`);
        const targetPath = await uploadProjectFile(newMasterLegacyId, uid('doc'), await response.blob(), meta.name, meta.type);
        pathMap.set(sourcePath, targetPath); uploadedPaths.push(targetPath);
      }

      setProgress('Creating copied Master Project…');
      const masterInsert = await supabase.from('master_projects').insert({
        owner_id: workspaceOwnerId, created_by_user_id: actualUserId, legacy_id: newMasterLegacyId,
        name, location: sourceMaster.location || '', status: sourceMaster.status || 'Planning',
        version_date: sourceMaster.version_date || null, revision: sourceMaster.revision || 'Rev 0',
        systems: sourceMaster.systems || [], notes: sourceMaster.notes || '', is_archived: false, archived_at: null,
      }).select('id,project_number').single();
      if (masterInsert.error || !masterInsert.data) throw new Error(masterInsert.error?.message || 'The copied Master Project could not be created.');
      newMasterId = String(masterInsert.data.id);

      const targetBySource = new Map<string, { id: string; legacyId: string }>();
      for (const source of sourceProjects) {
        const legacyId = uid('eng');
        const result = await supabase.from('projects').insert({
          owner_id: workspaceOwnerId, assigned_user_id: source.assigned_user_id || actualUserId,
          legacy_id: legacyId, master_project_id: newMasterId, name, client_name: source.client_name || '',
          customer_id: source.customer_id || null, version_date: source.version_date || null,
          status: source.status || 'Planning', revision: source.revision || 'Rev 0', modified_label: 'Now',
          engagement_label: source.engagement_label || 'Client Engagement', engagement_type: source.engagement_type || 'Product 1',
          is_quick_review: Boolean(source.is_quick_review),
        }).select('id').single();
        if (result.error || !result.data) throw new Error(result.error?.message || `Could not copy ${source.client_name || 'a Client Engagement'}.`);
        targetBySource.set(String(source.legacy_id), { id: String(result.data.id), legacyId });
      }

      setProgress('Resetting copied SLR customer-release state…');
      const sourceIssueByUid = new Map<string, Row>();
      sourceProjects.forEach((project) => (original.issuesByProject[String(project.legacy_id)] || []).forEach((issue: Row) => sourceIssueByUid.set(String(issue.uid || ''), issue)));
      const findingToUid = new Map<string, string>();
      sourceLinks.forEach((link) => { if (link.master_finding_id && link.legacy_uid && !findingToUid.has(String(link.master_finding_id))) findingToUid.set(String(link.master_finding_id), String(link.legacy_uid)); });
      const usedUids = new Set<string>();
      const canonical: Row[] = sourceFindings.map((finding) => {
        const sourceUid = findingToUid.get(String(finding.id)) || '';
        if (sourceUid) usedUids.add(sourceUid);
        return copy(sourceIssueByUid.get(sourceUid) || synthesizeIssue(finding));
      });
      sourceIssueByUid.forEach((issue, sourceUid) => { if (sourceUid && !usedUids.has(sourceUid)) canonical.push(copy(issue)); });
      const fresh = freshSlrs(canonical);

      const next: any = copy(original);
      let firstTargetLegacy = '';
      const sourceToTargetLegacy = new Map<string, string>();
      const newProjectToolIds = new Map<string, string>();

      for (const source of sourceProjects) {
        const sourceLegacy = String(source.legacy_id);
        const target = targetBySource.get(sourceLegacy)!;
        if (!firstTargetLegacy) firstTargetLegacy = target.legacyId;
        sourceToTargetLegacy.set(sourceLegacy, target.legacyId);
        const sourceProject = snapshotProject.get(sourceLegacy);
        next.projects.push({ ...copy(sourceProject), id: target.legacyId, createdAt: now(), name, modified: 'Now' });
        next.issuesByProject[target.legacyId] = copy(fresh.issues);
        next.notesByProject[target.legacyId] = String(original.notesByProject[sourceLegacy] || '');
        next.exportsByProject[target.legacyId] = [];
        next.quotesByProject[target.legacyId] = cloneQuotes(original.quotesByProject[sourceLegacy] || []);
        next.takeoffEntriesByProject[target.legacyId] = copy(original.takeoffEntriesByProject[sourceLegacy] || []);
        next.takeoffSettingsByProject[target.legacyId] = copy(original.takeoffSettingsByProject[sourceLegacy] || { selectedSystems: [], activeRuleIds: [], averageCableLength: 250 });
        next.drawingMeasurementsByProject[target.legacyId] = copy(original.drawingMeasurementsByProject[sourceLegacy] || []);
        next.drawingCalibrationsByProject[target.legacyId] = copy(original.drawingCalibrationsByProject[sourceLegacy] || {});
        next.scopeOfWorkByProject[target.legacyId] = copy(original.scopeOfWorkByProject[sourceLegacy] || { includedHtml: '', excludedHtml: '' });

        const toolMap = new Map<string, string>();
        (original.drawingTakeoffTools || []).filter((tool: Row) => tool.scope === 'project' && tool.projectId === sourceLegacy).forEach((tool: Row) => {
          const newId = crypto.randomUUID(); toolMap.set(String(tool.id), newId); newProjectToolIds.set(`${sourceLegacy}:${tool.id}`, newId);
          next.drawingTakeoffTools.push({ ...copy(tool), id: newId, projectId: target.legacyId });
        });
        next.drawingTakeoffMarksByProject[target.legacyId] = (original.drawingTakeoffMarksByProject[sourceLegacy] || []).map((mark: Row) => ({ ...copy(mark), id: crypto.randomUUID(), toolId: toolMap.get(String(mark.toolId)) || mark.toolId }));
        next.drawingAnnotationsByProject[target.legacyId] = (original.drawingAnnotationsByProject[sourceLegacy] || []).map((annotation: Row) => ({
          ...copy(annotation), id: crypto.randomUUID(),
          issueUid: annotation.issueUid ? fresh.issueUidMap.get(String(annotation.issueUid)) || annotation.issueUid : annotation.issueUid,
          issueId: annotation.issueId ? fresh.issueIdMap.get(String(annotation.issueId)) || annotation.issueId : annotation.issueId,
        }));
      }
      if (firstTargetLegacy) next.projectId = firstTargetLegacy;

      // Project documents are shared at Master Project level. Seed them once; the database trigger propagates them to sibling Client Engagements.
      sourceProjects.forEach((source, index) => {
        const target = targetBySource.get(String(source.legacy_id));
        if (!target) return;
        next.docsByProject[target.legacyId] = index === 0
          ? (original.docsByProject[String(source.legacy_id)] || []).map((doc: Row) => ({ ...copy(doc), storagePath: doc.storagePath ? pathMap.get(String(doc.storagePath)) || undefined : undefined }))
          : [];
      });

      // Seed one project calendar row per shared Master event; triggers propagate to sibling Client Engagements.
      const sourceEventByLegacy = new Map<string, Row>();
      for (const entry of original.calendarEntries || []) if (sourceToTargetLegacy.has(String(entry.projectId)) && !sourceEventByLegacy.has(`${entry.date}|${entry.title}|${entry.type}`)) sourceEventByLegacy.set(`${entry.date}|${entry.title}|${entry.type}`, entry);
      for (const entry of sourceEventByLegacy.values()) if (firstTargetLegacy) next.calendarEntries.push({ ...copy(entry), id: crypto.randomUUID(), projectId: firstTargetLegacy });

      setProgress('Copying Master Project baseline data…');
      if (notesR.data?.notes) {
        const result = await supabase.from('master_project_internal_notes').upsert({ master_project_id: newMasterId, owner_id: workspaceOwnerId, notes: notesR.data.notes, updated_at: now() });
        if (result.error) throw new Error(result.error.message);
      }
      const assignments = (assignmentsR.data || []).map((item: Row) => ({ master_project_id: newMasterId, user_id: item.user_id, assigned_by_user_id: actualUserId }));
      if (assignments.length) {
        const result = await supabase.from('master_project_assignments').upsert(assignments, { onConflict: 'master_project_id,user_id' });
        if (result.error) throw new Error(result.error.message);
      }
      for (const doc of masterDocs.filter((item) => !item.source_project_document_id)) {
        const result = await supabase.from('master_project_documents').insert({
          owner_id: workspaceOwnerId, master_project_id: newMasterId, legacy_id: uid('master-doc'),
          document_type: doc.document_type, display_name: doc.display_name, revision: doc.revision,
          issue_date: doc.issue_date, is_current: doc.is_current, notes: doc.notes,
          original_filename: doc.original_filename, mime_type: doc.mime_type, size_bytes: doc.size_bytes,
          storage_path: doc.storage_path ? pathMap.get(String(doc.storage_path)) || null : null, source_project_document_id: null,
        });
        if (result.error) throw new Error(result.error.message);
      }
      for (const event of masterEvents.filter((item) => !item.source_calendar_event_id)) {
        const result = await supabase.from('master_project_calendar_events').insert({
          owner_id: workspaceOwnerId, master_project_id: newMasterId, source_calendar_event_id: null,
          legacy_id: uid('master-event'), event_date: event.event_date, title: event.title, event_type: event.event_type,
        });
        if (result.error) throw new Error(result.error.message);
      }
      if (!sourceProjects.length && sourceFindings.length) {
        const rows = sourceFindings.map((finding, index) => ({
          owner_id: workspaceOwnerId, master_project_id: newMasterId, legacy_uid: crypto.randomUUID(),
          sequence_number: index + 1, display_number: `SLR-${String(index + 1).padStart(3, '0')}`,
          systems: finding.systems || [], custom_system: finding.custom_system || '', scope_item: finding.scope_item,
          status: finding.status || 'Open', scope_concern: finding.scope_concern || '', recommended_bid_basis: finding.recommended_bid_basis || '',
          recommended_bid_basis_by_system: finding.recommended_bid_basis_by_system || {}, rfi_question: finding.rfi_question || '',
          reason_basis: finding.reason_basis || '', reference: finding.reference || '', source_type: finding.source_type || '',
          rfi_number: '', resolution: finding.resolution || '', snippet_number: finding.snippet_number || '',
          include_sow: finding.include_sow !== false, include_clarification: finding.include_clarification !== false,
          include_formal_rfi: Boolean(finding.include_formal_rfi), checklist_scope_item: finding.checklist_scope_item || '',
          checklist_scope_items_by_system: finding.checklist_scope_items_by_system || {}, contractor_response: finding.contractor_response || 'Included',
          contractor_response_reason: finding.contractor_response_reason || '', ai_assistance: finding.ai_assistance || {}, source_slr_entry_id: null,
        }));
        const result = await supabase.from('master_project_findings').insert(rows);
        if (result.error) throw new Error(result.error.message);
      }

      setProgress('Saving copied working project data…');
      await saveWorkspaceToCloud(next);
      setProgress('Copy complete. Opening the new Master Project…');
      window.location.href = `/master-projects/${newMasterId}`;
    } catch (cause) {
      let message = cause instanceof Error ? cause.message : 'The Master Project copy could not be completed.';
      if (newMasterId) {
        const cleanup = await supabase.from('master_projects').delete().eq('id', newMasterId);
        if (cleanup.error) message += ` Cleanup could not remove the partial copy: ${cleanup.error.message}`;
      }
      for (const path of uploadedPaths) { try { await removeProjectFile(path); } catch { /* best effort */ } }
      setError(message); setProgress(''); setBusy(false);
    }
  };

  if (!host) return null;
  return <>
    {createPortal(<button className="mp-button secondary" type="button" onClick={() => { setOpen(true); setError(''); setProgress(''); }}>Copy Master Project</button>, host)}
    {open && createPortal(<div className="master-copy-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className="master-copy-modal" role="dialog" aria-modal="true" aria-labelledby="master-copy-title">
        <div className="master-copy-head"><div><span>Reuse a prior project baseline</span><h2 id="master-copy-title">Copy Master Project</h2></div><button type="button" disabled={busy} onClick={() => setOpen(false)}>×</button></div>
        <p>Copy a prior Master Project when the A/E reuses drawings, specifications, and project standards. Working project content is duplicated into a new independent project.</p>
        <label>Source Master Project<select value={sourceId} disabled={busy} onChange={(event) => setSourceId(event.target.value)}><option value="">Select a Master Project…</option>{masters.map((master) => <option key={master.id} value={master.id}>{master.project_number} — {master.name}{master.is_archived ? ' (Archived)' : ''}</option>)}</select></label>
        {selected && <div className="master-copy-preview"><span>New Project Name</span><b>{copyName(selected.name)}</b></div>}
        <div className="master-copy-rule"><b>Fresh customer-release state</b><span>SLR, RFI, RBB, and Checklist content is copied, but customer-release locks are cleared and numbering is recalculated. You can add or remove SLRs and the unlocked numbering will adjust normally. Official Releases and Export Log history stay with the original project. Quote content is copied, while old official-release locks are cleared so copied quotes remain editable.</span></div>
        {progress && <div className="master-copy-progress">{progress}</div>}
        {error && <div className="master-copy-error">{error}</div>}
        <div className="master-copy-actions"><button className="mp-button secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="mp-button" type="button" disabled={!selected || busy} onClick={() => void performCopy()}>{busy ? 'Copying…' : 'Create Copy'}</button></div>
      </section>
      <style jsx global>{`
        .master-copy-backdrop{position:fixed;inset:0;z-index:7000;display:grid;place-items:center;padding:20px;background:rgba(20,24,20,.55)}
        .master-copy-modal{width:min(720px,96vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid #d4d9df;border-radius:5px;box-shadow:0 20px 60px rgba(0,0,0,.22);padding:20px;color:#20262e;font-family:Arial,Helvetica,sans-serif}
        .master-copy-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:1px solid #d4d9df;padding-bottom:11px;margin-bottom:13px}.master-copy-head span{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#59612b}.master-copy-head h2{margin:3px 0 0;font-size:22px}.master-copy-head>button{border:0;background:transparent;font-size:26px;cursor:pointer}.master-copy-modal>p{color:#596159;line-height:1.45;font-size:13px}.master-copy-modal label{display:block;font-size:11px;font-weight:800;margin-top:15px}.master-copy-modal select{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:8px 9px;border:1px solid #bfc6cf;border-radius:3px;background:#fff}.master-copy-preview{display:grid;gap:3px;padding:10px 11px;margin-top:12px;background:#f5f6f7;border:1px solid #d4d9df}.master-copy-preview span{font-size:10px;text-transform:uppercase;font-weight:800;color:#667085}.master-copy-rule{display:grid;gap:4px;padding:10px 11px;margin-top:12px;border-left:3px solid #4b6623;background:#f3f6ef}.master-copy-rule b{font-size:12px}.master-copy-rule span{font-size:12px;line-height:1.45;color:#4b5563}.master-copy-progress{margin-top:12px;padding:9px 10px;background:#f5f6f7;border:1px solid #d4d9df;font-size:12px;font-weight:700}.master-copy-error{margin-top:12px;padding:9px 10px;background:#fff1ef;border:1px solid #e0b9b4;color:#762d27;font-size:12px;line-height:1.4}.master-copy-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:17px}
      `}</style>
    </div>, document.body)}
  </>;
}
