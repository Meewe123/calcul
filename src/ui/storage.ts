/**
 * localStorage that never throws. Storage can be disabled, full, or blocked
 * in private mode; the calculator keeps working, it just forgets.
 */
import { logger } from './logger';

/** Shared with the inline script in index.html — keep the names in sync. */
export const STORAGE_KEYS = {
  tape: 'calcul:tape',
  theme: 'calcul:theme',
  lang: 'calcul:lang',
} as const;

export interface SafeStorage {
  /** False when nothing will survive a reload. */
  readonly persistent: boolean;
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export function createStorage(getStorage: () => Storage): SafeStorage {
  let storage: Storage | null = null;
  try {
    const candidate = getStorage();
    const probe = 'calcul:probe';
    candidate.setItem(probe, probe);
    candidate.removeItem(probe);
    storage = candidate;
  } catch (error) {
    logger.warn('Storage is unavailable, nothing will be saved', error);
  }

  return {
    persistent: storage !== null,
    read(key) {
      try {
        return storage?.getItem(key) ?? null;
      } catch (error) {
        logger.warn(`Could not read ${key}`, error);
        return null;
      }
    },
    write(key, value) {
      try {
        storage?.setItem(key, value);
      } catch (error) {
        logger.warn(`Could not save ${key}`, error);
      }
    },
  };
}
