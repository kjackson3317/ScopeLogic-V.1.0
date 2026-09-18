'use client';

import { useEffect } from 'react';

const DELIVERABLE_LABELS: Record<string,string> = {
  matrix: 'Scope Matrix / RBB',
  clarifications: 'GC Clarifications',
  rfi: 'Formal RFI',
  checklist: 'Contractor Scope Confirmation',
  ve: 'VE Opportunities',
  'bid-internal': 'Bid Alignment',
  'bid-report': 'Reports / Official Releases',
};

function setTabQuery(tab: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function filterClarificationRows(kind: 'CL'|'RFI') {
  const table = Array.from(document.querySelectorAll<HTMLTableElement>('table')).find((candidate) => {
    const text = candidate.textContent || '';
    return text.includes('GC Clarification') || text.includes('RFI') || text.includes('Clarification / Question');
  });
  if (!table?.tBodies[0]) return;
  Array.from(table.tBodies[0].rows).forEach((row) => {
    const id = row.cells[0]?.textContent?.trim() || '';
    row.hidden = kind === 'RFI' ? !/^RFI-/i.test(id) : !/^CL-/i.test(id);
  });
}

function clickAfterRender(button: HTMLButtonElement, kind?: 'CL'|'RFI') {
  button.click();
  if (!kind) return;
  let attempts = 0;
  const apply = () => {
    attempts += 1;
    filterClarificationRows(kind);
    if (attempts < 8) window.requestAnimationFrame(apply);
  };
  window.requestAnimationFrame(apply);
}

function dedicatedDeliverablesNav() {
  if (!/^\/master-projects\/[^/]+\/deliverables\/?$/.test(window.location.pathname)) return false;
  const nav = Array.from(document.querySelectorAll<HTMLElement>('aside nav')).find((candidate) => {
    const text = candidate.textContent || '';
    return (text.includes('ScopeLogic Matrix') || text.includes('Scope Matrix / RBB')) && text.includes('Bid Alignment');
  });
  if (!nav) return false;

  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>(':scope > button'));
  const byText = (pattern: RegExp) => buttons.find((button) => pattern.test(button.textContent?.trim() || ''));
  const matrix = byText(/ScopeLogic Matrix|Scope Matrix \/ RBB/i);
  const clarifications = byText(/Clarification Log|GC Clarifications/i);
  const checklist = byText(/Contractor Checklist|Contractor Scope Confirmation/i);
  const ve = byText(/VE Opportunity Log|VE Opportunities/i);
  const bidInternal = byText(/Bid Alignment — Internal|^Bid Alignment$/i);
  const bidReport = byText(/Bid Alignment Report|Reports \/ Official Releases/i);
  const notes = byText(/^Review Notes$/i);
  const internal = byText(/^Internal Actions$/i);

  const rename = (button: HTMLButtonElement | undefined, tab: string) => {
    if (!button) return;
    button.textContent = DELIVERABLE_LABELS[tab];
    button.dataset.deliverableTab = tab;
    if (button.dataset.deliverableQueryBound !== 'true') {
      button.dataset.deliverableQueryBound = 'true';
      button.addEventListener('click', () => {
        nav.dataset.appliedDeliverableTab = tab;
        setTabQuery(tab);
        if (tab === 'clarifications') window.requestAnimationFrame(() => filterClarificationRows('CL'));
      });
    }
  };
  rename(matrix, 'matrix');
  rename(clarifications, 'clarifications');
  rename(checklist, 'checklist');
  rename(ve, 've');
  rename(bidInternal, 'bid-internal');
  rename(bidReport, 'bid-report');

  if (clarifications && !nav.querySelector<HTMLButtonElement>('[data-deliverable-tab="rfi"]')) {
    const rfi = document.createElement('button');
    rfi.type = 'button';
    rfi.textContent = DELIVERABLE_LABELS.rfi;
    rfi.dataset.deliverableTab = 'rfi';
    rfi.addEventListener('click', () => {
      nav.dataset.appliedDeliverableTab = 'rfi';
      setTabQuery('rfi');
      clickAfterRender(clarifications, 'RFI');
      Array.from(nav.querySelectorAll(':scope > button')).forEach((item) => item.classList.toggle('active', item === rfi));
    });
    clarifications.after(rfi);
  }

  if (notes) {
    notes.dataset.workflowInternal = 'true';
    notes.title = 'Internal review workflow';
  }
  if (internal) {
    internal.dataset.workflowInternal = 'true';
    internal.title = 'Internal review workflow';
  }

  const requested = new URLSearchParams(window.location.search).get('tab') || 'matrix';
  const rfiButton = nav.querySelector<HTMLButtonElement>('[data-deliverable-tab="rfi"]');
  const targetMap: Record<string,HTMLButtonElement|undefined> = {
    matrix,
    clarifications,
    checklist,
    ve,
    'bid-internal': bidInternal,
    'bid-report': bidReport,
  };

  if (requested === 'rfi' && clarifications && rfiButton) {
    if (nav.dataset.appliedDeliverableTab !== 'rfi') {
      nav.dataset.appliedDeliverableTab = 'rfi';
      clickAfterRender(clarifications, 'RFI');
    } else {
      filterClarificationRows('RFI');
    }
    Array.from(nav.querySelectorAll(':scope > button')).forEach((item) => item.classList.toggle('active', item === rfiButton));
  } else {
    const target = targetMap[requested];
    if (target && nav.dataset.appliedDeliverableTab !== requested) {
      nav.dataset.appliedDeliverableTab = requested;
      clickAfterRender(target, requested === 'clarifications' ? 'CL' : undefined);
    } else if (requested === 'clarifications') {
      filterClarificationRows('CL');
    }
  }

  if (requested === 'bid-report') {
    const reportTitle = Array.from(document.querySelectorAll<HTMLElement>('h1,h2')).find((item) => /Bid Alignment Report/i.test(item.textContent || ''));
    const host = reportTitle?.parentElement?.parentElement;
    if (host && !host.querySelector('.sl-official-release-link')) {
      const link = document.createElement('a');
      link.className = 'sl-official-release-link';
      link.href = '/?view=releases';
      link.textContent = 'Open Official Releases';
      link.style.cssText = 'display:inline-flex;align-items:center;min-height:27px;padding:3px 8px;margin:5px 0;border:1px solid #667d42;border-radius:3px;background:#f1f5ed;color:#26351a;font-size:10px;font-weight:700;text-decoration:none;';
      host.appendChild(link);
    }
  }
  return true;
}

function rootViewQuery() {
  if (window.location.pathname !== '/') return;
  const view = new URLSearchParams(window.location.search).get('view');
  if (view !== 'releases') return;
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('aside.sidebar button')).find((item) => item.textContent?.trim() === 'Official Releases');
  if (button && !button.classList.contains('active')) button.click();
}

export default function DeliverablesNavigationEnhancer() {
  useEffect(() => {
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        dedicatedDeliverablesNav();
        rootViewQuery();
      });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', refresh);
    return () => { observer.disconnect(); window.removeEventListener('popstate', refresh); };
  }, []);
  return null;
}
