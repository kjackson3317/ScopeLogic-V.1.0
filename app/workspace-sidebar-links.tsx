'use client';

import { useEffect } from 'react';

const LINK_STYLE: Partial<CSSStyleDeclaration> = {
  display: 'block',
  width: '100%',
  border: '0',
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  textDecoration: 'none',
  font: 'inherit',
};

function styleLink(link: HTMLAnchorElement) {
  Object.assign(link.style, LINK_STYLE);
}

function addLink(group: Element, href: string, label: string, id: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement('a');
  link.id = id;
  link.href = href;
  link.textContent = label;
  styleLink(link);
  group.appendChild(link);
}

function installWorkspaceLinks(sidebar: HTMLElement) {
  const adminGroup = Array.from(sidebar.querySelectorAll('.nav-group')).find((group) =>
    group.querySelector(':scope > span')?.textContent?.trim().toUpperCase() === 'ADMINISTRATION'
  );

  if (adminGroup) addLink(adminGroup, '/admin/users', 'User Management', 'scopelogic-user-management-link');

  if (!document.getElementById('scopelogic-client-relations-nav')) {
    const group = document.createElement('div');
    group.id = 'scopelogic-client-relations-nav';
    group.className = 'nav-group';

    const heading = document.createElement('span');
    heading.textContent = 'CLIENT RELATIONSHIPS';
    group.appendChild(heading);
    addLink(group, '/crm', 'CRM', 'scopelogic-crm-link');

    const account = sidebar.querySelector('.sidebar-account');
    if (adminGroup) sidebar.insertBefore(group, adminGroup);
    else if (account) sidebar.insertBefore(group, account);
    else sidebar.appendChild(group);
  }
}

function setFolderOpen(group: HTMLElement, open: boolean) {
  group.classList.toggle('open', open);
  const heading = group.querySelector<HTMLElement>(':scope > span');
  heading?.setAttribute('aria-expanded', String(open));
}

function prepareFolder(group: HTMLElement) {
  if (group.dataset.folderReady === 'true') return;
  const heading = group.querySelector<HTMLElement>(':scope > span');
  if (!heading) return;

  group.dataset.folderReady = 'true';
  group.classList.add('sl-nav-folder');
  heading.classList.add('sl-nav-folder-heading');
  heading.setAttribute('role', 'button');
  heading.setAttribute('tabindex', '0');
  heading.setAttribute('aria-expanded', 'false');

  const toggle = () => setFolderOpen(group, !group.classList.contains('open'));
  heading.addEventListener('click', toggle);
  heading.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle();
  });

  setFolderOpen(group, Boolean(group.querySelector(':scope > button.active, :scope > a[aria-current="page"], :scope > a.active')));
}

function syncFolderStates(sidebar: HTMLElement) {
  const groups = Array.from(sidebar.querySelectorAll<HTMLElement>('.nav-group'));
  groups.forEach(prepareFolder);

  for (const group of groups) {
    const hasActiveChild = Boolean(group.querySelector(':scope > button.active, :scope > a[aria-current="page"], :scope > a.active'));
    if (hasActiveChild) setFolderOpen(group, true);
  }
}

function installWorkspaceNavigation() {
  const sidebar = document.querySelector<HTMLElement>('aside.sidebar');
  if (!sidebar) return false;
  installWorkspaceLinks(sidebar);
  syncFolderStates(sidebar);
  return true;
}

export default function WorkspaceSidebarLinks() {
  useEffect(() => {
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        installWorkspaceNavigation();
      });
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
    return () => observer.disconnect();
  }, []);

  return null;
}
