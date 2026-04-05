/**
 * Claude API Client Wrapper
 * =========================
 * Initialises the Anthropic SDK client with rate-limiting,
 * exponential-backoff retry, structured error handling,
 * and token-usage tracking.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';
import { ClaudeUsageMetrics } from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;

/** Simple sliding-window rate limiter (requests per minute). */
const RATE_LIMIT_RPM = 50;
const RATE_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

class SlidingWindowRateLimiter {
  private timestamps: number[] = [];

  constructor(private maxRequests: number, private windowMs: number) {}

  /** Returns true if a request is allowed; false if rate-limited. */
  tryAcquire(): boolean {
    const now = Date.now();
    // Prune timestamps outside the window
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  /** Milliseconds until the next slot opens. */
  msUntilNextSlot(): number {
    if (this.timestamps.length < this.maxRequests) return 0;
    const oldest = this.timestamps[0];
    return Math.max(0, this.windowMs - (Date.now() - oldest));
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ClaudeClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ClaudeClientError';
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private rateLimiter: SlidingWindowRateLimiter;

  constructor(model?: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ClaudeClientError(
        'ANTHROPIC_API_KEY environment variable is not set',
        undefined,
        false,
      );
    }

    this.client = new Anthropic({ apiKey });
    this.model = model ?? DEFAULT_MODEL;
    this.rateLimiter = new SlidingWindowRateLimiter(RATE_LIMIT_RPM, RATE_WINDOW_MS);

    logger.info('ClaudeClient initialised', { model: this.model });
  }

  // -----------------------------------------------------------------------
  // Public
  // -----------------------------------------------------------------------

  /**
   * Send a message to Claude and return the text response together with
   * usage metrics.  Handles rate-limiting and retry internally.
   */
  async createMessage(
    systemPrompt: string,
    userPrompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
    } = {},
  ): Promise<{ text: string; usage: ClaudeUsageMetrics }> {
    const model = options.model ?? this.model;
    const maxTokens = options.maxTokens ?? 1024;
    const temperature = options.temperature ?? 0.3;

    // Rate-limit gate
    if (!this.rateLimiter.tryAcquire()) {
      const waitMs = this.rateLimiter.msUntilNextSlot();
      logger.warn('Rate-limited — waiting before retry', { waitMs });
      await this.sleep(waitMs);
      // Try once more after waiting
      if (!this.rateLimiter.tryAcquire()) {
        throw new ClaudeClientError('Rate limit exceeded after wait', 429, true);
      }
    }

    return this.withRetry(async () => {
      const start = Date.now();

      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const latencyMs = Date.now() - start;

      // Extract text from content blocks
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('');

      const usage: ClaudeUsageMetrics = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model,
        latencyMs,
        timestamp: new Date().toISOString(),
      };

      logger.info('Claude API call completed', {
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs,
      });

      return { text, usage };
    });
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Retry wrapper with exponential backoff on 429 (rate-limit) and 500+
   * (server errors).
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;

        const status = this.extractStatus(err);
        const retryable = status === 429 || (status !== undefined && status >= 500);

        if (!retryable || attempt === MAX_RETRIES) {
          throw new ClaudeClientError(
            `Claude API error: ${err instanceof Error ? err.message : String(err)}`,
            status,
            retryable,
          );
        }

        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        logger.warn('Retrying Claude API call', {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          backoffMs: backoff,
          status,
        });

        await this.sleep(backoff);
      }
    }

    // Should never reach here, but satisfy TypeScript
    throw lastError;
  }

  /** Extract HTTP status from various error shapes. */
  private extractStatus(err: unknown): number | undefined {
    if (err && typeof err === 'object') {
      if ('status' in err && typeof (err as Record<string, unknown>).status === 'number') {
        return (err as Record<string, unknown>).status as number;
      }
      if (
        'statusCode' in err &&
        typeof (err as Record<string, unknown>).statusCode === 'number'
      ) {
        return (err as Record<string, unknown>).statusCode as number;
      }
    }
    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: ClaudeClient | null = null;

/**
 * Return the shared ClaudeClient instance, creating it lazily.
 * Throws immediately if ANTHROPIC_API_KEY is not set.
 */
export function getClaudeClient(): ClaudeClient {
  if (!_instance) {
    _instance = new ClaudeClient();
  }
  return _instance;
}
