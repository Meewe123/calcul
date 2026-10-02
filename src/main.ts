import './styles/index.css';
import { startApp } from './ui/app';
import { logger } from './ui/logger';

try {
  startApp();
} catch (error) {
  // The static page is still usable as a document; say what broke.
  logger.error('The calculator failed to start', error);
}
