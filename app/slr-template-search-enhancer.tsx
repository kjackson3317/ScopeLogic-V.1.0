'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../lib/supabase/client';

type TemplateRecord = {
  id: string;
  legacy_id?: string | null;
  name: string;
  active?: boolean;
  template_data?: Record<string, any> | null;
};

type ActionFilter = 'All' | 'RBB' | 'GC Clarification' | 'Formal RFI' | 'Checklist';

const text = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => text(value).toLowerCase();

function systemsFor(record: TemplateRecord) {
  const data = record.template_data || {};
  const systems = Array.isArray(data.systems) ? data.systems.map(text).filter(Boolean) : [];
  if (!systems.length && data.system) systems.push(text(data.system));
  return Array.from(new Set(systems));
}

function actionsFor(record: TemplateRecord) {
  const data = record.template_data || {};
  const actions: string[] = [];
  if (data.sow || (data.recommendations && Object.values(data.recommendations).some((value) => text(value)))) actions.push('RBB');
  if (data.clarification) actions.push('GC Clarification');
  if (data.formalRfi || (Array.isArray(data.rfis) && data.rfis.length)) actions.push('Formal RFI');
  if (data.checklist || text(data.checklistItem) || (data.checklistItems && Object.values(data.checklistItems).some((value) => text(value)))) actions.push('Checklist');
  return actions;
}

function searchableText(record: TemplateRecord) {
  const data = record.template_data || {};
  return [
    record.name,
    data.title,
    data.system,
    ...(Array.isArray(data.systems) ? data.systems : []),
    data.concern,
    data.basis,
    data.rfiQuestion,
    data.reference,
    data.sourceType,
    data.checklistItem,
    JSON.stringify(data.recommendations || {}),
    JSON.stringify(data.checklistItems || {}),
  ].map(lower).join(' ');
}

export default function SlrTemplateSearchEnhancer() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [nativeSelect, setNativeSelect] = useState<HTMLSelectElement | null>(null);
  const [records, setRecords] = useState<TemplateRecord[]>([]);
  const [query, setQuery] = useState('');
  const [system, setSystem] = useState('All');
  const [action, setAction] = useState<ActionFilter>('All');
  const [selected, setSelected] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const attach = () => {
      const bar = document.querySelector<HTMLElement>('.template-library');
      const select = bar?.querySelector<HTMLSelectElement>('select');
      if (!bar || !select) return false;
      let host = bar.querySelector<HTMLElement>('[data-slr-template-search-host]');
      if (!host) {
        host = document.createElement('div');
        host.dataset.slrTemplateSearchHost = 'true';
        select.before(host);
      }
      bar.classList.add('template-library-search-enabled');
      setMount(host);
      setNativeSelect(select);
      setSelected(select.value);
      const sync = () => setSelected(select.value);
      select.addEventListener('change', sync);
      return true;
    };
    if (!attach()) {
      observer = new MutationObserver(() => { if (attach()) observer?.disconnect(); });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const client = createClient();
        const result = await client.from('slr_templates').select('id,legacy_id,name,template_data,active').eq('active', true).order('name');
        if (result.error) throw new Error(result.error.message);
        if (active) setRecords((result.data || []) as TemplateRecord[]);
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Template library could not be loaded.');
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const systems = useMemo(() => Array.from(new Set(records.flatMap(systemsFor))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [records]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      if (system !== 'All' && !systemsFor(record).includes(system)) return false;
      if (action !== 'All' && !actionsFor(record).includes(action)) return false;
      if (needle && !searchableText(record).includes(needle)) return false;
      return true;
    });
  }, [records, query, system, action]);

  const choose = (record: TemplateRecord) => {
    if (!nativeSelect) return;
    const preferred = text(record.legacy_id) || record.id;
    const matchingOption = Array.from(nativeSelect.options).find((option) => option.value === preferred || lower(option.textContent) === lower(record.name));
    if (!matchingOption) return;
    nativeSelect.value = matchingOption.value;
    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    setSelected(matchingOption.value);
  };

  if (!mount) return null;
  return createPortal(
    <section className="slr-template-search" aria-label="Search SLR templates">
      <div className="slr-template-search-controls">
        <label><span>Search templates</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, concern, recommendation, RFI text, reference…" /></label>
        <label><span>System</span><select value={system} onChange={(event) => setSystem(event.target.value)}><option>All</option>{systems.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Output</span><select value={action} onChange={(event) => setAction(event.target.value as ActionFilter)}><option>All</option><option>RBB</option><option>GC Clarification</option><option>Formal RFI</option><option>Checklist</option></select></label>
      </div>
      <div className="slr-template-search-meta"><b>{visible.length}</b><span>of {records.length} templates</span>{(query || system !== 'All' || action !== 'All') && <button type="button" onClick={() => { setQuery(''); setSystem('All'); setAction('All'); }}>Clear filters</button>}</div>
      {loadError ? <div className="slr-template-search-empty">Template search could not refresh: {loadError}</div> : visible.length ? <div className="slr-template-search-results">{visible.slice(0, 100).map((record) => {
        const value = text(record.legacy_id) || record.id;
        const isSelected = selected === value || Array.from(nativeSelect?.options || []).some((option) => option.value === selected && lower(option.textContent) === lower(record.name));
        const systems = systemsFor(record);
        const actions = actionsFor(record);
        return <button type="button" key={record.id} className={isSelected ? 'selected' : ''} onClick={() => choose(record)}><span><b>{record.name}</b><small>{systems.join(' · ') || 'No system assigned'}</small></span><span className="slr-template-badges">{actions.map((item) => <em key={item}>{item}</em>)}</span></button>;
      })}</div> : <div className="slr-template-search-empty">No SLR templates match the current filters.</div>}
      {visible.length > 100 && <div className="slr-template-search-limit">Showing the first 100 matches. Narrow the search to find a specific template.</div>}
    </section>,
    mount,
  );
}
