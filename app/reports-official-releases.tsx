'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '../lib/supabase/client';

type Engagement = { id: string; client_name: string; legacy_id: string };
type ReleaseRow = {
  id: string;
  project_id: string;
  revision: string;
  lifecycle_status: string;
  release_number: number;
  filename: string;
  storage_path: string;
  released_at: string;
};
type DisplayRelease = ReleaseRow & { engagement: string };

function masterProjectIdFromPath() {
  return window.location.pathname.match(/^\/master-projects\/([^/]+)\/deliverables\/?$/)?.[1] || '';
}

function reportsHost() {
  const reportTitle = Array.from(document.querySelectorAll<HTMLElement>('h1,h2')).find((item) => /Bid Alignment Report/i.test(item.textContent || ''));
  return reportTitle?.parentElement?.parentElement || null;
}

export default function ReportsOfficialReleases() {
  const supabase = useMemo(() => createClient(), []);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [releases, setReleases] = useState<DisplayRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let frame = 0;
    const refreshHost = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setHost(reportsHost()));
    };
    refreshHost();
    const observer = new MutationObserver(refreshHost);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', refreshHost);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('popstate', refreshHost);
    };
  }, []);

  const load = useCallback(async () => {
    const masterProjectId = masterProjectIdFromPath();
    if (!masterProjectId || !host) return;
    setLoading(true);
    setError('');
    const engagementsResult = await supabase
      .from('projects')
      .select('id,client_name,legacy_id')
      .eq('master_project_id', masterProjectId)
      .order('client_name');
    if (engagementsResult.error) {
      setLoading(false);
      setError(engagementsResult.error.message);
      return;
    }
    const engagements = (engagementsResult.data || []) as Engagement[];
    if (!engagements.length) {
      setReleases([]);
      setLoading(false);
      return;
    }
    const engagementById = new Map(engagements.map((item) => [item.id, item.client_name || item.legacy_id || 'Client Engagement']));
    const releasesResult = await supabase
      .from('release_packages')
      .select('id,project_id,revision,lifecycle_status,release_number,filename,storage_path,released_at')
      .in('project_id', engagements.map((item) => item.id))
      .eq('document_key', 'project-package')
      .order('released_at', { ascending: false });
    setLoading(false);
    if (releasesResult.error) {
      setError(releasesResult.error.message);
      return;
    }
    setReleases(((releasesResult.data || []) as ReleaseRow[]).map((row) => ({ ...row, engagement: engagementById.get(row.project_id) || 'Client Engagement' })));
  }, [host, supabase]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener('scopelogic:official-release-created', refresh);
    return () => window.removeEventListener('scopelogic:official-release-created', refresh);
  }, [load]);

  const openRelease = async (release: DisplayRelease, download: boolean) => {
    try {
      const result = await supabase.storage.from('project-files').createSignedUrl(
        release.storage_path,
        60 * 30,
        download ? { download: true } : undefined,
      );
      if (result.error) throw result.error;
      if (!result.data?.signedUrl) throw new Error('The archived release link could not be created.');
      if (download) {
        const anchor = document.createElement('a');
        anchor.href = result.data.signedUrl;
        anchor.download = release.filename;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else {
        window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The archived release could not be opened.');
    }
  };

  if (!host) return null;

  return createPortal(
    <section className="sl-reports-release-archive" aria-label="Official Releases">
      <div className="sl-reports-release-head">
        <div><span>OFFICIAL RELEASE ARCHIVE</span><h2>Official Releases</h2><p>Immutable project-package releases generated for this Master Project and its Client Engagements.</p></div>
        <button type="button" className="secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error ? <div className="sl-reports-release-error">{error}</div> : null}
      <div className="sl-reports-release-table">
        <div className="sl-reports-release-row sl-reports-release-header"><span>Release</span><span>Client Engagement</span><span>Revision</span><span>Generated</span><span>Status</span><span>File</span><span>Actions</span></div>
        {releases.map((release) => <div className="sl-reports-release-row" key={release.id}>
          <span><b>Release {String(release.release_number).padStart(3, '0')}</b></span>
          <span>{release.engagement}</span>
          <span>{release.revision || '—'}</span>
          <span>{release.released_at ? new Date(release.released_at).toLocaleString() : '—'}</span>
          <span><em className={`sl-release-status ${release.lifecycle_status === 'Superseded' ? 'superseded' : 'current'}`}>{release.lifecycle_status || 'Current'}</em></span>
          <span className="sl-reports-release-file" title={release.filename}>{release.filename}</span>
          <span className="sl-reports-release-actions"><button type="button" onClick={() => void openRelease(release, false)}>Open</button><button type="button" onClick={() => void openRelease(release, true)}>Download</button></span>
        </div>)}
        {!loading && !releases.length ? <div className="sl-reports-release-empty">No official project-package releases have been generated for this Master Project yet.</div> : null}
        {loading && !releases.length ? <div className="sl-reports-release-empty">Loading official releases…</div> : null}
      </div>
    </section>,
    host,
  );
}
