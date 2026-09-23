'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createClient } from '../lib/supabase/client';

type Master = { id: string; project_number: string; name: string };
type Finding = { id: string; display_number: string; scope_item: string; status: string };
type ReviewNote = { id: string; system_name: string; topic: string; source_type: string; source_reference: string; observation: string };

const LOCAL_WORKSPACE_KEYS = ['scopelogic-r14-8', 'technology-precon-r14-8', 'technology-precon-r14-7', 'technology-precon-r14-6', 'technology-precon-r14-5', 'technology-precon-r14-4', 'technology-precon-r14-3', 'technology-precon-r14-2'];
const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const toast = (message: string, kind: 'success' | 'error' | 'info' = 'success') => window.dispatchEvent(new CustomEvent('scopelogic:toast', { detail: { message, kind } }));

function currentLegacyProjectId() {
  for (const key of LOCAL_WORKSPACE_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const id = clean(parsed?.projectId);
      if (id) return id;
    } catch {}
  }
  return '';
}

function currentSlrId() {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('.matrix-editor-full label.field'));
  const target = labels.find((label) => label.querySelector('span')?.textContent?.trim() === 'SLR ID');
  return target?.querySelector<HTMLInputElement>('input')?.value?.trim() || '';
}

function noteSignature(note: Pick<ReviewNote, 'system_name' | 'topic' | 'source_type' | 'source_reference' | 'observation'>) {
  return [note.system_name, note.topic, note.source_type, note.source_reference, note.observation].map(clean).join('||').toLowerCase();
}

export default function ProjectWorkflowEnhancer() {
  const supabase = useMemo(() => createClient() as any, []);
  const masterRef = useRef<Master | null>(null);
  const findingsRef = useRef<Finding[]>([]);
  const noteMapRef = useRef(new Map<string, string[]>());
  const lastLoadRef = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    const resolveMaster = async (force = false) => {
      if (loadingRef.current) return masterRef.current;
      const now = Date.now();
      if (!force && masterRef.current && now - lastLoadRef.current < 5000) return masterRef.current;
      loadingRef.current = true;
      try {
        const legacyId = currentLegacyProjectId();
        let masterId = '';
        if (legacyId) {
          const byLegacy = await supabase.from('projects').select('master_project_id').eq('legacy_id', legacyId).maybeSingle();
          if (!byLegacy.error) masterId = clean(byLegacy.data?.master_project_id);
          if (!masterId && /^[0-9a-f-]{36}$/i.test(legacyId)) {
            const byId = await supabase.from('projects').select('master_project_id').eq('id', legacyId).maybeSingle();
            if (!byId.error) masterId = clean(byId.data?.master_project_id);
          }
        }
        if (!masterId) {
          const pathId = window.location.pathname.match(/^\/master-projects\/([^/]+)/)?.[1] || '';
          if (pathId) masterId = pathId;
        }
        if (!masterId) return masterRef.current;

        const [masterResult, findingsResult, notesResult] = await Promise.all([
          supabase.from('master_projects').select('id,project_number,name').eq('id', masterId).maybeSingle(),
          supabase.from('master_project_findings').select('id,display_number,scope_item,status').eq('master_project_id', masterId).order('sequence_number'),
          supabase.from('master_project_review_notes').select('id,system_name,topic,source_type,source_reference,observation').eq('master_project_id', masterId),
        ]);
        if (masterResult.error || !masterResult.data) return masterRef.current;
        masterRef.current = masterResult.data as Master;
        findingsRef.current = (findingsResult.data || []) as Finding[];
        const nextMap = new Map<string, string[]>();
        ((notesResult.data || []) as ReviewNote[]).forEach((note) => {
          const key = noteSignature(note);
          nextMap.set(key, [...(nextMap.get(key) || []), note.id]);
        });
        noteMapRef.current = nextMap;
        lastLoadRef.current = now;
        return masterRef.current;
      } finally {
        loadingRef.current = false;
      }
    };

    const updateSidebar = () => {
      const master = masterRef.current;
      const label = document.querySelector<HTMLElement>('.project-switch b');
      if (!master || !label) return;
      const expected = `${master.project_number} · ${master.name}`;
      if (label.textContent !== expected) label.textContent = expected;
      label.dataset.slFullProjectLabel = 'true';
    };

    const openSlr = (number: string, notify = true) => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.issue-list > button'));
      const target = buttons.find((button) => clean(button.querySelector('b')?.textContent) === number);
      if (!target) {
        if (notify) toast(`${number} is not visible in the current Internal Matrix filters. Clear the filters and try again.`, 'error');
        return false;
      }
      target.click();
      return true;
    };

    const updateSlrBrowser = () => {
      const toolbar = document.querySelector<HTMLElement>('.matrix-toolbar');
      if (!toolbar || !document.querySelector('.issue-list')) return;
      let browser = document.querySelector<HTMLDetailsElement>('.sl-project-slr-browser');
      if (!browser) {
        browser = document.createElement('details');
        browser.className = 'sl-project-slr-browser';
        browser.open = true;
        toolbar.before(browser);
      }
      const signature = findingsRef.current.map((item) => `${item.id}:${item.display_number}:${item.scope_item}:${item.status}`).join('|');
      if (browser.dataset.signature === signature) return;
      browser.dataset.signature = signature;
      browser.replaceChildren();

      const summary = document.createElement('summary');
      const summaryLabel = document.createElement('span');
      summaryLabel.textContent = 'Project SLRs';
      const count = document.createElement('b');
      count.textContent = String(findingsRef.current.length);
      const hint = document.createElement('small');
      hint.textContent = 'Expand / collapse';
      summary.append(summaryLabel, count, hint);
      browser.appendChild(summary);

      const list = document.createElement('div');
      list.className = 'sl-project-slr-browser-list';
      findingsRef.current.forEach((finding) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.slrNumber = finding.display_number;
        const number = document.createElement('b');
        number.textContent = finding.display_number;
        const title = document.createElement('span');
        title.textContent = finding.scope_item || 'Untitled SLR';
        const status = document.createElement('small');
        status.textContent = finding.status || 'Open';
        button.append(number, title, status);
        button.addEventListener('click', () => {
          if (openSlr(finding.display_number)) browser!.open = false;
        });
        list.appendChild(button);
      });
      browser.appendChild(list);
    };

    const articleSignature = (article: HTMLElement) => {
      const systemGroup = article.closest<HTMLElement>('.sl-review-system-group');
      const topicGroup = article.closest<HTMLElement>('.sl-review-topic-group');
      const system = clean(systemGroup?.querySelector<HTMLElement>('.sl-review-system-summary b')?.textContent);
      const topic = clean(topicGroup?.querySelector<HTMLElement>(':scope > summary b')?.textContent);
      const sourceType = clean(article.querySelector<HTMLElement>('.sl-review-note-head > div:first-child b')?.textContent);
      const reference = clean(article.querySelector<HTMLElement>('.sl-review-note-head > div:first-child span')?.textContent).replace(/^No source reference$/i, '');
      const observation = clean(Array.from(article.children).find((child) => child.tagName === 'P')?.textContent);
      return noteSignature({ system_name: system, topic, source_type: sourceType, source_reference: reference, observation });
    };

    const installReviewNoteDeletes = () => {
      document.querySelectorAll<HTMLElement>('.sl-review-topic-group .sl-review-group-items > article').forEach((article) => {
        if (article.querySelector('.sl-review-note-delete')) return;
        const ids = noteMapRef.current.get(articleSignature(article)) || [];
        if (ids.length !== 1) return;
        const actions = article.querySelector<HTMLElement>('.sl-review-note-actions');
        if (!actions) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sl-review-note-delete';
        button.textContent = 'Delete';
        button.dataset.noteId = ids[0];
        actions.appendChild(button);
      });
    };

    const apply = async (force = false) => {
      await resolveMaster(force);
      updateSidebar();
      updateSlrBrowser();
      installReviewNoteDeletes();
    };

    let queued = false;
    const schedule = (force = false) => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        void apply(force);
      });
    };

    let pendingSave = '';
    const clickCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const save = target?.closest('.slr-section-save');
      if (save) {
        pendingSave = currentSlrId();
        if (pendingSave) {
          let tries = 0;
          const reopen = () => {
            tries += 1;
            if (openSlr(pendingSave, false)) {
              toast('SLR saved successfully.', 'success');
              pendingSave = '';
              return;
            }
            if (tries < 12) window.setTimeout(reopen, 90);
            else {
              toast('SLR saved, but ScopeLogic could not keep the record open. Reopen it from the project SLR list.', 'error');
              pendingSave = '';
            }
          };
          window.setTimeout(reopen, 80);
        }
      }

      const deleteButton = target?.closest<HTMLButtonElement>('.sl-review-note-delete');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        const noteId = deleteButton.dataset.noteId || '';
        if (!noteId || !window.confirm('Delete this Review Note? This does not delete a linked SLR.')) return;
        deleteButton.disabled = true;
        void supabase.from('master_project_review_notes').delete().eq('id', noteId).then(async (result: any) => {
          if (result.error) {
            deleteButton.disabled = false;
            toast(`Review note delete failed: ${result.error.message}`, 'error');
            return;
          }
          toast('Review note deleted.', 'success');
          lastLoadRef.current = 0;
          await apply(true);
          window.dispatchEvent(new Event('focus'));
        });
      }
    };

    schedule(true);
    const observer = new MutationObserver(() => schedule(false));
    observer.observe(document.body, { childList: true, subtree: true });
    const focus = () => schedule(true);
    window.addEventListener('focus', focus);
    document.addEventListener('click', clickCapture, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('focus', focus);
      document.removeEventListener('click', clickCapture, true);
      document.querySelector('.sl-project-slr-browser')?.remove();
    };
  }, [supabase]);

  return null;
}
