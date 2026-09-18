'use client';

import { useEffect } from 'react';

const PANEL_SELECTOR = '.quote-panel,.panel,.form-card,.contract-section,.revision-box,.dashboard-card,.takeoff-quantity-group';
const HEADER_SELECTOR = ':scope > .quote-panel-head,:scope > .panel-head,:scope > .dashboard-card-head,:scope > .contract-section-title,:scope > .takeoff-system-title';

function installPanelToggle(panel: HTMLElement) {
  if (panel.dataset.uniformityCollapse === 'true' || panel.closest('[role="dialog"],.quote-picker-backdrop,.modal-backdrop')) return;
  const header = panel.querySelector<HTMLElement>(HEADER_SELECTOR);
  if (!header) return;
  panel.dataset.uniformityCollapse = 'true';
  panel.classList.add('sl-collapsible-panel');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sl-panel-toggle';
  button.title = 'Collapse / expand section';
  button.setAttribute('aria-label', 'Collapse section');
  button.textContent = '−';
  button.addEventListener('click', (event) => {
    event.preventDefault(); event.stopPropagation();
    const collapsed = !panel.classList.contains('sl-panel-collapsed');
    panel.classList.toggle('sl-panel-collapsed', collapsed);
    Array.from(panel.children).forEach((child) => {
      if (child !== header) child.classList.toggle('sl-collapse-body-hidden', collapsed);
    });
    button.textContent = collapsed ? '+' : '−';
    button.setAttribute('aria-label', collapsed ? 'Expand section' : 'Collapse section');
  });
  header.appendChild(button);
}

function installPanelToggles() {
  document.querySelectorAll<HTMLElement>(PANEL_SELECTOR).forEach(installPanelToggle);
}

function quoteTemplateRecentFive() {
  const list = Array.from(document.querySelectorAll<HTMLElement>('.quote-list')).find((node) =>
    Array.from(node.querySelectorAll<HTMLButtonElement>(':scope > button.primary')).some((button) => /new template/i.test(button.textContent || ''))
  );
  if (!list) return;
  const rows = Array.from(list.querySelectorAll<HTMLButtonElement>(':scope > button:not(.primary):not(.sl-library-show-all)'));
  if (rows.length <= 5) return;
  let toggle = list.querySelector<HTMLButtonElement>(':scope > .sl-library-show-all');
  if (!toggle) {
    toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'sl-library-show-all'; toggle.dataset.expanded = 'false';
    const host = list.querySelector('[data-quote-template-search-host]');
    (host || list.querySelector(':scope > button.primary'))?.after(toggle);
    toggle.addEventListener('click', () => { toggle!.dataset.expanded = toggle!.dataset.expanded === 'true' ? 'false' : 'true'; quoteTemplateRecentFive(); });
  }
  const search = list.querySelector<HTMLInputElement>('.quote-template-search input');
  const system = list.querySelector<HTMLSelectElement>('.quote-template-search select');
  const filtering = Boolean(search?.value.trim()) || Boolean(system && system.value !== 'All');
  const expanded = toggle.dataset.expanded === 'true';
  rows.forEach((row, index) => row.classList.toggle('sl-recent-hidden', !filtering && !expanded && index >= 5));
  toggle.hidden = filtering;
  toggle.textContent = expanded ? 'Show Recent 5' : `Show All ${rows.length} Templates`;
}

function slrRecentFive() {
  const search = document.querySelector<HTMLInputElement>('.slr-template-search-controls input');
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('.slr-template-search-controls select'));
  const results = document.querySelector<HTMLElement>('.slr-template-search-results');
  if (!results) return;
  const rows = Array.from(results.querySelectorAll<HTMLButtonElement>(':scope > button'));
  const filtering = Boolean(search?.value.trim()) || selects.some((select) => select.value !== 'All');
  let toggle = document.querySelector<HTMLButtonElement>('.slr-template-search > .sl-library-show-all');
  if (!toggle && rows.length > 5) {
    toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'sl-library-show-all'; toggle.dataset.expanded = 'false';
    results.after(toggle);
    toggle.addEventListener('click', () => { toggle!.dataset.expanded = toggle!.dataset.expanded === 'true' ? 'false' : 'true'; slrRecentFive(); });
  }
  const expanded = toggle?.dataset.expanded === 'true';
  rows.forEach((row, index) => row.classList.toggle('sl-recent-hidden', !filtering && !expanded && index >= 5));
  if (toggle) { toggle.hidden = filtering || rows.length <= 5; toggle.textContent = expanded ? 'Show Recent 5' : `Show All ${rows.length} Templates`; }
}

function takeoffRuleRecentFive() {
  const panel = document.querySelector<HTMLElement>('.compact-rule-library');
  const select = panel?.querySelector<HTMLSelectElement>('.rule-library-select select');
  if (!panel || !select) return;
  const search = panel.querySelector<HTMLInputElement>('.takeoff-rule-search input');
  const system = panel.querySelector<HTMLSelectElement>('.takeoff-rule-search select');
  const filtering = Boolean(search?.value.trim()) || Boolean(system && system.value !== 'All');
  const options = Array.from(select.options).filter((option) => Boolean(option.value));
  if (!panel.querySelector('.sl-rule-recent-note') && options.length > 5) {
    const note = document.createElement('small'); note.className = 'sl-rule-recent-note'; note.textContent = 'Showing the first 5 rules until you search or filter.';
    panel.querySelector('[data-takeoff-rule-search-host]')?.after(note);
  }
  if (!filtering) options.forEach((option, index) => { if (index >= 5 && option.value !== select.value) option.hidden = true; });
}

function bindSearchRefresh() {
  document.querySelectorAll<HTMLElement>('.quote-template-search,.slr-template-search-controls,.takeoff-rule-search').forEach((node) => {
    if (node.dataset.uniformityBound === 'true') return;
    node.dataset.uniformityBound = 'true';
    node.addEventListener('input', () => requestAnimationFrame(refreshUniformity));
    node.addEventListener('change', () => requestAnimationFrame(refreshUniformity));
  });
}

function activateDeliverableQueryTab() {
  if (!/\/master-projects\/[^/]+\/deliverables\/?$/.test(window.location.pathname)) return;
  const requested = new URLSearchParams(window.location.search).get('tab');
  if (!requested) return;
  const labels: Record<string,string> = {
    matrix:'ScopeLogic Matrix', clarifications:'Clarification Log', rfi:'Clarification Log', checklist:'Contractor Checklist',
    ve:'VE Opportunity Log', 'bid-internal':'Bid Alignment — Internal', 'bid-report':'Bid Alignment Report', internal:'Internal Actions', notes:'Review Notes'
  };
  const wanted = labels[requested]; if (!wanted) return;
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('aside nav button')).find((item) => (item.textContent || '').includes(wanted));
  if (button && !button.className.includes('active')) button.click();
  if (requested !== 'rfi' && requested !== 'clarifications') return;
  const table = Array.from(document.querySelectorAll<HTMLTableElement>('table')).find((item) => /GC Clarification|RFI|Clarification/i.test(item.textContent || ''));
  if (!table) return;
  Array.from(table.tBodies[0]?.rows || []).forEach((row) => {
    const number = row.cells[0]?.textContent?.trim() || '';
    row.hidden = requested === 'rfi' ? !/^RFI-/i.test(number) : !/^CL-/i.test(number);
  });
}

function refreshUniformity() {
  installPanelToggles(); quoteTemplateRecentFive(); slrRecentFive(); takeoffRuleRecentFive(); bindSearchRefresh(); activateDeliverableQueryTab();
}

export default function WorkstationUniformityBehavior() {
  useEffect(() => {
    let queued = false;
    const refresh = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; refreshUniformity(); }); };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList:true, subtree:true });
    return () => observer.disconnect();
  }, []);
  return null;
}
