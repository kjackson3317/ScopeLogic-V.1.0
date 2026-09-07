from pathlib import Path

workspace = Path('app/workspace.tsx')
text = workspace.read_text()
old = """  const issues = issuesByProject[projectId] || [];
  const docs = docsByProject[projectId] || [];
  const internalNotes = notesByProject[projectId] || '';
  const exportEntries = exportsByProject[projectId] || [];
  const setIssues = (change: (items: Issue[]) => Issue[]) => setIssuesByProject((current) => ({ ...current, [projectId]: normalizeIssues(change(current[projectId] || [])) }));
"""
new = """  const sharedIssueProjectIds = currentMasterEngagements.map((engagement) => engagement.legacyId);
  const sharedIssues = normalizeIssues(Array.from(new Map(
    (sharedIssueProjectIds.length ? sharedIssueProjectIds : [projectId])
      .flatMap((id) => issuesByProject[id] || [])
      .map((issue) => [issue.uid, issue] as const),
  ).values()));
  const issues = sharedIssues;
  const docs = docsByProject[projectId] || [];
  const internalNotes = notesByProject[projectId] || '';
  const exportEntries = exportsByProject[projectId] || [];
  const setIssues = (change: (items: Issue[]) => Issue[]) => setIssuesByProject((current) => {
    const nextIssues = normalizeIssues(change(sharedIssues));
    const targetIds = sharedIssueProjectIds.length ? sharedIssueProjectIds : [projectId];
    return targetIds.reduce<Record<string, Issue[]>>((next, id) => ({ ...next, [id]: nextIssues }), { ...current });
  });
"""
if old not in text:
    raise SystemExit('workspace target block not found')
text = text.replace(old, new, 1)

anchor = """  const systems = useMemo(() => ['All', ...Array.from(new Set(issues.flatMap(issueSystemNames))).sort(alphaNumericCompare)], [issues]);
"""
effect = """  useEffect(() => {
    if (!sharedIssueProjectIds.length) return;
    setIssuesByProject((current) => {
      const needsSync = sharedIssueProjectIds.some((id) => JSON.stringify(current[id] || []) !== JSON.stringify(sharedIssues));
      if (!needsSync) return current;
      return sharedIssueProjectIds.reduce<Record<string, Issue[]>>((next, id) => ({ ...next, [id]: sharedIssues }), { ...current });
    });
  }, [activeMasterId, sharedIssueProjectIds.join('|'), JSON.stringify(sharedIssues)]);

"""
if anchor not in text:
    raise SystemExit('workspace effect anchor not found')
text = text.replace(anchor, effect + anchor, 1)
workspace.write_text(text)

cloud = Path('lib/cloud-workspace.ts')
cloud_text = cloud.read_text()
old_delete = """    for (const table of ['project_contacts', 'project_systems', 'slr_entries', 'project_documents', 'export_log']) {
      requireResult(await supabase.from(table).delete().in('project_id', currentProjectDbIds), `Prepare ${table}`);
    }
"""
new_delete = """    for (const table of ['project_contacts', 'project_systems', 'project_documents', 'export_log']) {
      requireResult(await supabase.from(table).delete().in('project_id', currentProjectDbIds), `Prepare ${table}`);
    }
"""
if old_delete not in cloud_text:
    raise SystemExit('cloud delete block not found')
cloud_text = cloud_text.replace(old_delete, new_delete, 1)
old_insert = """  await insertChunks(supabase, 'project_contacts', projectContactRows);
  await insertChunks(supabase, 'project_systems', projectSystemRows);
  await insertChunks(supabase, 'slr_entries', slrRows);
  await insertChunks(supabase, 'project_documents', documentRows);
"""
new_insert = """  await insertChunks(supabase, 'project_contacts', projectContactRows);
  await insertChunks(supabase, 'project_systems', projectSystemRows);
  for (const row of slrRows) {
    requireResult(await supabase.from('slr_entries').upsert(row, { onConflict: 'project_id,legacy_uid' }), 'Save shared SLR entry');
  }
  for (const project of snapshot.projects) {
    const projectDbId = projectMap.get(project.id);
    if (!projectDbId) continue;
    const desiredUids = (snapshot.issuesByProject[project.id] || []).map((issue, index) => issue.uid || `${project.id}-slr-${index + 1}`);
    const existing = requireResult(await supabase.from('slr_entries').select('id,legacy_uid').eq('project_id', projectDbId), 'Read shared SLR entries');
    const staleIds = (existing.data || []).filter((row: AnyRecord) => !desiredUids.includes(text(row.legacy_uid))).map((row: AnyRecord) => row.id);
    if (staleIds.length) requireResult(await supabase.from('slr_entries').delete().in('id', staleIds), 'Remove deleted shared SLR entries');
  }
  await insertChunks(supabase, 'project_documents', documentRows);
"""
if old_insert not in cloud_text:
    raise SystemExit('cloud insert block not found')
cloud_text = cloud_text.replace(old_insert, new_insert, 1)
cloud.write_text(cloud_text)
print('Applied minimal Master-shared SLR state and persistence patch.')
