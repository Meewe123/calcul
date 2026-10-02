/** One short message at a time over the bottom of the tape, optionally with an action. */
export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export interface Toast {
  show(message: string, action?: ToastAction): void;
  hide(): void;
}

const VISIBLE_MS = 4000;
const VISIBLE_WITH_ACTION_MS = 8000;

export function createToast(
  container: HTMLElement,
  text: HTMLElement,
  button: HTMLButtonElement,
): Toast {
  let timer: number | undefined;
  let onAction: (() => void) | undefined;

  const hide = (): void => {
    window.clearTimeout(timer);
    container.hidden = true;
    onAction = undefined;
  };

  button.addEventListener('click', () => {
    const run = onAction;
    hide();
    run?.();
  });

  // Hovering or focusing the toast keeps it open: nobody should race a timer.
  const pause = (): void => {
    window.clearTimeout(timer);
  };
  const resume = (): void => {
    if (!container.hidden) timer = window.setTimeout(hide, VISIBLE_MS);
  };
  container.addEventListener('pointerenter', pause);
  container.addEventListener('pointerleave', resume);
  container.addEventListener('focusin', pause);
  container.addEventListener('focusout', resume);

  return {
    show(message, action) {
      window.clearTimeout(timer);
      text.textContent = message;
      onAction = action?.run;
      button.hidden = !action;
      button.textContent = action?.label ?? '';
      container.hidden = false;
      timer = window.setTimeout(hide, action ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS);
    },
    hide,
  };
}
