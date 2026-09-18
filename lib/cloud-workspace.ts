export * from './cloud-workspace-legacy';

import * as legacy from './cloud-workspace-legacy';
import type { WorkspaceSnapshot } from './cloud-workspace-legacy';

const slrUid = (projectId: string, issue: { uid?: string }, index: number) => issue.uid || `${projectId}-slr-${index + 1}`;

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

async function saveWithSlrProtection(snapshot: WorkspaceSnapshot): Promise<void> {
  const current = await legacy.loadWorkspaceFromCloud();
  const previous = current.snapshot;

  if (previous) {
    const removedByProject = slrRemovalsByProject(previous, snapshot);

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
  }

  await legacy.saveWorkspaceToCloud(snapshot);

  // Confirm the normalized SLR rows that the next refresh will read back. A
  // browser can report a successful request while a stale tab or a partial
  // state update has written the previous workspace. Surface that condition
  // now so the UI keeps the browser copy available for recovery.
  const confirmed = await legacy.loadWorkspaceFromCloud();
  if (!confirmed.snapshot) throw new Error('Cloud save completed but the workspace could not be reloaded for verification.');
  for (const project of snapshot.projects || []) {
    const expected = new Set((snapshot.issuesByProject?.[project.id] || []).map((issue, index) => slrUid(project.id, issue, index)));
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
