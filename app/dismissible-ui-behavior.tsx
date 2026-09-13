'use client';

import { useEffect } from 'react';

const buttonWithText = (root: Element, labels: string[]) => Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => labels.includes(button.textContent?.trim() || ''));

export default function DismissibleUiBehavior() {
  useEffect(() => {
    const closeCustomMenusOutside = (target: Node) => {
      document.querySelectorAll<HTMLElement>('.multiselect-field').forEach((field) => {
        if (!field.querySelector('.multiselect-menu') || field.contains(target)) return;
        field.querySelector<HTMLButtonElement>('.multiselect-trigger')?.click();
      });

      const mobileActions = document.querySelector<HTMLElement>('.mobile-actions-wrap');
      if (mobileActions?.querySelector('.mobile-actions-menu') && !mobileActions.contains(target)) {
        mobileActions.querySelector<HTMLButtonElement>('.mobile-actions-button')?.click();
      }
    };

    const dismissBackdrop = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (!target.matches('.dialog-backdrop, .modal')) return false;

      // Only dismiss overlays that already expose an explicit Close or Cancel action.
      // A future required/blocking step without a dismiss control therefore stays open.
      const dismiss = buttonWithText(target, ['Close']) || buttonWithText(target, ['Cancel']);
      if (!dismiss || dismiss.disabled) return false;
      dismiss.click();
      return true;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      closeCustomMenusOutside(event.target);
      dismissBackdrop(event.target);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const openMenu = Array.from(document.querySelectorAll<HTMLElement>('.multiselect-field')).find((field) => field.querySelector('.multiselect-menu'));
      if (openMenu) {
        openMenu.querySelector<HTMLButtonElement>('.multiselect-trigger')?.click();
        return;
      }

      const mobileActions = document.querySelector<HTMLElement>('.mobile-actions-wrap');
      if (mobileActions?.querySelector('.mobile-actions-menu')) {
        mobileActions.querySelector<HTMLButtonElement>('.mobile-actions-button')?.click();
        return;
      }

      const overlays = Array.from(document.querySelectorAll<HTMLElement>('.dialog-backdrop, .modal'));
      const topmost = overlays.at(-1);
      if (!topmost) return;
      const dismiss = buttonWithText(topmost, ['Close']) || buttonWithText(topmost, ['Cancel']);
      if (dismiss && !dismiss.disabled) dismiss.click();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return null;
}
