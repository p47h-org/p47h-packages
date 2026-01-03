/**
 * @fileoverview InitializationOrchestrator - WASM Init with Timeout & Retry
 *
 * Handles the complex logic of initializing WASM with:
 * - Timeout protection
 * - Retry logic for transient failures
 * - Abort signal support
 * - Progress tracking
 *
 * Extracted from VaultController for SRP compliance.
 *
 * @module internal/InitializationOrchestrator
 * @license Apache-2.0
 * @internal
 */

import type { P47hProviderConfig } from '../types';

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for WASM initialization (30 seconds) */
export const DEFAULT_INIT_TIMEOUT_MS = 30_000;

/** Default number of retry attempts */
export const DEFAULT_INIT_RETRIES = 2;

/** Default delay between retries (1 second) */
export const DEFAULT_RETRY_DELAY_MS = 1_000;

// ============================================================================
// Custom Errors
// ============================================================================

/**
 * Error thrown when WASM initialization times out.
 */
export class InitTimeoutError extends Error {
  readonly elapsedMs: number;
  readonly timeoutMs: number;

  constructor(elapsedMs: number, timeoutMs: number) {
    super(
      `WASM initialization timed out after ${elapsedMs}ms ` +
        `(timeout: ${timeoutMs}ms). This may indicate an incompatible browser ` +
        `or network issues loading the WASM module.`
    );
    this.name = 'InitTimeoutError';
    this.elapsedMs = elapsedMs;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when WASM is not supported.
 */
export class WasmNotSupportedError extends Error {
  constructor() {
    super(
      'WebAssembly is not supported in this browser. ' +
        'P47H Vault requires a modern browser with WASM support.'
    );
    this.name = 'WasmNotSupportedError';
  }
}

/**
 * Error thrown when initialization fails after all retries.
 */
export class InitExhaustedError extends Error {
  readonly attempts: number;
  readonly lastError: Error;

  constructor(attempts: number, lastError: Error) {
    super(
      `WASM initialization failed after ${attempts} attempts. ` +
        `Last error: ${lastError.message}`
    );
    this.name = 'InitExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for initialization orchestration.
 */
export interface InitConfig {
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Callback for the actual initialization work.
 */
export type InitCallback = () => Promise<void>;

/**
 * Progress callback for UI updates.
 */
export interface InitProgress {
  attempt: number;
  elapsedMs: number;
  maxRetries: number;
}

export type ProgressCallback = (progress: InitProgress) => void;

// ============================================================================
// InitializationOrchestrator Class
// ============================================================================

/**
 * Orchestrates WASM initialization with timeout and retry logic.
 *
 * Features:
 * - Configurable timeout per attempt
 * - Configurable retry count and delay
 * - Abort signal support for cleanup
 * - Progress tracking for UI feedback
 * - Request ID tracking for race condition protection
 *
 * @internal
 */
export class InitializationOrchestrator {
  private _startTime: number = 0;
  private _attempt: number = 0;
  private _requestId: number = 0;
  private _aborted: boolean = false;

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Elapsed time since initialization started (ms).
   */
  get elapsedMs(): number {
    if (this._startTime === 0) return 0;
    return Date.now() - this._startTime;
  }

  /**
   * Current initialization attempt number (1-based).
   */
  get attempt(): number {
    return this._attempt;
  }

  /**
   * Current request ID for race condition tracking.
   */
  get requestId(): number {
    return this._requestId;
  }

  /**
   * Whether initialization has been aborted.
   */
  get isAborted(): boolean {
    return this._aborted;
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Check if WASM is supported in the current environment.
   * @throws {WasmNotSupportedError} If WASM is not supported
   */
  checkWasmSupport(): void {
    if (typeof WebAssembly === 'undefined') {
      throw new WasmNotSupportedError();
    }
  }

  /**
   * Check if running in SSR environment.
   */
  isSSR(): boolean {
    return typeof window === 'undefined';
  }

  /**
   * Execute initialization with timeout and retry logic.
   *
   * @param initFn - The actual initialization function to execute
   * @param config - Configuration extracted from P47hProviderConfig
   * @param onProgress - Optional callback for progress updates
   * @returns Promise that resolves when init succeeds
   * @throws {InitTimeoutError} If timeout exceeded
   * @throws {InitExhaustedError} If all retries fail
   */
  async execute(
    initFn: InitCallback,
    config: P47hProviderConfig | undefined,
    onProgress?: ProgressCallback
  ): Promise<void> {
    // SSR guard
    if (this.isSSR()) {
      return;
    }

    // Check WASM support
    this.checkWasmSupport();

    // Extract config with defaults
    const initConfig: InitConfig = {
      timeoutMs: config?.initTimeout ?? DEFAULT_INIT_TIMEOUT_MS,
      maxRetries: config?.initRetries ?? DEFAULT_INIT_RETRIES,
      retryDelayMs: config?.retryDelay ?? DEFAULT_RETRY_DELAY_MS,
    };

    // Track this request
    const currentRequestId = ++this._requestId;
    this._startTime = Date.now();
    this._attempt = 0;
    this._aborted = false;

    await this._executeWithRetry(initFn, initConfig, currentRequestId, onProgress);
  }

  /**
   * Abort the current initialization.
   */
  abort(): void {
    this._aborted = true;
  }

  /**
   * Reset abort flag for reinitialization.
   */
  resetAbort(): void {
    this._aborted = false;
  }

  /**
   * Check if current request is still valid.
   */
  isCurrentRequest(requestId: number): boolean {
    return this._requestId === requestId && !this._aborted;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Execute with retry logic.
   */
  private async _executeWithRetry(
    initFn: InitCallback,
    config: InitConfig,
    requestId: number,
    onProgress?: ProgressCallback
  ): Promise<void> {
    let lastError: Error | null = null;
    const totalAttempts = config.maxRetries + 1;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      // Check abort
      if (!this.isCurrentRequest(requestId)) {
        return;
      }

      this._attempt = attempt;

      // Report progress
      onProgress?.({
        attempt,
        elapsedMs: this.elapsedMs,
        maxRetries: config.maxRetries,
      });

      try {
        // Run init with timeout - cleanup is guaranteed by .finally()
        await this._runWithTimeout(
          initFn(),
          config.timeoutMs,
          () => new InitTimeoutError(this.elapsedMs, config.timeoutMs)
        );

        // Success
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Check abort during async
        if (!this.isCurrentRequest(requestId)) {
          return;
        }

        // Timeout or last attempt - don't retry
        if (err instanceof InitTimeoutError || attempt >= totalAttempts) {
          break;
        }

        // Log retry (only if debug enabled)
        this._log(
          config,
          `Attempt ${attempt} failed, retrying in ${config.retryDelayMs}ms...`,
          err
        );

        // Wait before retry
        await this._sleep(config.retryDelayMs);
      }
    }

    // All attempts exhausted
    const finalError =
      lastError instanceof InitTimeoutError
        ? lastError
        : new InitExhaustedError(this._attempt, lastError!);

    throw finalError;
  }

  /**
   * Run a promise with a timeout, safely handling "dangling rejections".
   * 
   * This pattern:
   * 1. Clears the timer if the operation completes before timeout
   * 2. Attaches a dummy .catch() to silence orphaned rejections if timeout wins
   * 
   * The key insight: Promise.race does NOT cancel the losing promise.
   * If initFn() fails AFTER timeout fires, that rejection would be "unhandled".
   * We prevent this by attaching a silent catch handler when timeout wins.
   * 
   * @param promise - The promise to race against the timeout
   * @param timeoutMs - Timeout duration in milliseconds
   * @param createError - Factory function to create the timeout error
   * @returns The result of the promise if it completes before timeout
   * @throws The timeout error if timeout occurs first, or any error from the promise
   */
  private async _runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    createError: () => Error
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    let hasTimedOut = false;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        hasTimedOut = true;
        reject(createError());
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      // 1. CRITICAL: Clear the timer if operation finishes before timeout
      clearTimeout(timer!);

      // 2. Handle "Dangling Rejections":
      // If we timed out, the original promise is still running.
      // If it fails later, it would cause an "Unhandled Rejection".
      // Attach a dummy catch to silence that future error.
      if (hasTimedOut) {
        promise.catch(() => {
          // Intentionally silent: timeout already won, this error is irrelevant
        });
      }
    }
  }

  /**
   * Sleep utility.
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Conditional debug logger.
   */
  private _log(config: InitConfig, message: string, ...args: unknown[]): void {
    if (config.debug) {
      console.warn(`[InitOrchestrator] ${message}`, ...args);
    }
  }
}
