type PanSession = {
  container: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
  moved: boolean;
};

let activePan: PanSession | null = null;
let spaceHeld = false;
let suppressClickUntil = 0;
let wheelBusy = false;

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)));
}

function drawingScrollFromTarget(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  return element?.closest('.drawing-scroll') as HTMLElement | null;
}

function updateActivityHint(message: string) {
  const activity = document.querySelector('.activity-bar > span');
  if (activity) activity.textContent = message;
}

function shouldStartPan(event: PointerEvent, container: HTMLElement) {
  if (event.button === 1) return true;
  if (event.button !== 0) return false;
  return container.classList.contains('pan-mode') || spaceHeld;
}

function beginPan(event: PointerEvent) {
  const container = drawingScrollFromTarget(event.target);
  if (!container || !shouldStartPan(event, container)) return;

  activePan = {
    container,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startScrollLeft: container.scrollLeft,
    startScrollTop: container.scrollTop,
    moved: false,
  };

  container.classList.add('is-drag-panning');
  updateActivityHint('Pan mode: left-click and drag the drawing. Mouse wheel zooms at the cursor.');
  try { container.setPointerCapture(event.pointerId); } catch { /* WebView may not support capture on the scroll host. */ }
  event.preventDefault();
  event.stopPropagation();
}

function movePan(event: PointerEvent) {
  if (!activePan || activePan.pointerId !== event.pointerId) return;
  const dx = event.clientX - activePan.startX;
  const dy = event.clientY - activePan.startY;
  if (!activePan.moved && Math.hypot(dx, dy) >= 3) activePan.moved = true;

  activePan.container.scrollLeft = activePan.startScrollLeft - dx;
  activePan.container.scrollTop = activePan.startScrollTop - dy;
  event.preventDefault();
  event.stopPropagation();
}

function endPan(event: PointerEvent) {
  if (!activePan || activePan.pointerId !== event.pointerId) return;
  const session = activePan;
  activePan = null;
  session.container.classList.remove('is-drag-panning');
  try { session.container.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
  if (session.moved) suppressClickUntil = performance.now() + 250;
  updateActivityHint('Pan mode: left-click and drag the drawing. Mouse wheel zooms at the cursor.');
  event.preventDefault();
  event.stopPropagation();
}

function suppressPanClick(event: MouseEvent) {
  if (performance.now() > suppressClickUntil) return;
  if (!drawingScrollFromTarget(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
}

function zoomControls() {
  const readout = document.querySelector('.zoom-readout');
  if (!readout) return null;
  const zoomOut = readout.previousElementSibling;
  const zoomIn = readout.nextElementSibling;
  if (!(zoomOut instanceof HTMLButtonElement) || !(zoomIn instanceof HTMLButtonElement)) return null;
  const value = Number((readout.textContent || '').replace('%', '').trim());
  return { zoomOut, zoomIn, percent: Number.isFinite(value) ? value : null };
}

function applyWheelZoom(event: WheelEvent) {
  const container = drawingScrollFromTarget(event.target);
  if (!container || !container.querySelector('.drawing-stage')) return;

  event.preventDefault();
  if (wheelBusy || Math.abs(event.deltaY) < 0.5) return;

  const direction: 1 | -1 = event.deltaY < 0 ? 1 : -1;
  const controls = zoomControls();
  if (!controls) return;
  if ((direction > 0 && controls.percent !== null && controls.percent >= 400)
    || (direction < 0 && controls.percent !== null && controls.percent <= 20)) return;

  const button = direction > 0 ? controls.zoomIn : controls.zoomOut;
  if (button.disabled) return;

  const stage = container.querySelector('.drawing-stage') as HTMLElement | null;
  if (!stage) return;
  const before = stage.getBoundingClientRect();
  if (!before.width || !before.height) return;

  const insideStage = event.clientX >= before.left && event.clientX <= before.right
    && event.clientY >= before.top && event.clientY <= before.bottom;
  const anchorX = insideStage ? (event.clientX - before.left) / before.width : 0.5;
  const anchorY = insideStage ? (event.clientY - before.top) / before.height : 0.5;
  const containerRect = container.getBoundingClientRect();
  const cursorX = insideStage ? event.clientX : containerRect.left + container.clientWidth / 2;
  const cursorY = insideStage ? event.clientY : containerRect.top + container.clientHeight / 2;
  const oldWidth = before.width;
  const oldHeight = before.height;

  wheelBusy = true;
  button.click();
  updateActivityHint(direction > 0 ? 'Zooming in at cursor…' : 'Zooming out at cursor…');

  let frames = 0;
  const settle = () => {
    frames += 1;
    const after = stage.getBoundingClientRect();
    const resized = Math.abs(after.width - oldWidth) > 0.5 || Math.abs(after.height - oldHeight) > 0.5;

    if (resized) {
      const anchoredX = after.left + anchorX * after.width;
      const anchoredY = after.top + anchorY * after.height;
      container.scrollLeft += anchoredX - cursorX;
      container.scrollTop += anchoredY - cursorY;
      wheelBusy = false;
      updateActivityHint('Mouse wheel zooms at the cursor. Pan mode: left-click and drag the drawing.');
      return;
    }

    if (frames < 60) requestAnimationFrame(settle);
    else {
      wheelBusy = false;
      updateActivityHint('Mouse wheel zooms at the cursor. Pan mode: left-click and drag the drawing.');
    }
  };
  requestAnimationFrame(settle);
}

function keyDown(event: KeyboardEvent) {
  if (event.code !== 'Space' || isEditableTarget(event.target) || event.repeat) return;
  spaceHeld = true;
}

function keyUp(event: KeyboardEvent) {
  if (event.code === 'Space') spaceHeld = false;
}

function cancelTransientNavigation() {
  spaceHeld = false;
  if (!activePan) return;
  activePan.container.classList.remove('is-drag-panning');
  activePan = null;
}

export function installDrawingNavigation() {
  document.addEventListener('pointerdown', beginPan, true);
  document.addEventListener('pointermove', movePan, true);
  document.addEventListener('pointerup', endPan, true);
  document.addEventListener('pointercancel', endPan, true);
  document.addEventListener('click', suppressPanClick, true);
  document.addEventListener('wheel', applyWheelZoom, { capture: true, passive: false });
  window.addEventListener('keydown', keyDown, true);
  window.addEventListener('keyup', keyUp, true);
  window.addEventListener('blur', cancelTransientNavigation);

  return () => {
    document.removeEventListener('pointerdown', beginPan, true);
    document.removeEventListener('pointermove', movePan, true);
    document.removeEventListener('pointerup', endPan, true);
    document.removeEventListener('pointercancel', endPan, true);
    document.removeEventListener('click', suppressPanClick, true);
    document.removeEventListener('wheel', applyWheelZoom, true);
    window.removeEventListener('keydown', keyDown, true);
    window.removeEventListener('keyup', keyUp, true);
    window.removeEventListener('blur', cancelTransientNavigation);
  };
}
