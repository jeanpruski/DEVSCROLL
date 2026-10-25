import { MAX_ATTEMPTS } from './config';
import { ProviderFailure, type TokenUsage } from './errors';
import { retryDelayMs } from './provider';

export function expiredLeaseAction(callStarted: Date | string | null): 'uncertain' | 'queued' {
  return callStarted ? 'uncertain' : 'queued';
}

export function failurePolicy(error: unknown, callStarted: boolean, attempts: number, usage?: TokenUsage) {
  const providerError = error instanceof ProviderFailure ? error : undefined;
  const actualUsage = usage ?? providerError?.options.usage;
  const costUnknown = !!(callStarted && !actualUsage && providerError?.options.costUnknown !== false);
  const retry = !!(
    providerError?.options.retryable &&
    !costUnknown &&
    !actualUsage &&
    attempts < MAX_ATTEMPTS
  );
  return {
    usage: actualUsage,
    costUnknown,
    retry,
    delay: retry ? retryDelayMs(attempts, providerError?.options.retryAfterMs) : 0,
  };
}
