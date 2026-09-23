'use client';

import { useEffect, useRef, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: string; kind: ToastKind; message: string };

type ToastEventDetail = { kind?: ToastKind; message?: string };

const ERROR_WORDS = /\b(error|failed|failure|could not|unable|unavailable|required|invalid|not available)\b/i;

function messageKind(message: string, preferred?: ToastKind): ToastKind {
  if (preferred) return preferred;
  return ERROR_WORDS.test(message) ? 'error' : 'success';
}

export default function ScopeLogicActionToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const recent = useRef(new Map<string, number>());

  useEffect(() => {
    const push = (message: string, preferred?: ToastKind) => {
      const clean = message.replace(/\s+/g, ' ').trim();
      if (!clean) return;
      const now = Date.now();
      const last = recent.current.get(clean) || 0;
      if (now - last < 1800) return;
      recent.current.set(clean, now);
      const id = crypto.randomUUID();
      const kind = messageKind(clean, preferred);
      setToasts((current) => [...current.slice(-3), { id, kind, message: clean }]);
      window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4300);
    };

    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastEventDetail>).detail || {};
      push(String(detail.message || ''), detail.kind);
    };

    const inspect = () => {
      document.querySelectorAll<HTMLElement>('.app-dialog:not([data-sl-toast-seen])').forEach((node) => {
        node.dataset.slToastSeen = 'true';
        const title = node.querySelector<HTMLElement>('.dialog-title b')?.textContent || '';
        const body = node.querySelector<HTMLElement>('p')?.textContent || '';
        push([title, body].filter(Boolean).join(': '));
      });
      document.querySelectorAll<HTMLElement>('.mp-popup:not([data-sl-toast-seen])').forEach((node) => {
        node.dataset.slToastSeen = 'true';
        const title = node.querySelector<HTMLElement>('h3')?.textContent || '';
        const body = node.querySelector<HTMLElement>('p')?.textContent || '';
        push([title, body].filter(Boolean).join(': '), node.classList.contains('error') ? 'error' : 'success');
      });
      document.querySelectorAll<HTMLElement>('.sl-review-workflow-message:not([data-sl-toast-seen])').forEach((node) => {
        node.dataset.slToastSeen = 'true';
        push(node.textContent || '', 'success');
      });
      document.querySelectorAll<HTMLElement>('.sl-review-workflow-error:not([data-sl-toast-seen])').forEach((node) => {
        node.dataset.slToastSeen = 'true';
        push(node.textContent || '', 'error');
      });
      document.querySelectorAll<HTMLElement>('.sl-slr-message:not([data-sl-toast-seen])').forEach((node) => {
        node.dataset.slToastSeen = 'true';
        push(node.textContent || '');
      });
      document.querySelectorAll<HTMLElement>('.error-box:not([data-sl-toast-seen])').forEach((node) => {
        node.dataset.slToastSeen = 'true';
        push(node.textContent || '', 'error');
      });
    };

    window.addEventListener('scopelogic:toast', onToast as EventListener);
    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scopelogic:toast', onToast as EventListener);
    };
  }, []);

  return <div className="sl-action-toast-stack" aria-live="polite" aria-atomic="false">
    {toasts.map((toast) => <button key={toast.id} type="button" className={`sl-action-toast ${toast.kind}`} onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
      <span>{toast.kind === 'error' ? '!' : toast.kind === 'success' ? '✓' : 'i'}</span>
      <b>{toast.message}</b>
    </button>)}
  </div>;
}
