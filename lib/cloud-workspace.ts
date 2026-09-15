export * from './cloud-workspace-legacy';

import * as legacy from './cloud-workspace-legacy';
import type { WorkspaceSnapshot } from './cloud-workspace-legacy';
import { normalizeProjectIssueNumbers } from '../app/slr-model';

const slrUid = (projectId: string, issue: { uid?: string }, index: number) => issue.uid || `${projectId}-slr-${index + 1}`;
type WorkspaceIssue = WorkspaceSnapshot['issuesByProject'][string][number];

function mergeProjectIssues(projectId: string, cloudIssues: WorkspaceIssue[], browserIssues: WorkspaceIssue[]) {
  const browserByUid = new Map(browserIssues.map((issue, index) => [slrUid(projectId, issue, index), issue]));
  const cloudUids = new Set(cloudIssues.map((issue, index) => slrUid(projectId, issue, index)));
  const consumedBrowserUids = new Set<string>();

  const merged: WorkspaceIssue[] = cloudIssues.map((cloudIssue, index) => {
    const uid = slrUid(projectId, cloudIssue, index);
    const browserIssue = browserByUid.get(uid);
    if (browserIssue) {
      consumedBrowserUids.add(uid);
      return browserIssue;
    }
    return cloudIssue;
  });

  browserIssues.forEach((browserIssue, index) => {
    const uid = slrUid(projectId, browserIssue, index);
    if (!cloudUids.has(uid) && !consumedBrowserUids.has(uid)) merged.push(browserIssue);
  });

  return normalizeProjectIssueNumbers(merged) as WorkspaceIssue[];
}

async function saveWithSlrProtection(snapshot: WorkspaceSnapshot): Promise<void> {
  const current = await legacy.loadWorkspaceFromCloud();
  const previous = current.snapshot;
  let saveSnapshot = snapshot;

  if (previous) {
    const currentProjectIds = new Set((snapshot.projects || []).map((project) => project.id));
    const mergedIssuesByProject = { ...(snapshot.issuesByProject || {}) };
    let recoveredCloudOnlySlrs = 0;

    for (const project of previous.projects || []) {
      if (!currentProjectIds.has(project.id)) continue;
      const before = previous.issuesByProject?.[project.id] || [];
      const after = snapshot.issuesByProject?.[project.id] || [];
      const afterUids = new Set(after.map((issue, index) => slrUid(project.id, issue, index)));
      const missingFromBrowser = before.filter((issue, index) => !afterUids.has(slrUid(project.id, issue, index)));

      if (missingFromBrowser.length) {
        // Missing SLRs are treated as a stale-browser/recovery condition, not as
        // implicit delete intent. Preserve the cloud rows, retain browser edits
        // for matching UIDs, append genuinely new browser rows, then normalize
        // draft SLR/RFI/RBB/checklist numbering before the legacy writer applies
        // sequence_number constraints.
        mergedIssuesByProject[project.id] = mergeProjectIssues(project.id, before, after);
        recoveredCloudOnlySlrs += missingFromBrowser.length;
      }
    }

    if (recoveredCloudOnlySlrs) {
      saveSnapshot = { ...snapshot, issuesByProject: mergedIssuesByProject };
    }
  }

  await legacy.saveWorkspaceToCloud(saveSnapshot);

  // Confirm the normalized SLR rows that the next refresh will read back. A
  // browser can report a successful request while a stale tab or a partial
  // state update has written the previous workspace. Surface that condition
  // now so the UI keeps the browser copy available for recovery.
  const confirmed = await legacy.loadWorkspaceFromCloud();
  if (!confirmed.snapshot) throw new Error('Cloud save completed but the workspace could not be reloaded for verification.');
  for (const project of saveSnapshot.projects || []) {
    const expected = new Set((saveSnapshot.issuesByProject?.[project.id] || []).map((issue, index) => slrUid(project.id, issue, index)));
    const actual = new Set((confirmed.snapshot.issuesByProject?.[project.id] || []).map((issue, index) => slrUid(project.id, issue, index)));
    if (expected.size !== actual.size || [...expected].some((uid) => !actual.has(uid))) {
      throw new Error(`Cloud save verification failed for project ${project.name || project.id}. The saved SLR list did not match the protected workspace snapshot; reload the cloud workspace before continuing.`);
    }
  }
}

let guardedSaveQueue: Promise<void> = Promise.resolve();

export function saveWorkspaceToCloud(snapshot: WorkspaceSnapshot): Promise<void> {
  guardedSaveQueue = guardedSaveQueue.catch(() => undefined).then(() => saveWithSlrProtection(snapshot));
  return guardedSaveQueue;
}
