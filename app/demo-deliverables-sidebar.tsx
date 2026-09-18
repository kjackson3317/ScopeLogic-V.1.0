'use client';

import { useEffect } from 'react';

type Item = { label: string; hubLabel: string };
const STORAGE_KEY = 'technology-preconstruction-demo-deliverable';
const ITEMS: Item[] = [
  { label: 'Scope Matrix / RBB', hubLabel: 'Recommended Base Bid' },
  { label: 'GC Clarifications', hubLabel: 'GC Clarifications' },
  { label: 'Formal RFI', hubLabel: 'Formal RFIs' },
  { label: 'VE Opportunities', hubLabel: 'VE Opportunities' },
  { label: 'Contractor Scope Confirmation', hubLabel: 'Contractor Confirmation' },
  { label: 'Bid Alignment', hubLabel: 'Bid Alignment' },
  { label: 'Reports / Official Releases', hubLabel: 'Reports / Releases' },
];

function selectedLabel() {
  const saved = window.sessionStorage.getItem(STORAGE_KEY) || ITEMS[0].hubLabel;
  return ITEMS.some((item) => item.hubLabel === saved) ? saved : ITEMS[0].hubLabel;
}
function remember(label: string) { window.sessionStorage.setItem(STORAGE_KEY, label); }
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
function syncCustomSelection(group: HTMLElement) {
  const current = selectedLabel();
  group.querySelectorAll<HTMLButtonElement>(':scope > button[data-demo-deliverable]').forEach((button) => {
    const active = button.dataset.hubLabel === current;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
}
function syncHubSelection() {
  const hub = document.querySelector<HTMLElement>('section[aria-label="Deliverables"]');
  if (!hub) return;
  const current = selectedLabel();
  if (hub.dataset.demoDeliverableSelected === current) { hubTabButtons(); return; }
  const target = hubTabButtons().get(current);
  if (!target) return;
  hub.dataset.demoDeliverableSelected = current;
  target.click();
}
function openHubTab(nativeDeliverablesButton: HTMLButtonElement, item: Item, group: HTMLElement) {
  remember(item.hubLabel);
  syncCustomSelection(group);
  nativeDeliverablesButton.click();
  let attempts = 0;
  const choose = () => {
    attempts += 1;
    const target = hubTabButtons().get(item.hubLabel);
    if (target) {
      const hub = document.querySelector<HTMLElement>('section[aria-label="Deliverables"]');
      if (hub) hub.dataset.demoDeliverableSelected = item.hubLabel;
      target.click();
      return;
    }
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
      button.addEventListener('click', () => openHubTab(native, item, group));
      group.appendChild(button);
    }
    custom = Array.from(group.querySelectorAll<HTMLButtonElement>(':scope > button[data-demo-deliverable]'));
  }
  syncCustomSelection(group);
  syncHubSelection();
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
