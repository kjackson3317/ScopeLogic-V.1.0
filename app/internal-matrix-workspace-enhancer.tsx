'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const COLLAPSE_KEY = 'scopelogic:submitted-slr-list-collapsed';
type Targets = { pageHead: HTMLElement; actionTarget: HTMLElement; toolbar: HTMLElement; submittedList: HTMLElement };

function sourceButton(selector: string) {
  return document.querySelector<HTMLButtonElement>(selector);
}

function findTargets(): Targets | null {
  const pageHead = Array.from(document.querySelectorAll<HTMLElement>('.page-head')).find((node) =>
    node.querySelector('h1')?.textContent?.trim() === 'ScopeLogic Internal Matrix'
  ) || null;
  const actionTarget = pageHead?.querySelector<HTMLElement>(':scope > .button-row') || null;
  const toolbar = document.querySelector<HTMLElement>('.matrix-toolbar.matrix-toolbar-bottom');
  const submittedList = document.querySelector<HTMLElement>('.submitted-slr-list');
  return pageHead && actionTarget && toolbar && submittedList ? { pageHead, actionTarget, toolbar, submittedList } : null;
}

export default function InternalMatrixWorkspaceEnhancer() {
  const [targets, setTargets] = useState<Targets | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [sourceRevision, setSourceRevision] = useState(0);

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
          if (next && current && next.pageHead === current.pageHead && next.actionTarget === current.actionTarget && next.toolbar === current.toolbar && next.submittedList === current.submittedList) return current;
          return next;
        });
        setSourceRevision((value) => value + 1);
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

  const proxy = useCallback((selector: string) => {
    const source = sourceButton(selector);
    if (source && !source.disabled) source.click();
  }, []);

  if (!targets) return null;

  const save = sourceButton('.matrix-editor-full .sl-approved-save');
  const submit = sourceButton('.matrix-editor-full .sl-approved-submit');
  const template = sourceButton('.matrix-editor-full .sl-approved-template');
  void sourceRevision;

  return <>
    {createPortal(
      <div className="slr-persistent-workflow-actions" data-slr-workspace-enhancer="actions">
        <button type="button" className="secondary slr-persistent-save" disabled={!save || save.disabled} onClick={() => proxy('.matrix-editor-full .sl-approved-save')}>Save SLR</button>
        <button type="button" className="primary slr-persistent-submit" disabled={!submit || submit.disabled} onClick={() => proxy('.matrix-editor-full .sl-approved-submit')}>Submit Entry</button>
        <button type="button" className="secondary slr-persistent-template" disabled={!template || template.disabled} onClick={() => proxy('.matrix-editor-full .sl-approved-template')}>SLR as Template</button>
      </div>,
      targets.actionTarget,
    )}
    {createPortal(
      <button
        type="button"
        className="secondary submitted-slr-collapse-button"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        {collapsed ? 'Expand SLR List' : 'Collapse SLR List'}
      </button>,
      targets.toolbar,
    )}
  </>;
}
