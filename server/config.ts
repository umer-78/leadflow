/**
 * Runtime configuration, read once from the environment.
 */
import 'dotenv/config';
import { DEFAULT_CLAUDE_MODEL, type ClaudeConfig } from './claude.ts';

function int(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export interface Config {
  env: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  /** Public base URL used in emails and Stripe return links. */
  publicUrl: string | undefined;
  /** Seed the demo clinic on boot (default on outside production). */
  seedDemo: boolean;
  /** Run the follow-up / notification worker in this process. */
  runWorker: boolean;
  workerIntervalMs: number;
  email: {
    resendApiKey: string | undefined;
    from: string;
  };
  stripe: {
    secretKey: string | undefined;
    webhookSecret: string | undefined;
  };
  /** Optional Claude answering mode (see claude.ts); off without an API key. */
  anthropic: ClaudeConfig;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const env = (process.env.NODE_ENV as Config['env']) || 'development';
  const databaseUrl = process.env.DATABASE_URL || '';
  return {
    env,
    port: int('PORT', 3000),
    databaseUrl,
    publicUrl: process.env.PUBLIC_BASE_URL || process.env.APP_URL || undefined,
    seedDemo: process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : env !== 'production',
    runWorker: process.env.RUN_WORKER !== 'false',
    workerIntervalMs: int('WORKER_INTERVAL_MS', 30_000),
    email: {
      resendApiKey: process.env.RESEND_API_KEY || undefined,
      from: process.env.EMAIL_FROM || 'LeadFlow <notifications@leadflow.local>',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY?.startsWith('sk_') ? process.env.STRIPE_SECRET_KEY : undefined,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || undefined,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || undefined,
      model: process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL,
      effort: (['low', 'medium', 'high'] as const).find((e) => e === process.env.ANTHROPIC_EFFORT) ?? 'low',
      timeoutMs: int('CLAUDE_TIMEOUT_MS', 15_000),
      dailyLimit: int('CLAUDE_DAILY_LIMIT', 500),
    },
    ...overrides,
  };
}
