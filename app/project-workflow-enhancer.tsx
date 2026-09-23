'use client';

import { useEffect, useMemo, useRef } from 'react';
import { createClient } from '../lib/supabase/client';

type Master = { id: string; project_number: string; name: string };
type Finding = { id: string; display_number: string; scope_item: string; status: string };
type ReviewNote = { id: string; system_name: string; topic: string; source_type: string; source_reference: string; observation: string };
type CloudDraft = { id: string; project_id: string; legacy_uid: string; display_number: string; saved_at: string; draft_data: { issue?: { uid?: string; id?: string; title?: string; status?: string } } };

const LOCAL_WORKSPACE_KEYS = ['scopelogic-r14-8', 'technology-precon-r14-8', 'technology-precon-r14-7', 'technology-precon-r14-6', 'technology-precon-r14-5', 'technology-precon-r14-4', 'technology-precon-r14-3', 'technology-precon-r14-2'];
const PENDING_DRAFT_KEY = 'scopelogic:open-cloud-slr-draft';
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
  const findingsRef = useRef<Finding[]>([]);
  const draftsRef = useRef<CloudDraft[]>([]);
  const noteMapRef = useRef(new Map<string, string[]>());
  const lastLoadRef = useRef(0);
  const loadingRef = useRef(false);
  const submittedSignatureRef = useRef('');

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

        const [masterResult, findingsResult, notesResult, engagementsResult] = await Promise.all([
          supabase.from('master_projects').select('id,project_number,name').eq('id', masterId).maybeSingle(),
          supabase.from('master_project_findings').select('id,display_number,scope_item,status').eq('master_project_id', masterId).order('sequence_number'),
          supabase.from('master_project_review_notes').select('id,system_name,topic,source_type,source_reference,observation').eq('master_project_id', masterId),
          supabase.from('projects').select('id').eq('master_project_id', masterId),
        ]);
        if (masterResult.error || !masterResult.data) return masterRef.current;
        const engagementIds = (engagementsResult.data || []).map((row: any) => clean(row.id)).filter(Boolean);
        let draftRows: CloudDraft[] = [];
        if (engagementIds.length) {
          const draftResult = await supabase.from('slr_drafts').select('id,project_id,legacy_uid,display_number,saved_at,draft_data').in('project_id', engagementIds).order('saved_at', { ascending: false });
          if (!draftResult.error) draftRows = (draftResult.data || []) as CloudDraft[];
        }
        masterRef.current = masterResult.data as Master;
        findingsRef.current = (findingsResult.data || []) as Finding[];
        draftsRef.current = draftRows;
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
      const switchButton = document.querySelector<HTMLElement>('.project-switch');
      const label = switchButton?.querySelector<HTMLElement>('b');
      if (!master || !label) return;
      const expected = `${master.project_number} · ${master.name}`;
      if (label.textContent !== expected) label.textContent = expected;
      label.dataset.slFullProjectLabel = 'true';
    };

    const openSlr = (number: string, notify = true) => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.submitted-slr-list > button'));
      const target = buttons.find((button) => clean(button.querySelector('b')?.textContent) === number);
      if (!target) {
        if (notify) toast(`${number} is not visible in the current Internal Matrix filters. Clear the filters and try again.`, 'error');
        return false;
      }
      target.click();
      return true;
    };

    const openCloudDraft = (draft: CloudDraft) => {
      window.localStorage.setItem(PENDING_DRAFT_KEY, draft.legacy_uid);
      const newIssueButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => clean(button.textContent) === '+ New Issue');
      if (!newIssueButton) {
        toast('Open saved draft failed: the Internal Matrix new-issue control is not available.', 'error');
        return false;
      }
      newIssueButton.click();
      return true;
    };

    const updateSlrBrowser = () => {
      const templateBar = document.querySelector<HTMLElement>('.template-bar.template-library');
      const matrix = document.querySelector<HTMLElement>('.matrix-editor-full');
      if (!templateBar || !matrix) {
        document.querySelector('.sl-project-slr-browser')?.remove();
        return;
      }
      let browser = document.querySelector<HTMLDetailsElement>('.sl-project-slr-browser');
      if (!browser) {
        browser = document.createElement('details');
        browser.className = 'sl-project-slr-browser';
        browser.open = true;
        templateBar.before(browser);
      }
      const findingNumbers = new Set(findingsRef.current.map((item) => item.display_number));
      const unsubmittedDrafts = draftsRef.current.filter((draft) => !findingNumbers.has(draft.display_number));
      const draftByNumber = new Map(draftsRef.current.map((draft) => [draft.display_number, draft]));
      const signature = [
        ...findingsRef.current.map((item) => `F:${item.id}:${item.display_number}:${item.scope_item}:${item.status}:${draftByNumber.has(item.display_number) ? 'draft' : ''}`),
        ...unsubmittedDrafts.map((item) => `D:${item.id}:${item.display_number}:${item.legacy_uid}:${item.saved_at}:${clean(item.draft_data?.issue?.title)}`),
      ].join('|');
      if (browser.dataset.signature === signature) return;
      browser.dataset.signature = signature;
      browser.replaceChildren();

      const summary = document.createElement('summary');
      const summaryLabel = document.createElement('span');
      summaryLabel.textContent = 'Project SLRs';
      const count = document.createElement('b');
      count.textContent = String(findingsRef.current.length + unsubmittedDrafts.length);
      const hint = document.createElement('small');
      hint.textContent = 'Expand / collapse';
      summary.append(summaryLabel, count, hint);
      browser.appendChild(summary);

      const list = document.createElement('div');
      list.className = 'sl-project-slr-browser-list';
      findingsRef.current.forEach((finding) => {
        const savedDraft = draftByNumber.get(finding.display_number);
        const button = document.createElement('button');
        button.type = 'button';
        const number = document.createElement('b');
        number.textContent = finding.display_number;
        const title = document.createElement('span');
        title.textContent = finding.scope_item || 'Untitled SLR';
        const status = document.createElement('small');
        status.textContent = savedDraft ? 'Saved Draft' : (finding.status || 'Open');
        button.append(number, title, status);
        button.addEventListener('click', () => {
          if (openSlr(finding.display_number)) browser!.open = false;
        });
        list.appendChild(button);
      });
      unsubmittedDrafts.forEach((draft) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.cloudDraft = draft.legacy_uid;
        const number = document.createElement('b');
        number.textContent = draft.display_number || clean(draft.draft_data?.issue?.id) || 'Draft';
        const title = document.createElement('span');
        title.textContent = clean(draft.draft_data?.issue?.title) || 'Saved unsubmitted SLR';
        const status = document.createElement('small');
        status.textContent = 'Saved Draft';
        button.append(number, title, status);
        button.addEventListener('click', () => {
          if (openCloudDraft(draft)) browser!.open = false;
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
      const sidebarButton = target?.closest<HTMLButtonElement>('aside.sidebar .nav-group > button');
      if (sidebarButton && clean(sidebarButton.textContent) === 'Project Library') {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign('/project-library');
        return;
      }

      const deleteButton = target?.closest<HTMLButtonElement>('.sl-review-note-delete');
      if (deleteButton) {
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
          lastLoadRef.current = 0;
          await apply(true);
          window.dispatchEvent(new Event('focus'));
        });
      }
    };

    const forceRefresh = () => { lastLoadRef.current = 0; schedule(true); };
    const mutationRefresh = () => {
      const signature = Array.from(document.querySelectorAll<HTMLButtonElement>('.submitted-slr-list > button')).map((button) => clean(button.querySelector('b')?.textContent)).join('|');
      if (signature !== submittedSignatureRef.current) {
        submittedSignatureRef.current = signature;
        forceRefresh();
      } else {
        schedule(false);
      }
    };

    schedule(true);
    const observer = new MutationObserver(mutationRefresh);
    observer.observe(document.body, { childList: true, subtree: true });
    const focus = () => forceRefresh();
    window.addEventListener('focus', focus);
    window.addEventListener('scopelogic:slr-changed', forceRefresh as EventListener);
    window.addEventListener('scopelogic:slr-draft-saved', forceRefresh as EventListener);
    document.addEventListener('click', clickCapture, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('focus', focus);
      window.removeEventListener('scopelogic:slr-changed', forceRefresh as EventListener);
      window.removeEventListener('scopelogic:slr-draft-saved', forceRefresh as EventListener);
      document.removeEventListener('click', clickCapture, true);
      document.querySelector('.sl-project-slr-browser')?.remove();
    };
  }, [supabase]);

  return null;
}
