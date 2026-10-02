import { logger } from './logger';

/**
 * Copies text with the async Clipboard API, available on every current
 * browser over HTTPS and on localhost. Returns false if the browser refuses.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    logger.warn('Copy to clipboard failed', error);
    return false;
  }
}
