'use client';

import { useEffect } from 'react';

type Item = { label: string; hubLabel: string };
const ITEMS: Item[] = [
  { label: 'Scope Matrix / RBB', hubLabel: 'Recommended Base Bid' },
  { label: 'GC Clarifications', hubLabel: 'GC Clarifications' },
  { label: 'Formal RFI', hubLabel: 'Formal RFIs' },
  { label: 'VE Opportunities', hubLabel: 'VE Opportunities' },
  { label: 'Contractor Scope Confirmation', hubLabel: 'Contractor Confirmation' },
  { label: 'Bid Alignment', hubLabel: 'Bid Alignment' },
  { label: 'Reports / Official Releases', hubLabel: 'Reports / Releases' },
];

function heading(group: Element) {
  return group.querySelector<HTMLElement>(':scope > span, :scope > .nav-label');
}

function hubTabButtons() {
  const hub = document.querySelector<HTMLElement>('section[aria-label="Deliverables"]');
  if (!hub) return new Map<string, HTMLButtonElement>();
  const all = Array.from(hub.querySelectorAll<HTMLButtonElement>('button'));
  const map = new Map<string, HTMLButtonElement>();
  for (const item of ITEMS) {
    const button = all.find((candidate) => candidate.textContent?.trim() === item.hubLabel);
    if (button) map.set(item.hubLabel, button);
  }
  const first = map.get(ITEMS[0].hubLabel);
  const tabs = first?.parentElement;
  if (tabs && ITEMS.every((item) => map.get(item.hubLabel)?.parentElement === tabs)) {
    tabs.style.display = 'none';
    tabs.setAttribute('aria-hidden', 'true');
  }
  return map;
}

function openHubTab(nativeDeliverablesButton: HTMLButtonElement, item: Item, customButtons: HTMLButtonElement[]) {
  nativeDeliverablesButton.click();
  customButtons.forEach((button) => button.classList.toggle('active', button.dataset.hubLabel === item.hubLabel));
  let attempts = 0;
  const choose = () => {
    attempts += 1;
    const target = hubTabButtons().get(item.hubLabel);
    if (target) { target.click(); return; }
    if (attempts < 30) window.requestAnimationFrame(choose);
  };
  window.requestAnimationFrame(choose);
}

function install() {
  const sidebar = document.querySelector<HTMLElement>('aside.sidebar');
  if (!sidebar) return false;
  const group = Array.from(sidebar.querySelectorAll<HTMLElement>('.nav-group')).find((candidate) =>
    heading(candidate)?.textContent?.trim().toUpperCase() === 'DELIVERABLES'
  );
  if (!group) return false;
  const native = Array.from(group.querySelectorAll<HTMLButtonElement>(':scope > button')).find((button) => button.textContent?.trim() === 'Deliverables');
  if (!native) return false;
  native.style.display = 'none';
  native.setAttribute('aria-hidden', 'true');

  let custom = Array.from(group.querySelectorAll<HTMLButtonElement>(':scope > button[data-demo-deliverable]'));
  if (!custom.length) {
    for (const item of ITEMS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.demoDeliverable = 'true';
      button.dataset.hubLabel = item.hubLabel;
      button.textContent = item.label;
      group.appendChild(button);
      custom.push(button);
    }
    custom.forEach((button) => {
      const item = ITEMS.find((candidate) => candidate.hubLabel === button.dataset.hubLabel);
      if (item) button.addEventListener('click', () => openHubTab(native, item, custom));
    });
    custom[0]?.classList.add('active');
  }
  hubTabButtons();
  return true;
}

export default function DemoDeliverablesSidebar() {
  useEffect(() => {
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => { queued = false; install(); hubTabButtons(); });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
