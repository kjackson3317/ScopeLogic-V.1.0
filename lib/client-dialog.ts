'use client';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PromptOptions = {
  title: string;
  message: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type DialogResult = boolean | string | null;

function openDialog(kind: 'confirm' | 'prompt', options: ConfirmOptions | PromptOptions): Promise<DialogResult> {
  if (typeof document === 'undefined') return Promise.resolve(kind === 'confirm' ? false : null);

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const panel = document.createElement('div');
    panel.className = 'app-dialog';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', options.title);

    const title = document.createElement('div');
    title.className = 'dialog-title';
    const heading = document.createElement('b');
    heading.textContent = options.title;
    title.appendChild(heading);

    const message = document.createElement('p');
    message.textContent = options.message;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const cancel = document.createElement('button');
    cancel.className = 'secondary';
    cancel.type = 'button';
    cancel.textContent = options.cancelLabel || 'Cancel';

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = kind === 'confirm' && (options as ConfirmOptions).danger ? 'danger-button' : 'primary';
    submit.textContent = options.confirmLabel || 'Confirm';

    let input: HTMLInputElement | null = null;
    if (kind === 'prompt') {
      const promptOptions = options as PromptOptions;
      input = document.createElement('input');
      input.value = promptOptions.initialValue || '';
      input.placeholder = promptOptions.placeholder || '';
      input.autocomplete = 'off';
      panel.append(title, message, input, actions);
    } else {
      panel.append(title, message, actions);
    }

    actions.append(cancel, submit);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    const finish = (result: DialogResult) => {
      document.removeEventListener('keydown', keydown);
      backdrop.remove();
      resolve(result);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(kind === 'confirm' ? false : null);
      if (event.key === 'Enter' && kind === 'prompt' && input) {
        event.preventDefault();
        const value = input.value.trim();
        if (value) finish(value);
      }
    };

    cancel.addEventListener('click', () => finish(kind === 'confirm' ? false : null));
    submit.addEventListener('click', () => {
      if (kind === 'confirm') finish(true);
      else if (input) {
        const value = input.value.trim();
        if (value) finish(value);
      }
    });
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) finish(kind === 'confirm' ? false : null);
    });
    document.addEventListener('keydown', keydown);
    requestAnimationFrame(() => (input || submit).focus());
  });
}

export async function showAppConfirm(options: ConfirmOptions): Promise<boolean> {
  return (await openDialog('confirm', options)) === true;
}

export async function showAppPrompt(options: PromptOptions): Promise<string | null> {
  const result = await openDialog('prompt', options);
  return typeof result === 'string' ? result : null;
}
