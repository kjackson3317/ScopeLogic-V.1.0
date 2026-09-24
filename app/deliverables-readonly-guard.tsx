'use client';

import { useEffect } from 'react';

export default function DeliverablesReadOnlyGuard() {
  useEffect(() => {
    const apply = () => {
      const active =
        /^\/master-projects\/[^/]+\/deliverables\/?$/.test(
          window.location.pathname
        );

      document.body.classList.toggle(
        'sl-deliverables-readonly-page',
        active
      );

      if (!active) return;

      document
        .querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >('main input, main textarea, main select')
        .forEach((control) => {
          control.disabled = true;
        });

      document
        .querySelectorAll<HTMLButtonElement>('main button')
        .forEach((button) => {
          const label = (button.textContent || '').trim();

          if (
            /^(Add|Edit|Delete|Save)/i.test(label) &&
            !/Print \/ Save PDF/i.test(label)
          ) {
            button.hidden = true;
            button.disabled = true;
          }
        });
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      document.body.classList.remove(
        'sl-deliverables-readonly-page'
      );
    };
  }, []);

  return null;
}
