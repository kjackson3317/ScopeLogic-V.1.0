export * from './cloud-workspace-legacy';

import { createClient } from './supabase/client';
import * as legacy from './cloud-workspace-legacy';
import type { WorkspaceSnapshot } from './cloud-workspace-legacy';

const slrUid = (projectId: string, issue: { uid?: string }, index: number) => issue.uid || `${projectId}-slr-${index + 1}`;
const slrSystem = (issue: { systems?: string[]; system?: string }) => issue.systems?.[0] || issue.system || 'Structured Cabling';

type ClarificationSuppression = { masterId: string; slrId: string };
const clarificationSuppressions = new Map<string, ClarificationSuppression>();
const clarificationSuppressionKey = (masterId: string, slrId: string) => `${masterId}::${slrId}`;

export function suppressClarificationForMasterSlr(masterId: string, slrId: string) {
  if (!masterId || !slrId) return;
  clarificationSuppressions.set(clarificationSuppressionKey(masterId, slrId), { masterId, slrId });
}

export function clearClarificationSuppressionForMasterSlr(masterId: string, slrId: string) {
  if (!masterId || !slrId) return;
  clarificationSuppressions.delete(clarificationSuppressionKey(masterId, slrId));
}

async function applyClarificationSuppressions(snapshot: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
  if (!clarificationSuppressions.size) return snapshot;

  const supabase = createClient();
  const masterIds = Array.from(new Set([...clarificationSuppressions.values()].map((item) => item.masterId)));
  const projectResult = await supabase.from('projects').select('legacy_id,master_project_id').in('master_project_id', masterIds);
  if (projectResult.error) throw new Error(`Preserve deleted GC Clarification: ${projectResult.error.message}`);

  const masterByLegacyProject = new Map<string, string>();
  for (const row of projectResult.data || []) {
    if (row.legacy_id && row.master_project_id) masterByLegacyProject.set(String(row.legacy_id), String(row.master_project_id));
  }

  let changed = false;
  const issuesByProject = { ...(snapshot.issuesByProject || {}) };

  for (const [projectId, issues] of Object.entries(snapshot.issuesByProject || {})) {
    const masterId = masterByLegacyProject.get(projectId);
    if (!masterId) continue;
    const suppressedSlrIds = new Set(
      [...clarificationSuppressions.values()]
        .filter((item) => item.masterId === masterId)
        .map((item) => item.slrId),
    );
    if (!suppressedSlrIds.size) continue;

    const nextIssues = issues.map((issue) => {
      if (!suppressedSlrIds.has(issue.id) || !issue.clarification) return issue;
      changed = true;
      return { ...issue, clarification: false };
    });
    issuesByProject[projectId] = nextIssues;
  }

  return changed ? { ...snapshot, issuesByProject } : snapshot;
}

function slrRemovalsByProject(previous: WorkspaceSnapshot, snapshot: WorkspaceSnapshot) {
  const currentProjectIds = new Set((snapshot.projects || []).map((project) => project.id));
  const removed = new Map<string, string[]>();

  for (const project of previous.projects || []) {
    if (!currentProjectIds.has(project.id)) continue;
    const before = previous.issuesByProject?.[project.id] || [];
    const after = snapshot.issuesByProject?.[project.id] || [];
    const afterUids = new Set(after.map((issue, index) => slrUid(project.id, issue, index)));
    const removedUids = before
      .map((issue, index) => slrUid(project.id, issue, index))
      .filter((uid) => !afterUids.has(uid));
    if (removedUids.length) removed.set(project.id, removedUids);
  }

  return removed;
}

type SlrIdentityRepair = {
  projectId: string;
  projectName: string;
  oldUid: string;
  newUid: string;
};

function slrIdentityRepairs(previous: WorkspaceSnapshot, snapshot: WorkspaceSnapshot): SlrIdentityRepair[] {
  const repairs: SlrIdentityRepair[] = [];

  for (const project of snapshot.projects || []) {
    const before = previous.issuesByProject?.[project.id] || [];
    const after = snapshot.issuesByProject?.[project.id] || [];
    if (!before.length || !after.length) continue;

    const beforeRows = before.map((issue, index) => ({ issue, uid: slrUid(project.id, issue, index) }));
    const beforeUids = new Set(beforeRows.map((row) => row.uid));
    const afterUids = new Set(after.map((issue, index) => slrUid(project.id, issue, index)));
    const claimedOldUids = new Set<string>();

    after.forEach((issue, index) => {
      const newUid = slrUid(project.id, issue, index);
      if (beforeUids.has(newUid)) return;

      // A browser recovery/copy can occasionally preserve the logical SLR while
      // regenerating its internal UID. Match only when the visible identity is
      // exact and the old UID is no longer present in the browser snapshot. This
      // preserves the linked Master Finding instead of attempting a duplicate insert.
      const candidates = beforeRows.filter((row) =>
        !afterUids.has(row.uid)
        && !claimedOldUids.has(row.uid)
        && row.issue.id === issue.id
        && row.issue.title === issue.title
        && slrSystem(row.issue) === slrSystem(issue)
      );

      if (candidates.length !== 1) return;
      claimedOldUids.add(candidates[0].uid);
      repairs.push({
        projectId: project.id,
        projectName: project.name || project.id,
        oldUid: candidates[0].uid,
        newUid,
      });
    });
  }

  return repairs;
}

async function reconcileSlrIdentityDrift(previous: WorkspaceSnapshot, snapshot: WorkspaceSnapshot): Promise<void> {
  const repairs = slrIdentityRepairs(previous, snapshot);
  if (!repairs.length) return;

  const supabase = createClient();
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) throw new Error('Your ScopeLogic session expired. Sign in again.');

  const repairsByProject = new Map<string, SlrIdentityRepair[]>();
  for (const repair of repairs) repairsByProject.set(repair.projectId, [...(repairsByProject.get(repair.projectId) || []), repair]);

  for (const [projectId, projectRepairs] of repairsByProject) {
    const projectResult = await supabase.from('projects').select('id').eq('legacy_id', projectId).maybeSingle();
    if (projectResult.error) throw new Error(`Reconcile SLR identity: ${projectResult.error.message}`);
    if (!projectResult.data?.id) throw new Error(`Reconcile SLR identity: cloud project ${projectRepairs[0].projectName} could not be resolved.`);

    for (const repair of projectRepairs) {
      const existing = await supabase
        .from('slr_entries')
        .select('id,legacy_uid')
        .eq('project_id', projectResult.data.id)
        .eq('legacy_uid', repair.oldUid)
        .maybeSingle();
      if (existing.error) throw new Error(`Reconcile SLR identity: ${existing.error.message}`);

      // A queued save may already have completed the repair. Treat that as success.
      if (!existing.data?.id) {
        const alreadyRepaired = await supabase
          .from('slr_entries')
          .select('id')
          .eq('project_id', projectResult.data.id)
          .eq('legacy_uid', repair.newUid)
          .maybeSingle();
        if (alreadyRepaired.error) throw new Error(`Reconcile SLR identity: ${alreadyRepaired.error.message}`);
        if (alreadyRepaired.data?.id) continue;
        throw new Error(`Reconcile SLR identity failed for ${projectRepairs[0].projectName}. Reload ScopeLogic before retrying.`);
      }

      const updated = await supabase
        .from('slr_entries')
        .update({ legacy_uid: repair.newUid })
        .eq('id', existing.data.id)
        .eq('project_id', projectResult.data.id)
        .select('id');
      if (updated.error) throw new Error(`Reconcile SLR identity: ${updated.error.message}`);
      if (!updated.data?.length) throw new Error(`Reconcile SLR identity failed for ${projectRepairs[0].projectName}. Reload ScopeLogic before retrying.`);
    }
  }
}

async function saveWithSlrProtection(snapshot: WorkspaceSnapshot): Promise<void> {
  const protectedSnapshot = await applyClarificationSuppressions(snapshot);
  const current = await legacy.loadWorkspaceFromCloud();
  const previous = current.snapshot;

  if (previous) {
    const removedByProject = slrRemovalsByProject(previous, protectedSnapshot);

    // Intentional cleanup inside one project is valid, including copied projects
    // where users commonly remove several inherited SLRs at once. The old guard
    // blocked any save that removed more than one SLR, which left those copied
    // SLRs in cloud storage and made them reappear after reload.
    //
    // Keep a broad stale-tab safety check: a single browser save should never
    // remove SLRs from multiple projects at once. That pattern is much more
    // consistent with an outdated whole-workspace snapshot than normal editing.
    if (removedByProject.size > 1) {
      const removedCount = [...removedByProject.values()].reduce((sum, items) => sum + items.length, 0);
      throw new Error(`Cloud save blocked because this browser copy would remove ${removedCount} SLRs across ${removedByProject.size} projects at once. Reload ScopeLogic to use the current cloud workspace before saving.`);
    }

    await reconcileSlrIdentityDrift(previous, protectedSnapshot);
  }

  await legacy.saveWorkspaceToCloud(protectedSnapshot);

  // Confirm the normalized SLR rows that the next refresh will read back. A
  // browser can report a successful request while a stale tab or a partial
  // state update has written the previous workspace. Surface that condition
  // now so the UI keeps the browser copy available for recovery.
  const confirmed = await legacy.loadWorkspaceFromCloud();
  if (!confirmed.snapshot) throw new Error('Cloud save completed but the workspace could not be reloaded for verification.');
  for (const project of protectedSnapshot.projects || []) {
    const expected = new Set((protectedSnapshot.issuesByProject?.[project.id] || []).map((issue, index) => slrUid(project.id, issue, index)));
    const actual = new Set((confirmed.snapshot.issuesByProject?.[project.id] || []).map((issue, index) => slrUid(project.id, issue, index)));
    if (expected.size !== actual.size || [...expected].some((uid) => !actual.has(uid))) {
      throw new Error(`Cloud save verification failed for project ${project.name || project.id}. The saved SLR list did not match the changes on this screen; no refresh should be trusted until the cloud workspace is reloaded.`);
    }
  }
}

let guardedSaveQueue: Promise<void> = Promise.resolve();

export function saveWorkspaceToCloud(snapshot: WorkspaceSnapshot): Promise<void> {
  guardedSaveQueue = guardedSaveQueue.catch(() => undefined).then(() => saveWithSlrProtection(snapshot));
  return guardedSaveQueue;
}
