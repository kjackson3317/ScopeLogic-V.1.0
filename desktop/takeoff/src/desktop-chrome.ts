type ChromeCommand =
  | 'open'
  | 'select'
  | 'pan'
  | 'count'
  | 'calibrate'
  | 'distance'
  | 'polyline'
  | 'area'
  | 'perimeter'
  | 'text'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'cloud'
  | 'highlight'
  | 'freehand'
  | 'snippet'
  | 'previous-page'
  | 'next-page'
  | 'zoom-out'
  | 'zoom-in'
  | 'actual-size'
  | 'sync';

type MenuItem = { label: string; command?: ChromeCommand; divider?: boolean; shortcut?: string };

const COMMAND_MATCHERS: Array<{ command: ChromeCommand; test: (text: string, element: HTMLElement) => boolean; iconOnly?: boolean }> = [
  { command: 'open', test: (text, element) => element.classList.contains('file-button') || text === 'open pdf' },
  { command: 'select', test: (text) => text.includes('select'), iconOnly: true },
  { command: 'pan', test: (text) => text.includes('pan'), iconOnly: true },
  { command: 'count', test: (text) => text.includes('count'), iconOnly: true },
  { command: 'calibrate', test: (text) => text === 'calibrate', iconOnly: true },
  { command: 'distance', test: (text) => text === 'distance', iconOnly: true },
  { command: 'polyline', test: (text) => text === 'polyline', iconOnly: true },
  { command: 'area', test: (text) => text === 'area', iconOnly: true },
  { command: 'perimeter', test: (text) => text === 'perimeter', iconOnly: true },
  { command: 'text', test: (text) => text === 'text', iconOnly: true },
  { command: 'line', test: (text) => text === 'line', iconOnly: true },
  { command: 'arrow', test: (text) => text === 'arrow', iconOnly: true },
  { command: 'rectangle', test: (text) => text === 'box', iconOnly: true },
  { command: 'cloud', test: (text) => text === 'cloud', iconOnly: true },
  { command: 'highlight', test: (text) => text === 'highlight', iconOnly: true },
  { command: 'freehand', test: (text) => text === 'freehand', iconOnly: true },
  { command: 'snippet', test: (text) => text === 'snippet', iconOnly: true },
  { command: 'previous-page', test: (text) => text === '◀', iconOnly: true },
  { command: 'next-page', test: (text) => text === '▶', iconOnly: true },
  { command: 'zoom-out', test: (text) => text === '−', iconOnly: true },
  { command: 'zoom-in', test: (text) => text === '+', iconOnly: true },
  { command: 'actual-size', test: (text) => text === '100%' },
  { command: 'sync', test: (text) => text.includes('review sync') },
];

const MENUS: Record<string, MenuItem[]> = {
  File: [
    { label: 'Open PDF…', command: 'open', shortcut: 'Ctrl+O' },
  ],
  Edit: [
    { label: 'Select', command: 'select', shortcut: 'Esc' },
    { label: 'Delete Selected', shortcut: 'Delete' },
  ],
  View: [
    { label: 'Zoom In', command: 'zoom-in' },
    { label: 'Zoom Out', command: 'zoom-out' },
    { label: 'Actual Size', command: 'actual-size' },
  ],
  Document: [
    { label: 'Previous Page', command: 'previous-page' },
    { label: 'Next Page', command: 'next-page' },
  ],
  Tools: [
    { label: 'Select', command: 'select', shortcut: 'Esc' },
    { label: 'Pan', command: 'pan' },
    { label: 'Count', command: 'count' },
    { label: '', divider: true },
    { label: 'Calibrate', command: 'calibrate' },
    { label: 'Distance', command: 'distance' },
    { label: 'Polyline', command: 'polyline' },
    { label: 'Area', command: 'area' },
    { label: 'Perimeter', command: 'perimeter' },
  ],
  Window: [
    { label: 'Markups List' },
    { label: 'Properties' },
  ],
  Help: [
    { label: 'Keyboard: Esc = Select · Delete = Delete selected' },
  ],
};

function normalizedText(element: Element) {
  return (element.textContent || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function commandElement(command: ChromeCommand): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-command="${command}"]`);
}

function runCommand(command?: ChromeCommand) {
  if (!command) return;
  const target = commandElement(command);
  if (!target || target.hasAttribute('disabled')) return;
  if (command === 'open') {
    const input = target.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) input.click();
    else target.click();
    return;
  }
  target.click();
}

function runNamedAction(label: string) {
  if (label === 'Delete Selected') {
    const deleteButton = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => normalizedText(button).includes('delete selected'));
    deleteButton?.click();
    return;
  }
  if (label === 'Markups List') {
    const expand = document.querySelector<HTMLButtonElement>('.markups-list-expand');
    if (expand) expand.click();
    document.querySelector<HTMLElement>('.markups-list-dock')?.scrollIntoView({ block: 'end' });
    return;
  }
  if (label === 'Properties') {
    const tab = [...document.querySelectorAll<HTMLButtonElement>('.right-tabs button')]
      .find((button) => normalizedText(button).includes('properties'));
    tab?.click();
  }
}

function classifyCommandBar(shell: HTMLElement) {
  const commandBar = shell.querySelector<HTMLElement>('.command-bar');
  if (!commandBar) return;

  commandBar.querySelectorAll<HTMLElement>('button, label.button').forEach((element) => {
    const text = normalizedText(element);
    const match = COMMAND_MATCHERS.find((entry) => entry.test(text, element));
    if (!match) return;
    element.dataset.command = match.command;
    if (match.iconOnly) element.classList.add('command-icon-only');
    if (!element.getAttribute('title')) {
      const title = text.replace(/^[^a-z0-9]+/i, '').replace(/\b\w/g, (value) => value.toUpperCase());
      if (title) element.setAttribute('title', title);
    }
  });

  commandBar.querySelectorAll<HTMLElement>('.command-label').forEach((label) => {
    const value = normalizedText(label);
    if (value === 'markup' || value === 'scale') label.classList.add('toolbar-group-label');
  });
}

function createMenu(shell: HTMLElement) {
  if (shell.querySelector('.desktop-menu-bar')) return;
  const bar = document.createElement('nav');
  bar.className = 'desktop-menu-bar';
  bar.setAttribute('aria-label', 'Application menu');

  const menuGroup = document.createElement('div');
  menuGroup.className = 'desktop-menu-items';

  Object.entries(MENUS).forEach(([name, items]) => {
    const menu = document.createElement('div');
    menu.className = 'desktop-menu';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'desktop-menu-trigger';
    trigger.textContent = name;
    const panel = document.createElement('div');
    panel.className = 'desktop-menu-panel';

    items.forEach((item) => {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'desktop-menu-divider';
        panel.appendChild(divider);
        return;
      }
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'desktop-menu-action';
      action.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<kbd>${item.shortcut}</kbd>` : ''}`;
      action.addEventListener('click', () => {
        if (item.command) runCommand(item.command);
        else runNamedAction(item.label);
        menu.classList.remove('open');
      });
      panel.appendChild(action);
    });

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = !menu.classList.contains('open');
      bar.querySelectorAll('.desktop-menu.open').forEach((openMenu) => openMenu.classList.remove('open'));
      menu.classList.toggle('open', willOpen);
    });

    menu.append(trigger, panel);
    menuGroup.appendChild(menu);
  });

  const identity = document.createElement('div');
  identity.className = 'desktop-menu-identity';
  identity.innerHTML = '<span class="desktop-product-name">ScopeLogic Takeoff</span><span class="desktop-menu-sync"><i></i><b>Local</b></span>';

  bar.append(menuGroup, identity);
  shell.insertBefore(bar, shell.firstChild);

  document.addEventListener('click', () => {
    bar.querySelectorAll('.desktop-menu.open').forEach((menu) => menu.classList.remove('open'));
  });
}

function createDocumentTabs(shell: HTMLElement) {
  if (shell.querySelector('.desktop-document-tabs')) return;
  const workspace = shell.querySelector('.workspace-stack');
  if (!workspace) return;

  const tabs = document.createElement('div');
  tabs.className = 'desktop-document-tabs';
  tabs.innerHTML = `
    <button type="button" class="document-tab active" title="Current drawing set">
      <span class="document-tab-icon">PDF</span>
      <b>No drawing set open</b>
    </button>
    <span class="document-tabs-spacer"></span>
    <span class="document-tab-project">Takeoff Project</span>
  `;
  shell.insertBefore(tabs, workspace);
}

function updateChrome(shell: HTMLElement) {
  classifyCommandBar(shell);

  const sourceName = shell.querySelector<HTMLElement>('.project-strip b')?.textContent?.trim() || 'No drawing set open';
  const documentName = shell.querySelector<HTMLElement>('.document-tab b');
  if (documentName && documentName.textContent !== sourceName) documentName.textContent = sourceName;

  const sourceProject = shell.querySelector<HTMLElement>('.desktop-brand strong')?.textContent?.trim() || 'ScopeLogic';
  const projectLabel = shell.querySelector<HTMLElement>('.document-tab-project');
  if (projectLabel) projectLabel.textContent = sourceProject === 'ScopeLogic' ? 'Takeoff Project' : sourceProject;

  const syncText = shell.querySelector<HTMLElement>('.sync-state strong')?.textContent?.trim() || 'Local';
  const sync = shell.querySelector<HTMLElement>('.desktop-menu-sync b');
  if (sync) sync.textContent = syncText;
  const syncHost = shell.querySelector<HTMLElement>('.desktop-menu-sync');
  syncHost?.classList.toggle('warning', syncText.toLocaleLowerCase().includes('required'));
}

function enhanceShell(shell: HTMLElement) {
  if (!shell.classList.contains('chrome-enhanced')) shell.classList.add('chrome-enhanced');
  createMenu(shell);
  createDocumentTabs(shell);
  updateChrome(shell);
}

export function installDesktopChrome() {
  const attempt = () => {
    const shell = document.querySelector<HTMLElement>('.desktop-shell');
    if (!shell) return false;
    enhanceShell(shell);
    return true;
  };

  if (attempt()) {
    const shell = document.querySelector<HTMLElement>('.desktop-shell');
    if (!shell) return;
    const observer = new MutationObserver(() => updateChrome(shell));
    observer.observe(shell, { childList: true, subtree: true, characterData: true });
    return;
  }

  const observer = new MutationObserver(() => {
    if (!attempt()) return;
    const shell = document.querySelector<HTMLElement>('.desktop-shell');
    if (shell) {
      observer.disconnect();
      const shellObserver = new MutationObserver(() => updateChrome(shell));
      shellObserver.observe(shell, { childList: true, subtree: true, characterData: true });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
