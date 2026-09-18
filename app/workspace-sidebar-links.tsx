'use client';

import { useEffect } from 'react';
import { createClient } from '../lib/supabase/client';

const LINK_STYLE: Partial<CSSStyleDeclaration> = {
  display: 'block', width: '100%', border: '0', background: 'transparent', color: 'inherit',
  textAlign: 'left', cursor: 'pointer', textDecoration: 'none', font: 'inherit',
};
const LOCAL_WORKSPACE_KEYS = ['scopelogic-r14-8', 'scopelogic-r14-7', 'scopelogic-r14-6', 'scopelogic-r14-5', 'scopelogic-r14-4', 'scopelogic-r14-3', 'scopelogic-r14-2'];
const DELIVERABLE_ITEMS = [
  ['matrix', 'Scope Matrix / RBB'],
  ['clarifications', 'GC Clarifications'],
  ['rfi', 'Formal RFI'],
  ['ve', 'VE Opportunities'],
  ['checklist', 'Contractor Scope Confirmation'],
  ['bid-internal', 'Bid Alignment'],
  ['bid-report', 'Reports / Official Releases'],
] as const;

function folderHeading(group: Element) {
  return group.querySelector<HTMLElement>(':scope > .nav-label, :scope > span');
}
function styleLink(link: HTMLAnchorElement) { Object.assign(link.style, LINK_STYLE); }
function addLink(group: Element, href: string, label: string, id: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement('a');
  link.id = id; link.href = href; link.textContent = label; styleLink(link); group.appendChild(link);
}
function masterProjectIdFromPath() {
  return window.location.pathname.match(/^\/master-projects\/([^/]+)/)?.[1] || '';
}
function activeLegacyProjectId() {
  for (const key of LOCAL_WORKSPACE_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const snapshot = JSON.parse(raw) as { projectId?: string };
      if (snapshot.projectId) return snapshot.projectId;
    } catch { /* try the next workspace key */ }
  }
  return '';
}
async function resolveActiveMasterId() {
  const pathId = masterProjectIdFromPath();
  if (pathId) return pathId;
  const legacyId = activeLegacyProjectId();
  if (!legacyId) return '';
  const supabase = createClient();
  const { data, error } = await supabase.from('projects').select('master_project_id').eq('legacy_id', legacyId).maybeSingle();
  if (error) return '';
  return String(data?.master_project_id || '');
}
function deliverablesGroup(sidebar: HTMLElement) {
  return Array.from(sidebar.querySelectorAll<HTMLElement>('.nav-group')).find((item) =>
    folderHeading(item)?.textContent?.trim().toUpperCase() === 'DELIVERABLES'
  ) || null;
}
function renderDeliverables(group: HTMLElement, masterId: string) {
  const heading = folderHeading(group);
  if (!heading) return;
  if (group.dataset.deliverablesMasterId === masterId && group.querySelector(':scope > .sl-deliverable-nav-link')) return;
  Array.from(group.children).forEach((child) => { if (child !== heading) child.remove(); });
  const activeTab = new URLSearchParams(window.location.search).get('tab') || '';
  for (const [tab, label] of DELIVERABLE_ITEMS) {
    const link = document.createElement('a');
    link.href = `/master-projects/${masterId}/deliverables?tab=${tab}`;
    link.textContent = label;
    link.className = 'sl-deliverable-nav-link';
    styleLink(link);
    if (window.location.pathname.endsWith('/deliverables') && activeTab === tab) {
      link.classList.add('active'); link.setAttribute('aria-current', 'page');
    }
    group.appendChild(link);
  }
  group.dataset.deliverablesMasterId = masterId;
}
async function installDeliverables(sidebar: HTMLElement) {
  const group = deliverablesGroup(sidebar);
  if (!group || group.dataset.deliverablesResolving === 'true') return;
  group.dataset.deliverablesResolving = 'true';
  try {
    const masterId = await resolveActiveMasterId();
    if (masterId) renderDeliverables(group, masterId);
  } finally {
    delete group.dataset.deliverablesResolving;
  }
}

function installWorkspaceLinks(sidebar: HTMLElement) {
  const adminGroup = Array.from(sidebar.querySelectorAll('.nav-group')).find((group) =>
    folderHeading(group)?.textContent?.trim().toUpperCase() === 'ADMINISTRATION'
  );
  if (adminGroup) addLink(adminGroup, '/admin/users', 'User Management', 'scopelogic-user-management-link');

  if (!document.getElementById('scopelogic-client-relations-nav')) {
    const group = document.createElement('div'); group.id = 'scopelogic-client-relations-nav'; group.className = 'nav-group';
    const heading = document.createElement('span'); heading.textContent = 'CLIENT RELATIONSHIPS'; group.appendChild(heading);
    addLink(group, '/crm', 'CRM', 'scopelogic-crm-link');
    const account = sidebar.querySelector('.sidebar-account');
    if (adminGroup) sidebar.insertBefore(group, adminGroup); else if (account) sidebar.insertBefore(group, account); else sidebar.appendChild(group);
  }
  void installDeliverables(sidebar);
}

function setFolderOpen(group: HTMLElement, open: boolean) {
  group.classList.toggle('open', open);
  folderHeading(group)?.setAttribute('aria-expanded', String(open));
}
function prepareFolder(group: HTMLElement) {
  if (group.dataset.folderReady === 'true') return;
  const heading = folderHeading(group); if (!heading) return;
  group.dataset.folderReady = 'true'; group.classList.add('sl-nav-folder'); heading.classList.add('sl-nav-folder-heading');
  heading.setAttribute('role', 'button'); heading.setAttribute('tabindex', '0'); heading.setAttribute('aria-expanded', 'false');
  const toggle = () => setFolderOpen(group, !group.classList.contains('open'));
  heading.addEventListener('click', toggle);
  heading.addEventListener('keydown', (event) => { if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); toggle(); });
  setFolderOpen(group, Boolean(group.querySelector(':scope > button.active, :scope > a[aria-current="page"], :scope > a.active')));
}
function syncFolderStates(sidebar: HTMLElement) {
  const groups = Array.from(sidebar.querySelectorAll<HTMLElement>('.nav-group')); groups.forEach(prepareFolder);
  for (const group of groups) if (group.querySelector(':scope > button.active, :scope > a[aria-current="page"], :scope > a.active')) setFolderOpen(group, true);
}
function installWorkspaceNavigation() {
  const sidebar = document.querySelector<HTMLElement>('aside.sidebar'); if (!sidebar) return false;
  installWorkspaceLinks(sidebar); syncFolderStates(sidebar); return true;
}

export default function WorkspaceSidebarLinks() {
  useEffect(() => {
    let queued = false;
    const refresh = () => { if (queued) return; queued = true; window.requestAnimationFrame(() => { queued = false; installWorkspaceNavigation(); }); };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['class', 'aria-current'] });
    const storageRefresh = (event: StorageEvent) => { if (event.key && LOCAL_WORKSPACE_KEYS.includes(event.key)) refresh(); };
    window.addEventListener('storage', storageRefresh);
    return () => { observer.disconnect(); window.removeEventListener('storage', storageRefresh); };
  }, []);
  return null;
}
