import { logger } from "../config/logger";

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string; 
  isRetryable?: (err: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 300,
    maxDelayMs = 5_000,
    label = "operation",
    isRetryable = () => true,
  } = options;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < attempts && isRetryable(err);

      logger.warn(
        { err, attempt, attempts, label },
        canRetry ? `${label} failed, will retry` : `${label} failed, giving up`,
      );

      if (!canRetry) break;

      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.random() * exponential * 0.3;
      await sleep(exponential + jitter);
    }
  }

  throw lastErr;
}

/** Retryable for network/5xx/429-style failures; not for 4xx client errors. */
export function isRetryableHttpError(err: unknown): boolean {
  if (err instanceof Error && "status" in err) {
    const status = (err as Error & { status?: number }).status;
    if (status !== undefined) return status >= 500 || status === 429;
  }
  // Network errors (fetch throws TypeError, AbortError on timeout) are retryable.
  return true;
}
