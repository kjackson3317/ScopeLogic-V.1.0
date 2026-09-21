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

const DELIVERABLE_ITEMS = [
  ['master-register', 'Master Coordination Register'],
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

function styleControl(control: HTMLElement) {
  Object.assign(control.style, LINK_STYLE);
}

function addLink(group: Element, href: string, label: string, id: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement('a');
  link.id = id;
  link.href = href;
  link.textContent = label;
  styleControl(link);
  group.appendChild(link);
}

function findGroup(sidebar: HTMLElement, label: string) {
  const wanted = label.trim().toUpperCase();
  return Array.from(sidebar.querySelectorAll<HTMLElement>('.nav-group')).find(
    (item) => folderHeading(item)?.textContent?.trim().toUpperCase() === wanted,
  ) || null;
}

function setFolderOpen(group: HTMLElement, open: boolean) {
  group.classList.toggle('open', open);
  folderHeading(group)?.setAttribute('aria-expanded', String(open));
}

function renderReviewNotes(group: HTMLElement) {
  let button = group.querySelector<HTMLButtonElement>('#scopelogic-review-notes-live-nav');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'scopelogic-review-notes-live-nav';
    button.textContent = 'Review Notes';
    styleControl(button);
  }

  if (button.dataset.reviewNotesEventBound !== 'true') {
    button.dataset.reviewNotesEventBound = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setFolderOpen(group, true);
      window.dispatchEvent(new Event('scopelogic:open-review-notes'));
    });
  }

  const internalNotes = Array.from(group.querySelectorAll<HTMLButtonElement>(':scope > button')).find(
    (item) => item !== button && item.textContent?.trim() === 'Internal Notes',
  );
  if (internalNotes && button.nextElementSibling !== internalNotes) group.insertBefore(button, internalNotes);
  else if (!group.contains(button)) group.appendChild(button);

  button.textContent = 'Review Notes';
}

function renderDeliverables(group: HTMLElement) {
  const heading = folderHeading(group);
  if (!heading) return;
  const existing = Array.from(group.querySelectorAll<HTMLButtonElement>(':scope > .sl-deliverable-nav-link'));
  const existingByTab = new Map(existing.map((button) => [button.dataset.deliverablePreview || '', button]));
  Array.from(group.children).forEach((child) => {
    if (child === heading || child.classList.contains('sl-deliverable-nav-link')) return;
    child.remove();
  });
  for (const [tab, label] of DELIVERABLE_ITEMS) {
    let button = existingByTab.get(tab);
    if (!button || !group.contains(button)) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'sl-deliverable-nav-link';
      button.dataset.deliverablePreview = tab;
      styleControl(button);
      button.addEventListener('click', () => {
        group.querySelectorAll<HTMLElement>(':scope > .sl-deliverable-nav-link').forEach((item) => item.classList.toggle('active', item === button));
        setFolderOpen(group, true);
        window.dispatchEvent(new CustomEvent('scopelogic:deliverable-preview', { detail: { tab, label } }));
      });
      group.appendChild(button);
    }
    button.textContent = label;
  }
  group.dataset.deliverablesInline = 'true';
}

function prepareFolder(group: HTMLElement) {
  if (group.dataset.folderReady === 'true') return;
  const heading = folderHeading(group);
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

function install() {
  const sidebar = document.querySelector<HTMLElement>('aside.sidebar');
  if (!sidebar) return false;

  const projectGroup = findGroup(sidebar, 'PROJECT');
  if (projectGroup) renderReviewNotes(projectGroup);

  const adminGroup = findGroup(sidebar, 'ADMINISTRATION');
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

  const deliverablesGroup = findGroup(sidebar, 'DELIVERABLES');
  if (deliverablesGroup) renderDeliverables(deliverablesGroup);

  Array.from(sidebar.querySelectorAll<HTMLElement>('.nav-group')).forEach(prepareFolder);
  return true;
}

export default function WorkspaceSidebarLinksV2() {
  useEffect(() => {
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        install();
      });
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['class', 'aria-current'],
    });

    const close = () => document.querySelectorAll<HTMLElement>('.sl-deliverable-nav-link').forEach((item) => item.classList.remove('active'));
    const sidebarClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !target.closest('aside.sidebar') || target.closest('.sl-deliverable-nav-link')) return;
      if (document.body.classList.contains('sl-deliverable-preview-open')) window.dispatchEvent(new Event('scopelogic:close-deliverable-preview'));
    };

    window.addEventListener('scopelogic:close-deliverable-preview', close);
    document.addEventListener('click', sidebarClick, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('scopelogic:close-deliverable-preview', close);
      document.removeEventListener('click', sidebarClick, true);
    };
  }, []);
  return null;
}
