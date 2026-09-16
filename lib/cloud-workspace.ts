export * from './cloud-workspace-legacy';

import * as legacy from './cloud-workspace-legacy';
import type { WorkspaceSnapshot } from './cloud-workspace-legacy';
import { isEmployerDemo, DEMO_WORKSPACE_KEY } from './demo/config';
import { localSaveRelease, localReleaseUrl, localListReleases, localNextRelease } from './demo/releases';

export const listOfficialReleases: typeof legacy.listOfficialReleases = (...args) => isEmployerDemo ? localListReleases() : legacy.listOfficialReleases(...args);
export const getNextOfficialReleaseNumber: typeof legacy.getNextOfficialReleaseNumber = (...args) => isEmployerDemo ? localNextRelease() : legacy.getNextOfficialReleaseNumber(...args);
export const createOfficialReleaseUrl: typeof legacy.createOfficialReleaseUrl = (...args) => isEmployerDemo ? localReleaseUrl(args[0]) : legacy.createOfficialReleaseUrl(...args);
export const saveOfficialRelease: typeof legacy.saveOfficialRelease = (...args) => isEmployerDemo ? localSaveRelease(args[3],args[6],args[1],args[2],args[4],args[5],args[7]) : legacy.saveOfficialRelease(...args);
export const saveProposalRelease: typeof legacy.saveProposalRelease = (input) => isEmployerDemo ? localSaveRelease(input.filename,input.pdf,input.revision,input.versionDate,'Local demo proposal',[],input.snapshotData,input.documentKey) : legacy.saveProposalRelease(input);

const slrUid = (projectId: string, issue: { uid?: string }, index: number) => issue.uid || `${projectId}-slr-${index + 1}`;

async function saveWithSlrProtection(snapshot: WorkspaceSnapshot): Promise<void> {
  const current = await legacy.loadWorkspaceFromCloud();
  const previous = current.snapshot;

  if (previous) {
    const currentProjectIds = new Set((snapshot.projects || []).map((project) => project.id));
    const removedUids = new Set<string>();

    for (const project of previous.projects || []) {
      if (!currentProjectIds.has(project.id)) continue;
      const before = previous.issuesByProject?.[project.id] || [];
      const after = snapshot.issuesByProject?.[project.id] || [];
      const afterUids = new Set(after.map((issue, index) => slrUid(project.id, issue, index)));
      before.forEach((issue, index) => {
        const uid = slrUid(project.id, issue, index);
        if (!afterUids.has(uid)) removedUids.add(uid);
      });
    }

    if (removedUids.size > 1) {
      throw new Error(`Cloud save blocked because the browser copy would remove ${removedUids.size} SLRs at once. Reload ScopeLogic to use the current cloud workspace before saving.`);
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
  if(isEmployerDemo){localStorage.setItem(DEMO_WORKSPACE_KEY,JSON.stringify(snapshot));return Promise.resolve();}
  guardedSaveQueue = guardedSaveQueue.catch(() => undefined).then(() => saveWithSlrProtection(snapshot));
  return guardedSaveQueue;
}
