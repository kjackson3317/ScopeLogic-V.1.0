'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const COLLAPSE_KEY = 'scopelogic:submitted-slr-list-collapsed';

function sourceButton(selector: string) {
  return document.querySelector<HTMLButtonElement>(selector);
}

export default function InternalMatrixWorkspaceEnhancer() {
  const [revision, setRevision] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.sessionStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setRevision((value) => value + 1));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const pageHead = Array.from(document.querySelectorAll<HTMLElement>('.page-head')).find((node) =>
    node.querySelector('h1')?.textContent?.trim() === 'ScopeLogic Internal Matrix'
  ) || null;
  const actionTarget = pageHead?.querySelector<HTMLElement>(':scope > .button-row') || null;
  const toolbar = document.querySelector<HTMLElement>('.matrix-toolbar.matrix-toolbar-bottom');
  const submittedList = document.querySelector<HTMLElement>('.submitted-slr-list');

  useEffect(() => {
    if (!pageHead) return;
    pageHead.classList.add('slr-sticky-page-head');
    return () => pageHead.classList.remove('slr-sticky-page-head');
  }, [pageHead, revision]);

  useEffect(() => {
    if (!submittedList) return;
    submittedList.classList.toggle('slr-list-collapsed', collapsed);
    try {
      window.sessionStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Session preference is optional; the UI still works without storage.
    }
  }, [submittedList, collapsed, revision]);

  const proxy = useCallback((selector: string) => {
    const source = sourceButton(selector);
    if (source && !source.disabled) source.click();
  }, []);

  if (!pageHead || !actionTarget || !toolbar || !submittedList) return null;

  const save = sourceButton('.matrix-editor-full .sl-approved-save');
  const submit = sourceButton('.matrix-editor-full .sl-approved-submit');
  const template = sourceButton('.matrix-editor-full .sl-approved-template');

  return <>
    {createPortal(
      <div className="slr-persistent-workflow-actions" data-slr-workspace-enhancer="actions">
        <button type="button" className="secondary slr-persistent-save" disabled={!save || save.disabled} onClick={() => proxy('.matrix-editor-full .sl-approved-save')}>Save SLR</button>
        <button type="button" className="primary slr-persistent-submit" disabled={!submit || submit.disabled} onClick={() => proxy('.matrix-editor-full .sl-approved-submit')}>Submit Entry</button>
        <button type="button" className="secondary slr-persistent-template" disabled={!template || template.disabled} onClick={() => proxy('.matrix-editor-full .sl-approved-template')}>SLR as Template</button>
      </div>,
      actionTarget,
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
      toolbar,
    )}
  </>;
}
