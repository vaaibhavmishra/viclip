import { is } from '@electron-toolkit/utils';
import * as Sentry from '@sentry/electron/main';
import log from 'electron-log/main';

/**
 * Initializes Sentry for error tracking in the main process
 * @param dsn The DSN provided by Sentry
 */
export function initSentry(dsn: string): void {
  // Skip Sentry initialization in development mode
  if (is.dev) {
    log.info('Sentry initialization skipped: Development mode');
    return;
  }

  // Only initialize if a valid DSN is provided
  if (!dsn || dsn.trim() === '') {
    log.warn('Sentry initialization skipped: No DSN provided');
    return;
  }

  try {
    Sentry.init({
      dsn
    });

    log.info('Sentry initialized successfully in main process');
  } catch (error) {
    log.error('Failed to initialize Sentry in main process', error as Error);
  }
}

/**
 * Send the exception to Sentry
 * @param error The error object to capture
 * @param context Additional context information
 */
export function captureException(error: Error, context: Record<string, unknown> = {}): void {
  log.error('Error captured by Sentry', error, context);
  Sentry.captureException(error, {
    extra: context
  });
}

/**
 * Sets user information for Sentry reporting
 * @param userId The user's ID
 * @param email The user's email
 */
export function setUser(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    email
  });
  log.debug('Set user context for Sentry', { userId, email });
}

/**
 * Clears user information from Sentry
 */
export function clearUser(): void {
  Sentry.setUser(null);
  log.debug('Cleared user context from Sentry');
}
