/**
 * The only place that writes to the console. There is no backend to send
 * reports to, so errors go to the browser console with a recognisable
 * prefix, and the UI tells the person what happened in plain words.
 */
const PREFIX = '[calcul]';

export const logger = {
  warn(message: string, detail?: unknown): void {
    console.warn(PREFIX, message, ...(detail === undefined ? [] : [detail]));
  },
  error(message: string, error?: unknown): void {
    console.error(PREFIX, message, ...(error === undefined ? [] : [error]));
  },
};
