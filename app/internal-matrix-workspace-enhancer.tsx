'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const COLLAPSE_KEY = 'scopelogic:submitted-slr-list-collapsed';
type Targets = { pageHead: HTMLElement; toolbar: HTMLElement; submittedList: HTMLElement };

function findTargets(): Targets | null {
  const pageHead = Array.from(document.querySelectorAll<HTMLElement>('.page-head')).find((node) =>
    node.querySelector('h1')?.textContent?.trim() === 'ScopeLogic Internal Matrix'
  ) || null;
  const toolbar = document.querySelector<HTMLElement>('.matrix-toolbar.matrix-toolbar-bottom');
  const submittedList = document.querySelector<HTMLElement>('.submitted-slr-list');
  return pageHead && toolbar && submittedList ? { pageHead, toolbar, submittedList } : null;
}

export default function InternalMatrixWorkspaceEnhancer() {
  const [targets, setTargets] = useState<Targets | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.sessionStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = findTargets();
        setTargets((current) => {
          if (!next && !current) return current;
          if (next && current && next.pageHead === current.pageHead && next.toolbar === current.toolbar && next.submittedList === current.submittedList) return current;
          return next;
        });
      });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!targets?.pageHead) return;
    targets.pageHead.classList.add('slr-sticky-page-head');
    return () => targets.pageHead.classList.remove('slr-sticky-page-head');
  }, [targets?.pageHead]);

  useEffect(() => {
    if (!targets?.submittedList) return;
    targets.submittedList.classList.toggle('slr-list-collapsed', collapsed);
    try {
      window.sessionStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Session preference is optional; the UI still works without storage.
    }
  }, [targets?.submittedList, collapsed]);

  if (!targets) return null;

  return createPortal(
    <button
      type="button"
      className="secondary submitted-slr-collapse-button"
      aria-expanded={!collapsed}
      onClick={() => setCollapsed((value) => !value)}
    >
      {collapsed ? 'Expand SLR List' : 'Collapse SLR List'}
    </button>,
    targets.toolbar,
  );
}
