const ACCEPTED_PDF = /\.pdf$/i;

function isPdf(file: File) {
  return file.type === 'application/pdf' || ACCEPTED_PDF.test(file.name);
}

function findFileInput() {
  return document.querySelector<HTMLInputElement>('.file-button input[type="file"]');
}

function setDropState(active: boolean, invalid = false) {
  document.body.classList.toggle('pdf-drop-active', active);
  document.body.classList.toggle('pdf-drop-invalid', active && invalid);
}

function openThroughExistingInput(file: File) {
  const input = findFileInput();
  if (!input) return false;

  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

export function installPdfDropOpen() {
  let dragDepth = 0;

  const includesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types || []).includes('Files');

  window.addEventListener('dragenter', (event) => {
    if (!includesFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    const files = Array.from(event.dataTransfer?.files || []);
    setDropState(true, files.length > 0 && !files.some(isPdf));
  });

  window.addEventListener('dragover', (event) => {
    if (!includesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    const files = Array.from(event.dataTransfer?.files || []);
    setDropState(true, files.length > 0 && !files.some(isPdf));
  });

  window.addEventListener('dragleave', (event) => {
    if (!includesFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setDropState(false);
  });

  window.addEventListener('drop', (event) => {
    if (!includesFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    setDropState(false);

    const files = Array.from(event.dataTransfer?.files || []);
    const pdf = files.find(isPdf);
    if (!pdf) {
      document.body.classList.add('pdf-drop-rejected');
      window.setTimeout(() => document.body.classList.remove('pdf-drop-rejected'), 1400);
      return;
    }

    if (!openThroughExistingInput(pdf)) {
      document.body.classList.add('pdf-drop-rejected');
      window.setTimeout(() => document.body.classList.remove('pdf-drop-rejected'), 1400);
    }
  });

  window.addEventListener('blur', () => {
    dragDepth = 0;
    setDropState(false);
  });
}
