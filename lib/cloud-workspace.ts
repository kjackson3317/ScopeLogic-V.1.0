export * from './cloud-workspace-legacy';

import * as legacy from './cloud-workspace-legacy';
import type { WorkspaceSnapshot } from './cloud-workspace-legacy';

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
}

let guardedSaveQueue: Promise<void> = Promise.resolve();

export function saveWorkspaceToCloud(snapshot: WorkspaceSnapshot): Promise<void> {
  guardedSaveQueue = guardedSaveQueue.catch(() => undefined).then(() => saveWithSlrProtection(snapshot));
  return guardedSaveQueue;
}
