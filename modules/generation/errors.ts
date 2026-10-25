export class GenerationError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

export type TokenUsage = { inputTokens: number; outputTokens: number };

export class ProviderFailure extends GenerationError {
  constructor(
    code: string,
    message: string,
    public options: {
      retryable?: boolean;
      costUnknown?: boolean;
      usage?: TokenUsage;
      retryAfterMs?: number;
    } = {},
  ) {
    super(502, code, message);
    this.name = 'ProviderFailure';
  }
}
