const STORAGE_KEY = 'technology-preconstruction-takeoff.takeoff-columns-v1';

const COLUMNS = [
  { key: 'symbol', label: 'Symbol', index: 1 },
  { key: 'tool', label: 'Tool', index: 2 },
  { key: 'system', label: 'System', index: 3 },
  { key: 'sheet', label: 'Sheet', index: 4 },
  { key: 'locations', label: 'Locations', index: 5 },
  { key: 'qty', label: 'Qty', index: 6 },
  { key: 'unit', label: 'Unit', index: 7 },
  { key: 'rule', label: 'Rule Link', index: 8 },
] as const;

type ColumnKey = typeof COLUMNS[number]['key'];
type Visibility = Record<ColumnKey, boolean>;

const allVisible = (): Visibility => Object.fromEntries(COLUMNS.map((column) => [column.key, true])) as Visibility;

function readVisibility(): Visibility {
  const defaults = allVisible();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Visibility>;
    for (const column of COLUMNS) if (typeof parsed[column.key] === 'boolean') defaults[column.key] = parsed[column.key]!;
  } catch {}
  return defaults;
}

function saveVisibility(value: Visibility) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch {}
}

function takeoffTable(): HTMLTableElement | null {
  for (const table of Array.from(document.querySelectorAll<HTMLTableElement>('.bb-bottom-content table.bb-data-table'))) {
    const labels = Array.from(table.querySelectorAll('thead th')).map((cell) => cell.textContent?.trim() || '');
    if (labels[0] === 'Symbol' && labels.includes('Locations') && labels.includes('Rule Link')) return table;
  }
  return null;
}

function applyVisibility(value: Visibility) {
  const table = takeoffTable();
  if (!table) return;
  table.classList.add('bb-takeoff-table');
  for (const column of COLUMNS) table.classList.toggle(`bb-hide-${column.key}`, !value[column.key]);
}

function createChooser() {
  const host = document.createElement('div');
  host.className = 'bb-column-chooser-runtime';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'bb-column-trigger';
  trigger.textContent = 'Columns ▾';
  trigger.title = 'Choose Takeoff Totals columns';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'bb-column-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');

  const title = document.createElement('div');
  title.className = 'bb-column-menu-title';
  title.textContent = 'SHOW COLUMNS';
  menu.appendChild(title);

  let visibility = readVisibility();
  const inputs = new Map<ColumnKey, HTMLInputElement>();

  const render = () => {
    applyVisibility(visibility);
    for (const column of COLUMNS) inputs.get(column.key)!.checked = visibility[column.key];
  };

  for (const column of COLUMNS) {
    const label = document.createElement('label');
    label.className = 'bb-column-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = visibility[column.key];
    input.addEventListener('change', () => {
      const next = { ...visibility, [column.key]: input.checked };
      if (!Object.values(next).some(Boolean)) {
        input.checked = true;
        return;
      }
      visibility = next;
      saveVisibility(visibility);
      render();
    });
    inputs.set(column.key, input);
    const text = document.createElement('span');
    text.textContent = column.label;
    label.append(input, text);
    menu.appendChild(label);
  }

  const actions = document.createElement('div');
  actions.className = 'bb-column-actions';
  const all = document.createElement('button');
  all.type = 'button';
  all.textContent = 'Show all';
  all.addEventListener('click', () => { visibility = allVisible(); saveVisibility(visibility); render(); });
  const compact = document.createElement('button');
  compact.type = 'button';
  compact.textContent = 'Compact';
  compact.title = 'Show Tool, Locations, Qty and Unit';
  compact.addEventListener('click', () => {
    visibility = { symbol: false, tool: true, system: false, sheet: false, locations: true, qty: true, unit: true, rule: false };
    saveVisibility(visibility);
    render();
  });
  actions.append(all, compact);
  menu.appendChild(actions);

  const close = () => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    trigger.setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', close);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

  host.append(trigger, menu);
  render();
  return host;
}

export function installCountColumnChooser() {
  let host: HTMLElement | null = null;

  const sync = () => {
    const bottomHeader = document.querySelector<HTMLElement>('.bb-bottom-header');
    const table = takeoffTable();
    if (table) applyVisibility(readVisibility());

    const takeoffActive = Boolean(document.querySelector('.bb-bottom-tabs button.active')?.textContent?.includes('Takeoff Totals'));
    if (!bottomHeader || !takeoffActive) {
      host?.remove();
      host = null;
      return;
    }

    if (!host || !host.isConnected) {
      host = createChooser();
      bottomHeader.appendChild(host);
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.requestAnimationFrame(sync);
  return () => observer.disconnect();
}
