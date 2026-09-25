'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createClient } from '../lib/supabase/client';

type Master = { id: string; project_number: string; name: string };
type ReviewNote = { id: string; system_name: string; topic: string; source_type: string; source_reference: string; observation: string };

const LOCAL_WORKSPACE_KEYS = ['scopelogic-r14-8', 'technology-precon-r14-8', 'technology-precon-r14-7', 'technology-precon-r14-6', 'technology-precon-r14-5', 'technology-precon-r14-4', 'technology-precon-r14-3', 'technology-precon-r14-2'];
const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const toast = (message: string, kind: 'success' | 'error' | 'info' = 'success') => window.dispatchEvent(new CustomEvent('scopelogic:toast', { detail: { message, kind } }));

function confirmInApp(title: string, message: string, confirmLabel: string) {
  return new Promise<boolean>((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:10080;display:grid;place-items:center;padding:20px;background:rgba(20,26,19,.55)';
    const dialog = document.createElement('section');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.style.cssText = 'width:min(500px,94vw);padding:20px;border:1px solid #aeb8a7;border-radius:10px;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.25);font-family:Arial,Helvetica,sans-serif;color:#202820';
    const eyebrow = document.createElement('span');
    eyebrow.textContent = 'CONFIRM ACTION';
    eyebrow.style.cssText = 'display:block;font-size:10px;font-weight:900;letter-spacing:.09em;color:#7a342e';
    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.style.cssText = 'margin:5px 0 8px;font-size:19px';
    const body = document.createElement('p');
    body.textContent = message;
    body.style.cssText = 'margin:0;color:#626a60;line-height:1.45;font-size:13px';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:18px';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'padding:9px 13px;border:1px solid #c8cec3;border-radius:7px;background:#fff;font-weight:800;cursor:pointer';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = confirmLabel;
    confirm.style.cssText = 'padding:9px 13px;border:1px solid #8b3029;border-radius:7px;background:#8b3029;color:#fff;font-weight:800;cursor:pointer';
    const finish = (result: boolean) => { backdrop.remove(); resolve(result); };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop) finish(false); });
    actions.append(cancel, confirm);
    dialog.append(eyebrow, heading, body, actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    cancel.focus();
  });
}

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

function noteSignature(note: Pick<ReviewNote, 'system_name' | 'topic' | 'source_type' | 'source_reference' | 'observation'>) {
  return [note.system_name, note.topic, note.source_type, note.source_reference, note.observation].map(clean).join('||').toLowerCase();
}

export default function ProjectWorkflowEnhancer() {
  const supabase = useMemo(() => createClient() as any, []);
  const masterRef = useRef<Master | null>(null);
  const masterContextRef = useRef('');
  const noteMapRef = useRef(new Map<string, string[]>());
  const loadingRef = useRef(false);

  useEffect(() => {
    const resolveMaster = async (force = false) => {
      const legacyId = currentLegacyProjectId();
      const pathId = window.location.pathname.match(/^\/master-projects\/([^/]+)/)?.[1] || '';
      const contextKey = legacyId || pathId;

      if (loadingRef.current) return masterRef.current;
      if (!force && masterRef.current && contextKey === masterContextRef.current) return masterRef.current;

      loadingRef.current = true;
      try {
        let masterId = '';
        if (legacyId) {
          const byLegacy = await supabase.from('projects').select('master_project_id').eq('legacy_id', legacyId).maybeSingle();
          if (!byLegacy.error) masterId = clean(byLegacy.data?.master_project_id);
          if (!masterId && /^[0-9a-f-]{36}$/i.test(legacyId)) {
            const byId = await supabase.from('projects').select('master_project_id').eq('id', legacyId).maybeSingle();
            if (!byId.error) masterId = clean(byId.data?.master_project_id);
          }
        }
        if (!masterId && pathId) masterId = pathId;
        if (!masterId) return masterRef.current;

        const [masterResult, notesResult] = await Promise.all([
          supabase.from('master_projects').select('id,project_number,name').eq('id', masterId).maybeSingle(),
          supabase.from('master_project_review_notes').select('id,system_name,topic,source_type,source_reference,observation').eq('master_project_id', masterId),
        ]);
        if (masterResult.error || !masterResult.data) return masterRef.current;

        masterRef.current = masterResult.data as Master;
        masterContextRef.current = contextKey;
        const nextMap = new Map<string, string[]>();
        ((notesResult.data || []) as ReviewNote[]).forEach((note) => {
          const key = noteSignature(note);
          nextMap.set(key, [...(nextMap.get(key) || []), note.id]);
        });
        noteMapRef.current = nextMap;
        return masterRef.current;
      } finally {
        loadingRef.current = false;
      }
    };

    const updateSidebar = () => {
      const master = masterRef.current;
      const switchButton = document.querySelector<HTMLElement>('.project-switch');
      const label = switchButton?.querySelector<HTMLElement>('b');
      if (!master || !label) return;
      const expected = `${master.project_number} · ${master.name}`;
      if (label.textContent !== expected) label.textContent = expected;
      label.dataset.slFullProjectLabel = 'true';
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
      installReviewNoteDeletes();
    };

    let queued = false;
    let queuedForce = false;
    const schedule = (force = false) => {
      queuedForce = queuedForce || force;
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        const forceNow = queuedForce;
        queued = false;
        queuedForce = false;
        void apply(forceNow);
      });
    };

    const clickCapture = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const deleteButton = target?.closest<HTMLButtonElement>('.sl-review-note-delete');
      if (!deleteButton) return;

      event.preventDefault();
      event.stopPropagation();
      const noteId = deleteButton.dataset.noteId || '';
      if (!noteId) return;
      deleteButton.disabled = true;
      void confirmInApp('Delete Review Note?', 'This removes the Review Note only. A linked SLR will not be deleted.', 'Delete Review Note').then(async (confirmed) => {
        if (!confirmed) {
          deleteButton.disabled = false;
          return;
        }
        const result = await supabase.from('master_project_review_notes').delete().eq('id', noteId);
        if (result.error) {
          deleteButton.disabled = false;
          toast(`Review note delete failed: ${result.error.message}`, 'error');
          return;
        }
        toast('Review note deleted.', 'success');
        window.dispatchEvent(new Event('focus'));
      });
    };

    const forceRefresh = () => schedule(true);

    schedule(true);
    const observer = new MutationObserver(() => schedule(false));
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('focus', forceRefresh);
    document.addEventListener('click', clickCapture, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('focus', forceRefresh);
      document.removeEventListener('click', clickCapture, true);
    };
  }, [supabase]);

  return null;
}
