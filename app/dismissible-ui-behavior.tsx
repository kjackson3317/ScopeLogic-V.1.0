'use client';

import { useEffect } from 'react';

const buttonWithText = (root: Element, labels: string[]) => Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((button) => labels.includes(button.textContent?.trim() || ''));

export default function DismissibleUiBehavior() {
  useEffect(() => {
    let showArchivedProjects = false;
    let projectLibraryWasVisible = false;
    let archiveToggleButton: HTMLButtonElement | null = null;

    const syncArchivedProjectVisibility = () => {
      const projectTable = document.querySelector<HTMLElement>('.project-list-table');
      const projectHeading = document.querySelector<HTMLElement>('.project-list-heading');

      if (!projectTable || !projectHeading) {
        if (projectLibraryWasVisible) showArchivedProjects = false;
        projectLibraryWasVisible = false;
        archiveToggleButton = null;
        return;
      }

      projectLibraryWasVisible = true;
      const projectRows = Array.from(projectTable.querySelectorAll<HTMLButtonElement>('.project-list-row:not(.head)'));
      const archivedRows = projectRows.filter((row) => {
        const statusCell = Array.from(row.children)[3] as HTMLElement | undefined;
        return statusCell?.querySelector('i')?.textContent?.trim().toLowerCase() === 'archived';
      });

      archivedRows.forEach((row) => {
        row.hidden = !showArchivedProjects;
        row.setAttribute('aria-hidden', showArchivedProjects ? 'false' : 'true');
      });

      if (!archiveToggleButton || !archiveToggleButton.isConnected) {
        archiveToggleButton = document.createElement('button');
        archiveToggleButton.type = 'button';
        archiveToggleButton.className = 'secondary project-library-archive-toggle';
        archiveToggleButton.addEventListener('click', () => {
          showArchivedProjects = !showArchivedProjects;
          syncArchivedProjectVisibility();
        });
        const searchField = projectHeading.querySelector('.project-library-search');
        if (searchField) searchField.insertAdjacentElement('afterend', archiveToggleButton);
        else projectHeading.appendChild(archiveToggleButton);
      }

      const label = showArchivedProjects ? `Hide Archived (${archivedRows.length})` : `Show Archived (${archivedRows.length})`;
      if (archiveToggleButton.textContent !== label) archiveToggleButton.textContent = label;
      archiveToggleButton.hidden = archivedRows.length === 0;
    };

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

    const observer = new MutationObserver(syncArchivedProjectVisibility);
    observer.observe(document.body, { childList: true, subtree: true });
    syncArchivedProjectVisibility();

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      observer.disconnect();
      archiveToggleButton?.remove();
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return null;
}
