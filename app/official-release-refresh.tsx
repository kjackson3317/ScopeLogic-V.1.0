'use client';

import { useEffect } from 'react';

/**
 * Review Deliverables creates project-package releases outside the legacy workspace tree.
 * The legacy Official Releases view loads its archive into local React state, so refresh the
 * current route after that external release event to prevent a stale Reports/Official Releases list.
 */
export default function OfficialReleaseRefresh() {
  useEffect(() => {
    let timer: ReturnType<typeof window.setTimeout> | null = null;
    const handleOfficialRelease = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => window.location.reload(), 450);
    };
    window.addEventListener('scopelogic:official-release-created', handleOfficialRelease);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('scopelogic:official-release-created', handleOfficialRelease);
    };
  }, []);
  return null;
}
