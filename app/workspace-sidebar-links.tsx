'use client';

import { useEffect } from 'react';

const LINK_STYLE: Partial<CSSStyleDeclaration> = {
  display: 'block',
  width: '100%',
  border: '0',
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  padding: '8px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  textDecoration: 'none',
  font: 'inherit',
};

function styleLink(link: HTMLAnchorElement) {
  Object.assign(link.style, LINK_STYLE);
  link.addEventListener('mouseenter', () => { link.style.background = 'rgba(255,255,255,.08)'; });
  link.addEventListener('mouseleave', () => { link.style.background = 'transparent'; });
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

function installWorkspaceLinks() {
  const sidebar = document.querySelector('aside.sidebar');
  if (!sidebar) return false;

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

  return true;
}

export default function WorkspaceSidebarLinks() {
  useEffect(() => {
    if (installWorkspaceLinks()) return;
    const observer = new MutationObserver(() => {
      if (installWorkspaceLinks()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
