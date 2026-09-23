'use client';

import { createClient } from './supabase/client';

type ProjectContext = {
  projectId: string;
  masterProjectId: string;
  ownerId: string;
  actualUserId: string;
};

const clean = (value: unknown) => String(value ?? '').trim();
const sequenceFromDisplay = (value: unknown) => {
  const match = clean(value).match(/(\d+)(?!.*\d)/);
  return match ? Math.max(1, Number(match[1]) || 1) : 1;
};

export async function resolveSlrProjectContext(legacyProjectId: string): Promise<ProjectContext> {
  const supabase = createClient() as any;
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data?.user) throw new Error('Your ScopeLogic session expired. Sign in again before saving.');
  const user = auth.data.user;
  const ownerId = clean(user.app_metadata?.scopelogic_workspace_owner_id || user.id);
  const actualUserId = clean(user.app_metadata?.scopelogic_actual_user_id || user.id || ownerId);

  let query = supabase.from('projects').select('id,master_project_id,legacy_id');
  if (legacyProjectId && legacyProjectId !== 'current') {
    query = /^[0-9a-f-]{36}$/i.test(legacyProjectId)
      ? query.or(`legacy_id.eq.${legacyProjectId},id.eq.${legacyProjectId}`)
      : query.eq('legacy_id', legacyProjectId);
  } else {
    throw new Error('The active ScopeLogic project could not be resolved. Reload the project before saving.');
  }
  const result = await query.limit(2);
  if (result.error) throw new Error(`Resolve project: ${result.error.message}`);
  if (!result.data?.length) throw new Error('The active ScopeLogic project does not exist in the cloud workspace.');
  const row = result.data[0];
  return { projectId: clean(row.id), masterProjectId: clean(row.master_project_id), ownerId, actualUserId };
}

export async function saveSlrDraftCloud(issue: any, legacyProjectId: string) {
  const supabase = createClient() as any;
  const context = await resolveSlrProjectContext(legacyProjectId);
  const saveToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = {
    owner_id: context.ownerId,
    project_id: context.projectId,
    legacy_uid: clean(issue.uid),
    display_number: clean(issue.id),
    draft_data: { issue, saveToken },
    saved_at: now,
    updated_at: now,
  };
  if (!payload.legacy_uid) throw new Error('This SLR does not have a stable draft identity.');
  const result = await supabase.from('slr_drafts').upsert(payload, { onConflict: 'project_id,legacy_uid' }).select('id,draft_data,saved_at,display_number').single();
  if (result.error) throw new Error(result.error.message || 'The SLR draft could not be written to cloud storage.');
  if (clean(result.data?.draft_data?.saveToken) !== saveToken) throw new Error('Cloud verification failed. ScopeLogic did not read back the draft that was just saved.');
  return { ...context, savedAt: clean(result.data.saved_at), displayNumber: clean(result.data.display_number) };
}

export async function loadSlrDraftCloud(issueUid: string, legacyProjectId: string) {
  if (!issueUid) return null;
  const supabase = createClient() as any;
  const context = await resolveSlrProjectContext(legacyProjectId);
  const result = await supabase.from('slr_drafts').select('draft_data,saved_at,display_number').eq('project_id', context.projectId).eq('legacy_uid', issueUid).maybeSingle();
  if (result.error) throw new Error(result.error.message || 'The saved SLR draft could not be loaded.');
  const issue = result.data?.draft_data?.issue;
  return issue ? { issue, savedAt: clean(result.data.saved_at), displayNumber: clean(result.data.display_number), context } : null;
}

export async function deleteSlrDraftCloud(issueUid: string, legacyProjectId: string) {
  if (!issueUid) return;
  const supabase = createClient() as any;
  const context = await resolveSlrProjectContext(legacyProjectId);
  const result = await supabase.from('slr_drafts').delete().eq('project_id', context.projectId).eq('legacy_uid', issueUid);
  if (result.error) throw new Error(result.error.message || 'The submitted SLR draft checkpoint could not be cleared.');
}

function firstRecommendation(issue: any) {
  for (const system of issue.systems || []) {
    const value = clean(issue.recommendations?.[system]);
    if (value) return value;
  }
  return clean(issue.basis);
}

function firstChecklist(issue: any) {
  for (const system of issue.systems || []) {
    const value = clean(issue.checklistItems?.[system]);
    if (value) return value;
  }
  return clean(issue.checklistItem);
}

export async function submitSlrCloud(issue: any, legacyProjectId: string) {
  const supabase = createClient() as any;
  const context = await resolveSlrProjectContext(legacyProjectId);
  const legacyUid = clean(issue.uid);
  if (!legacyUid) throw new Error('This SLR does not have a stable record identity.');

  const existing = await supabase.from('slr_entries').select('id,include_clarification').eq('project_id', context.projectId).eq('legacy_uid', legacyUid).maybeSingle();
  if (existing.error) throw new Error(existing.error.message || 'The existing SLR could not be checked before submit.');
  const clarificationWasSuppressed = Boolean(existing.data?.id) && existing.data?.include_clarification === false;
  const systems = Array.isArray(issue.systems) ? issue.systems : [];
  const recommendation = firstRecommendation(issue);
  const checklist = firstChecklist(issue);
  const payload = {
    owner_id: context.ownerId,
    project_id: context.projectId,
    legacy_uid: legacyUid,
    sequence_number: sequenceFromDisplay(issue.id),
    display_number: clean(issue.id),
    system_name: clean(systems[0] || issue.system || 'Structured Cabling'),
    custom_system: clean(issue.customSystem),
    scope_item: clean(issue.title),
    status: clean(issue.status || 'Open'),
    scope_concern: clean(issue.concern),
    rfi_question: clean(issue.rfiQuestion),
    recommended_bid_basis: recommendation,
    reason_basis: clean(issue.reason),
    reference: clean(issue.reference),
    source_type: clean(issue.sourceType),
    rfi_number: clean(issue.rfi),
    resolution: clean(issue.resolution),
    snippet_number: clean(issue.snippet),
    include_sow: Boolean(issue.sow),
    include_clarification: clarificationWasSuppressed ? false : Boolean(issue.clarification),
    include_formal_rfi: Boolean(issue.formalRfi),
    checklist_scope_item: checklist,
    contractor_response: clean(issue.response || 'Included'),
    contractor_response_reason: clean(issue.responseReason),
    systems,
    recommended_bid_basis_by_system: issue.recommendations || {},
    checklist_scope_items_by_system: issue.checklistItems || {},
    rfi_children: issue.rfis || [],
    recommend_base_bid_children: issue.recommendBaseBids || [],
    contractor_checklist_children: issue.checklistQuestions || [],
    number_locked: Boolean(issue.numberLocked),
    number_released_at: clean(issue.numberReleasedAt) || null,
    rbb_scope_letter_map: issue.rbbScopeLetterMap || {},
    updated_at: new Date().toISOString(),
  };

  const saved = await supabase.from('slr_entries').upsert(payload, { onConflict: 'project_id,legacy_uid' }).select('id,display_number,sequence_number,master_finding_id,scope_item,scope_concern,rfi_children,recommend_base_bid_children,contractor_checklist_children,updated_at').single();
  if (saved.error) throw new Error(saved.error.message || 'The SLR could not be submitted to cloud storage.');

  const verified = await supabase.from('slr_entries').select('id,display_number,sequence_number,master_finding_id,scope_item,scope_concern,rfi_children,recommend_base_bid_children,contractor_checklist_children,updated_at').eq('project_id', context.projectId).eq('legacy_uid', legacyUid).maybeSingle();
  if (verified.error || !verified.data?.id) throw new Error(verified.error?.message || 'Submit verification failed. The SLR could not be read back from the cloud.');
  if (clean(verified.data.scope_item) !== clean(issue.title) || clean(verified.data.scope_concern) !== clean(issue.concern)) throw new Error('Submit verification failed. The cloud SLR does not match the entry on this screen.');
  if (!verified.data.master_finding_id && context.masterProjectId) throw new Error('Submit verification failed. The SLR was saved but was not linked to its Master Project finding.');

  return { ...context, row: verified.data };
}
