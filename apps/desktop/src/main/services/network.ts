import { net } from "electron";
import log from "electron-log/main";

// Track network check timeout globally to ensure it can be cleaned up
let networkCheckTimeout: NodeJS.Timeout | null = null;
let isMonitoring = false;

export interface NetworkMonitorOptions {
  onOnline: () => void | Promise<void>;
  initialDelay?: number;
  baseInterval?: number;
  maxInterval?: number;
  backoffMultiplier?: number;
}

/**
 * Start monitoring network connectivity with progressive backoff
 * @param options Configuration options for network monitoring
 */
export function startNetworkMonitoring(options: NetworkMonitorOptions): void {
  const {
    onOnline,
    initialDelay = 5000,
    baseInterval = 5000,
    maxInterval = 60000,
    backoffMultiplier = 1.5,
  } = options;

  // Don't start monitoring if already monitoring
  if (isMonitoring) {
    log.debug("Network monitoring already active");
    return;
  }

  isMonitoring = true;
  log.debug("Starting network monitoring");

  // First check if we're already online
  if (net.isOnline()) {
    log.debug("Network is already online at startup");
    handleOnlineState(onOnline);
    return;
  }

  // Start monitoring with progressive backoff
  log.debug("Network offline at startup, will check periodically");

  let attemptCount = 0;
  const checkNetwork = (): void => {
    // Don't continue if monitoring was stopped
    if (!isMonitoring) {
      return;
    }

    log.debug(`Checking network status (attempt ${attemptCount + 1})`);

    if (net.isOnline()) {
      handleOnlineState(onOnline);
    } else {
      attemptCount++;

      // Calculate next interval with exponential backoff
      const nextInterval = Math.min(
        baseInterval * backoffMultiplier ** attemptCount,
        maxInterval,
      );

      // Clear the previous timeout and set a new one
      cleanupNetworkCheck();
      networkCheckTimeout = setTimeout(() => {
        checkNetwork();
      }, nextInterval);

      log.debug(
        `Network still offline, next check in ${Math.round(nextInterval / 1000)}s`,
      );
    }
  };

  // Start with initial delay
  networkCheckTimeout = setTimeout(checkNetwork, initialDelay);
}

/**
 * Stop network monitoring and cleanup resources
 */
export function stopNetworkMonitoring(): void {
  log.debug("Stopping network monitoring");
  isMonitoring = false;
  cleanupNetworkCheck();
}

/**
 * Check if network monitoring is currently active
 */
export function isNetworkMonitoring(): boolean {
  return isMonitoring;
}

/**
 * Get current network status
 */
export function isOnline(): boolean {
  return net.isOnline();
}

/**
 * Handle when network comes online
 */
function handleOnlineState(onOnline: () => void | Promise<void>): void {
  log.info("Network is online");

  // Stop monitoring since we're now online
  stopNetworkMonitoring();

  // Call the callback
  if (typeof onOnline === "function") {
    try {
      const result = onOnline();
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          log.error("Error in network online callback", error as Error);
        });
      }
    } catch (error) {
      log.error("Error in network online callback", error as Error);
    }
  }
}

/**
 * Clean up network check timeout
 */
function cleanupNetworkCheck(): void {
  if (networkCheckTimeout) {
    clearTimeout(networkCheckTimeout);
    networkCheckTimeout = null;
    log.debug("Network check timeout cleared");
  }
}
