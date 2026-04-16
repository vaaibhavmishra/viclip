import { browserTracingIntegration, init, replayIntegration } from '@sentry/electron/renderer';
import { init as reactInit } from '@sentry/react';

/**
 * Initializes Sentry for error tracking in the renderer process using React SDK
 * @param dsn The DSN provided by Sentry
 */
export function initSentry(dsn: string): void {
  // Skip Sentry initialization in development mode
  if (import.meta.env.DEV) {
    console.log('Sentry initialization skipped: Development mode');
    return;
  }

  // Only initialize if a valid DSN is provided
  if (!dsn || dsn.trim() === '') {
    console.warn('Sentry initialization skipped: No DSN provided');
    return;
  }

  init({
    dsn,
    integrations: [browserTracingIntegration(), replayIntegration()],
    // Performance monitoring
    tracesSampleRate: 1.0,
    // Session replay for errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    reactInit
  });
}

// Other functions remain mostly the same
export function captureException(error: Error, context: Record<string, unknown> = {}): void {
  console.error('Error captured by Sentry', error, context);
  captureException(error, {
    extra: context
  });
}
