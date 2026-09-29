const STORAGE_KEY = 'scopelogic-takeoff-workspace-rails-v1';

const DEFAULT_LEFT = 250;
const DEFAULT_RIGHT = 320;
const MIN_LEFT = 180;
const MAX_LEFT = 520;
const MIN_RIGHT = 240;
const MAX_RIGHT = 560;

type RailWidths = {
  left: number;
  right: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadWidths(): RailWidths {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
    const parsed = JSON.parse(raw) as Partial<RailWidths>;
    return {
      left: clamp(Number(parsed.left) || DEFAULT_LEFT, MIN_LEFT, MAX_LEFT),
      right: clamp(Number(parsed.right) || DEFAULT_RIGHT, MIN_RIGHT, MAX_RIGHT),
    };
  } catch {
    return { left: DEFAULT_LEFT, right: DEFAULT_RIGHT };
  }
}

function saveWidths(widths: RailWidths) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // Workspace remains usable even when WebView storage is unavailable.
  }
}

function applyWidths(widths: RailWidths) {
  document.documentElement.style.setProperty('--takeoff-left-rail-width', `${widths.left}px`);
  document.documentElement.style.setProperty('--takeoff-right-rail-width', `${widths.right}px`);
}

function makeHandle(side: 'left' | 'right', widths: RailWidths) {
  const handle = document.createElement('div');
  handle.className = `workspace-rail-resizer ${side}`;
  handle.dataset.workspaceRailResizer = side;
  handle.title = `Drag to resize ${side === 'left' ? 'Pages / Tool Chest' : 'Properties'} panel. Double-click to reset.`;

  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.classList.remove('resizing-workspace-rail');
    saveWidths(widths);
  };

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    startX = event.clientX;
    startWidth = side === 'left' ? widths.left : widths.right;
    handle.classList.add('dragging');
    document.body.classList.add('resizing-workspace-rail');
    try { handle.setPointerCapture(event.pointerId); } catch { /* no-op */ }
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const delta = event.clientX - startX;
    if (side === 'left') {
      widths.left = clamp(startWidth + delta, MIN_LEFT, MAX_LEFT);
    } else {
      widths.right = clamp(startWidth - delta, MIN_RIGHT, MAX_RIGHT);
    }
    applyWidths(widths);
  });

  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
  handle.addEventListener('lostpointercapture', finish);

  handle.addEventListener('dblclick', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (side === 'left') widths.left = DEFAULT_LEFT;
    else widths.right = DEFAULT_RIGHT;
    applyWidths(widths);
    saveWidths(widths);
  });

  return handle;
}

export function installWorkspaceRailResize() {
  const widths = loadWidths();
  applyWidths(widths);

  const attach = () => {
    const leftRail = document.querySelector<HTMLElement>('.desktop-workspace > .left-rail');
    const rightRail = document.querySelector<HTMLElement>('.desktop-workspace > .right-rail');

    if (leftRail && !leftRail.querySelector('[data-workspace-rail-resizer="left"]')) {
      leftRail.appendChild(makeHandle('left', widths));
    }
    if (rightRail && !rightRail.querySelector('[data-workspace-rail-resizer="right"]')) {
      rightRail.appendChild(makeHandle('right', widths));
    }
  };

  attach();
  const observer = new MutationObserver(attach);
  const root = document.getElementById('root') || document.body;
  observer.observe(root, { childList: true, subtree: true });

  window.addEventListener('beforeunload', () => saveWidths(widths), { once: true });
}
