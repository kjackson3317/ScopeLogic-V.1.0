'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import { getNextOfficialReleaseNumber, saveOfficialRelease } from '../lib/cloud-workspace';
import {
  REVIEW_RELEASE_OPTIONS,
  buildReviewReleasePdf,
  reviewReleaseFileName,
  type ReviewReleaseAction,
  type ReviewReleaseBid,
  type ReviewReleaseChecklist,
  type ReviewReleaseData,
  type ReviewReleaseFinding,
  type ReviewReleaseKind,
  type ReviewReleaseMaster,
} from './review-release-pdf';

type Engagement = {
  legacyId: string;
  label: string;
};

type DialogIntent = 'preview' | 'official';

type Loaded = {
  masterId: string;
  data: ReviewReleaseData;
  engagements: Engagement[];
  activeLegacyId: string;
};

const LOCAL_WORKSPACE_KEYS = [
  'scopelogic-r14-8',
  'scopelogic-r14-7',
  'scopelogic-r14-6',
  'scopelogic-r14-5',
  'scopelogic-r14-4',
  'scopelogic-r14-3',
  'scopelogic-r14-2',
  'technology-preconstruction-workspace',
];

const allKinds = REVIEW_RELEASE_OPTIONS.map((item) => item.kind);

function activeLegacyProjectId() {
  if (typeof window === 'undefined') return '';
  for (const key of LOCAL_WORKSPACE_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { projectId?: string };
      if (parsed.projectId) return String(parsed.projectId);
    } catch {
      // Continue to older recovery keys.
    }
  }
  return '';
}

async function resolveMasterId(supabase: any) {
  const pathId = window.location.pathname.match(/^\/master-projects\/([^/]+)/)?.[1] || '';
  if (pathId) return pathId;
  const legacyId = activeLegacyProjectId();
  if (!legacyId) return '';
  const result = await supabase.from('projects').select('master_project_id').eq('legacy_id', legacyId).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return String(result.data?.master_project_id || '');
}

function bytesToBlob(bytes: Uint8Array<ArrayBufferLike>) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: 'application/pdf' });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export default function ReviewReleaseController() {
  const supabase = useMemo(() => createClient() as any, []);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<DialogIntent>('preview');
  const [selected, setSelected] = useState<ReviewReleaseKind[]>(allKinds);
  const [notes, setNotes] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selectedEngagement, setSelectedEngagement] = useState('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const masterId = await resolveMasterId(supabase);
      if (!masterId) throw new Error('No active Master Project could be resolved. Open a Master Project or one of its client engagements and try again.');
      const [master, findings, actions, checklist, bids, projects] = await Promise.all([
        supabase.from('master_projects').select('id,project_number,name,location,status,revision,version_date').eq('id', masterId).maybeSingle(),
        supabase.from('master_project_findings').select('id,display_number,scope_item,systems,status').eq('master_project_id', masterId).order('sequence_number'),
        supabase.from('master_project_deliverable_items').select('*').eq('master_project_id', masterId).order('deliverable_type').order('sequence_number'),
        supabase.from('master_project_checklist_items').select('*').eq('master_project_id', masterId).order('sequence_number'),
        supabase.from('master_project_bid_alignment_items').select('*').eq('master_project_id', masterId).order('bidder_name').order('sort_order'),
        supabase.from('projects').select('legacy_id,client_name,engagement_type,engagement_label').eq('master_project_id', masterId),
      ]);
      const failure = master.error || findings.error || actions.error || checklist.error || bids.error || projects.error;
      if (failure) throw new Error(failure.message || 'Current review deliverable data could not be loaded.');
      if (!master.data) throw new Error('The active Master Project is not available.');

      const data: ReviewReleaseData = {
        master: master.data as ReviewReleaseMaster,
        findings: (findings.data || []).map((item: any) => ({ ...item, systems: Array.isArray(item.systems) ? item.systems : [] })) as ReviewReleaseFinding[],
        actions: (actions.data || []) as ReviewReleaseAction[],
        checklist: (checklist.data || []) as ReviewReleaseChecklist[],
        bids: (bids.data || []) as ReviewReleaseBid[],
      };
      const engagements = (projects.data || []).filter((item: any) => item.legacy_id).map((item: any): Engagement => ({
        legacyId: String(item.legacy_id),
        label: String(item.engagement_label || item.client_name || item.engagement_type || item.legacy_id),
      }));
      const activeLegacyId = activeLegacyProjectId();
      const preferred = engagements.some((item) => item.legacyId === activeLegacyId)
        ? activeLegacyId
        : engagements.length === 1
          ? engagements[0].legacyId
          : '';
      setLoaded({ masterId, data, engagements, activeLegacyId });
      setSelectedEngagement(preferred);
    } catch (cause) {
      setLoaded(null);
      setError(cause instanceof Error ? cause.message : 'Current review deliverable data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const showDialog = useCallback((nextIntent: DialogIntent) => {
    setIntent(nextIntent);
    setSelected(allKinds);
    setNotes('');
    setError('');
    setMessage('');
    setOpen(true);
    void load();
  }, [load]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const control = target?.closest<HTMLElement>('button,a');
      if (!control) return;

      const explicit = control.dataset.reviewReleaseTrigger as DialogIntent | undefined;
      if (explicit === 'preview' || explicit === 'official') {
        event.preventDefault();
        event.stopImmediatePropagation();
        showDialog(explicit);
        return;
      }

      if (control.dataset.reviewReleaseOwned === 'true') return;
      const label = (control.textContent || '').trim();
      if (/^Generate Official (GC )?Release$/i.test(label)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showDialog('official');
      }
    };

    const installControls = () => {
      if (/^\/master-projects\/[^/]+\/deliverables\/?$/.test(window.location.pathname)) {
        const topbar = document.querySelector<HTMLElement>('header');
        const printButton = topbar ? Array.from(topbar.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Print / Save PDF') : undefined;
        if (printButton) {
          printButton.textContent = 'Download PDF Preview';
          printButton.dataset.reviewReleaseTrigger = 'preview';
          if (!topbar?.querySelector('[data-review-release-injected="official"]')) {
            const official = document.createElement('button');
            official.type = 'button';
            official.className = 'review-release-quick-official';
            official.textContent = 'Generate Official Release';
            official.dataset.reviewReleaseTrigger = 'official';
            official.dataset.reviewReleaseInjected = 'official';
            printButton.after(official);
          }
        }
      }

      document.querySelectorAll<HTMLElement>('.sl-deliverable-preview .sl-preview-actions').forEach((actions) => {
        if (!actions.querySelector('[data-review-release-injected="preview"]')) {
          const preview = document.createElement('button');
          preview.type = 'button';
          preview.textContent = 'Download PDF Preview';
          preview.dataset.reviewReleaseTrigger = 'preview';
          preview.dataset.reviewReleaseInjected = 'preview';
          actions.prepend(preview);
        }
        if (!actions.querySelector('[data-review-release-injected="official"]')) {
          const official = document.createElement('button');
          official.type = 'button';
          official.textContent = 'Generate Official Release';
          official.className = 'primary';
          official.dataset.reviewReleaseTrigger = 'official';
          official.dataset.reviewReleaseInjected = 'official';
          actions.prepend(official);
        }
      });
    };

    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        installControls();
      });
    };
    document.addEventListener('click', onClick, true);
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener('click', onClick, true);
      observer.disconnect();
    };
  }, [showDialog]);

  const toggle = (kind: ReviewReleaseKind) => setSelected((current) => current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]);

  const createPreview = async () => {
    if (!loaded || !selected.length) return;
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const bytes = await buildReviewReleasePdf({ data: loaded.data, kinds: selected, notes, mode: 'preview' });
      const blob = bytesToBlob(bytes);
      downloadBlob(blob, reviewReleaseFileName(loaded.data.master, 'preview'));
      setMessage('PDF preview downloaded. No release was created, numbered, archived, or locked.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The PDF preview could not be generated.');
    } finally {
      setWorking(false);
    }
  };

  const createOfficial = async () => {
    if (!loaded || !selected.length) return;
    if (!selectedEngagement) {
      setError('Choose the client engagement that should own the immutable release archive.');
      return;
    }
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const releaseNumber = await getNextOfficialReleaseNumber(selectedEngagement);
      const bytes = await buildReviewReleasePdf({ data: loaded.data, kinds: selected, notes, mode: 'official', releaseNumber });
      const blob = bytesToBlob(bytes);
      const fileName = reviewReleaseFileName(loaded.data.master, 'official', releaseNumber);
      const snapshot = {
        applicationVersion: '1.0.0-rc.5.6.0',
        documentType: 'master-project-review-release',
        releaseNumber,
        createdAt: new Date().toISOString(),
        masterProjectId: loaded.masterId,
        master: loaded.data.master,
        findings: loaded.data.findings,
        actions: loaded.data.actions,
        checklist: loaded.data.checklist,
        bids: loaded.data.bids,
        deliverables: selected,
        releaseNotes: notes,
      };
      const archived = await saveOfficialRelease(
        selectedEngagement,
        loaded.data.master.revision || 'Rev 0',
        loaded.data.master.version_date || '',
        fileName,
        notes,
        selected,
        blob,
        snapshot,
      );
      downloadBlob(blob, fileName);
      setMessage(`Official Release ${String(archived.releaseNumber || releaseNumber).padStart(3, '0')} was archived as an immutable record and downloaded.`);
      window.dispatchEvent(new CustomEvent('scopelogic:official-release-created', { detail: { releaseNumber: archived.releaseNumber || releaseNumber } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The official review release could not be generated.');
    } finally {
      setWorking(false);
    }
  };

  if (!open) return null;
  const engagementRequired = Boolean(loaded && loaded.engagements.length > 1 && !selectedEngagement);

  return <div className="review-release-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) setOpen(false); }}>
    <section className="review-release-dialog" role="dialog" aria-modal="true" aria-label="Review deliverable PDF release">
      <header>
        <div><span>MASTER PROJECT DELIVERABLES</span><h2>{intent === 'official' ? 'Generate Official Release' : 'Download PDF Preview'}</h2><p>{loaded ? `${loaded.data.master.project_number} · ${loaded.data.master.name}` : 'Loading current project…'}</p></div>
        <button type="button" data-review-release-owned="true" disabled={working} onClick={() => setOpen(false)}>Close</button>
      </header>

      {loading ? <div className="review-release-state">Loading the current Master Project deliverables…</div> : null}
      {error ? <div className="review-release-error">{error}<button type="button" data-review-release-owned="true" onClick={() => setError('')}>×</button></div> : null}
      {message ? <div className="review-release-message">{message}<button type="button" data-review-release-owned="true" onClick={() => setMessage('')}>×</button></div> : null}

      {loaded && !loading ? <div className="review-release-body">
        <div className="review-release-selection-head"><div><b>Client Deliverables</b><small>Select the documents to combine into this PDF.</small></div><div><button type="button" data-review-release-owned="true" onClick={() => setSelected(allKinds)}>Select All</button><button type="button" data-review-release-owned="true" onClick={() => setSelected([])}>Clear All</button></div></div>
        <div className="review-release-options">
          {REVIEW_RELEASE_OPTIONS.map((item) => <label key={item.kind} className={selected.includes(item.kind) ? 'selected' : ''}><input type="checkbox" checked={selected.includes(item.kind)} onChange={() => toggle(item.kind)} /><span><b>{item.label}</b>{item.kind === 'clarification-log' ? <small>Includes GC Clarifications and RFIs in one log.</small> : item.kind === 'bid-report' ? <small>Uses documented bidder adjustments only; missing pricing remains Unpriced.</small> : null}</span></label>)}
        </div>

        {loaded.engagements.length ? <label className="review-release-field"><span>Official Release Archive</span><select value={selectedEngagement} onChange={(event) => setSelectedEngagement(event.target.value)}><option value="">Select client engagement…</option>{loaded.engagements.map((item) => <option key={item.legacyId} value={item.legacyId}>{item.label}</option>)}</select><small>{loaded.engagements.length === 1 ? 'This Master Project has one client engagement.' : 'Select which client engagement should own the immutable archive record. This does not change the PDF content.'}</small></label> : <div className="review-release-warning"><b>No client engagement is linked to this Master Project.</b><span>PDF Preview is available, but an official immutable release requires a linked client engagement.</span></div>}

        <label className="review-release-field"><span>Release Notes / Cover Note</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional note shown on the release cover…" /></label>
        <div className="review-release-behavior"><div><b>PDF Preview</b><span>Downloads a PDF only. It does not consume a release number, create an archive record, or lock anything.</span></div><div><b>Official Release</b><span>Creates the numbered immutable archive record, then downloads the exact archived PDF.</span></div></div>
      </div> : null}

      <footer>
        <span>{selected.length} of {REVIEW_RELEASE_OPTIONS.length} deliverables selected</span>
        <div><button type="button" data-review-release-owned="true" disabled={working} onClick={() => setOpen(false)}>Cancel</button><button type="button" data-review-release-owned="true" disabled={working || loading || !loaded || !selected.length} onClick={() => void createPreview()}>{working && intent === 'preview' ? 'Generating…' : 'Download PDF Preview'}</button><button type="button" data-review-release-owned="true" className="primary" disabled={working || loading || !loaded || !selected.length || !loaded.engagements.length || engagementRequired} onClick={() => void createOfficial()}>{working && intent === 'official' ? 'Generating…' : 'Generate Official Release'}</button></div>
      </footer>
    </section>
  </div>;
}
