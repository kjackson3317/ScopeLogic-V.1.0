'use client';

import { useEffect } from 'react';

const sectionState = new Map<string, boolean>();

function currentSlrId() {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('.matrix-editor-full label.field'));
  const target = labels.find((label) => label.querySelector('span')?.textContent?.trim() === 'SLR ID');
  return target?.querySelector<HTMLInputElement>('input')?.value?.trim() || 'current';
}

function sectionType(node: HTMLElement) {
  const label = (node.textContent || '').trim();
  if (label.startsWith('GC Clarifications')) return 'CL';
  if (label.startsWith('VE Opportunities')) return 'VE';
  return '';
}

function stateKey(node: HTMLElement) {
  const type = sectionType(node);
  return type ? `${currentSlrId()}:${type}` : '';
}

function setSectionVisibility(node: HTMLElement) {
  const type = sectionType(node);
  if (!type) return;

  node.dataset.slSectionType = type;
  node.setAttribute('role', 'button');
  node.setAttribute('tabindex', '0');
  node.setAttribute('title', `Click to ${sectionState.get(stateKey(node)) ? 'expand' : 'collapse'} this section`);

  const collapsed = sectionState.get(stateKey(node)) || false;
  node.setAttribute('aria-expanded', String(!collapsed));

  let sibling = node.nextElementSibling as HTMLElement | null;
  while (sibling && !sibling.classList.contains('sl-slr-subhead')) {
    if (sibling.classList.contains('sl-slr-deliverable-card')) {
      sibling.hidden = collapsed;
    }
    sibling = sibling.nextElementSibling as HTMLElement | null;
  }
}

function moveSlrDeliverablesToBottom() {
  const editor = document.querySelector<HTMLElement>('.matrix-editor-full');
  if (!editor) return;

  const host = editor.querySelector<HTMLElement>('.sl-slr-deliverables-host');
  const submitBar = editor.querySelector<HTMLElement>('.submit-bar');
  if (!host || !submitBar) return;

  if (submitBar.nextElementSibling !== host) {
    submitBar.after(host);
  }

  host.querySelectorAll<HTMLElement>('.sl-slr-subhead').forEach(setSectionVisibility);
}

function clarifyReviewNoteSlrLabels() {
  document.querySelectorAll<HTMLElement>('.sl-review-modal .sl-review-edit-grid label > span').forEach((label) => {
    if (label.textContent?.trim() === 'Scope Item') {
      label.textContent = 'Topic / Scope Item';
    }
  });
}

function apply() {
  moveSlrDeliverablesToBottom();
  clarifyReviewNoteSlrLabels();
}

export default function SlrReviewUpdateBehavior() {
  useEffect(() => {
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        apply();
      });
    };

    const toggle = (target: EventTarget | null) => {
      const node = target instanceof Element ? target.closest<HTMLElement>('.sl-slr-subhead') : null;
      if (!node || !document.querySelector('.matrix-editor-full')?.contains(node)) return false;
      const key = stateKey(node);
      if (!key) return false;
      sectionState.set(key, !(sectionState.get(key) || false));
      setSectionVisibility(node);
      return true;
    };

    const click = (event: MouseEvent) => {
      if (toggle(event.target)) event.preventDefault();
    };

    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (toggle(event.target)) event.preventDefault();
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', click);
    document.addEventListener('keydown', keydown);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', click);
      document.removeEventListener('keydown', keydown);
    };
  }, []);

  return null;
}
