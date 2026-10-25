import { GenerationError, type TokenUsage } from './errors';

export const PROMPT_VERSION = 'devscroll-fr-draft-v1';
export const MAX_PROMPT_BYTES = 45_000;
export const MAX_OUTPUT_TOKENS = 2500;
export const MAX_ATTEMPTS = 3;
export const DEFAULT_SOURCE_HOSTS = [
  'developer.mozilla.org',
  'nodejs.org',
  'www.typescriptlang.org',
  'react.dev',
  'nextjs.org',
  'www.postgresql.org',
  'docs.python.org',
  'docs.docker.com',
  'git-scm.com',
  'docs.github.com',
  'docs.aws.amazon.com',
  'learn.microsoft.com',
  'developers.hubspot.com',
  'developers.openai.com',
  'platform.openai.com',
  'www.rfc-editor.org',
  'www.w3.org',
  'web.dev',
] as const;

type Env = Record<string, string | undefined>;
function positive(value: string | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function generationSettings(env: Env = process.env) {
  const provider = env.AI_PROVIDER ?? 'openai-compatible';
  const model = env.AI_MODEL?.trim() ?? '';
  const apiKey = env.AI_API_KEY?.trim() ?? '';
  const monthlyBudgetCents = Math.floor(positive(env.AI_MONTHLY_BUDGET_CENTS));
  const inputCentsPerMillion = positive(env.AI_INPUT_CENTS_PER_MILLION);
  const outputCentsPerMillion = positive(env.AI_OUTPUT_CENTS_PER_MILLION);
  const sourceHosts = env.AI_SOURCE_HOSTS
    ? env.AI_SOURCE_HOSTS.split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
    : [...DEFAULT_SOURCE_HOSTS];
  let endpoint = '';
  try {
    const url = new URL(env.AI_BASE_URL ?? 'https://api.openai.com/v1');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      throw new Error('endpoint');
    endpoint = `${url.href.replace(/\/$/, '')}/chat/completions`;
  } catch {
    /* Configuration invalidity is reported below without exposing secrets. */
  }
  const reasons: string[] = [];
  if (provider !== 'openai-compatible') reasons.push('Fournisseur non pris en charge.');
  if (!apiKey) reasons.push('Aucune clé IA configurée : le corpus local reste disponible.');
  if (!model) reasons.push('Modèle explicite requis.');
  if (!monthlyBudgetCents) reasons.push('Budget mensuel non renseigné.');
  if (!inputCentsPerMillion || !outputCentsPerMillion)
    reasons.push('Tarifs entrée et sortie requis pour réserver le coût.');
  if (!endpoint) reasons.push('URL fournisseur HTTPS invalide.');
  if (!sourceHosts.length || sourceHosts.some((h) => !/^[a-z0-9.-]+$/.test(h)))
    reasons.push('Liste des hôtes documentaires invalide.');
  return {
    provider,
    model,
    apiKey,
    endpoint,
    sourceHosts,
    monthlyBudgetCents,
    inputCentsPerMillion,
    outputCentsPerMillion,
    enabled: reasons.length === 0,
    reasons,
    maxPerRun: 5,
    concurrency: 1,
    currency: 'USD',
    promptVersion: PROMPT_VERSION,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    // UTF-8 bytes are a deliberately conservative input-token upper bound for the supported BPE providers.
    reservationPerDraftCents: Math.max(
      1,
      Math.ceil(
        (MAX_PROMPT_BYTES * inputCentsPerMillion + MAX_OUTPUT_TOKENS * outputCentsPerMillion) / 1_000_000,
      ),
    ),
  };
}

export type GenerationSettings = ReturnType<typeof generationSettings>;
export function generationConfig(env: Env = process.env) {
  const { apiKey: _key, endpoint: _endpoint, ...safe } = generationSettings(env);
  void _key;
  void _endpoint;
  return { ...safe, mode: safe.enabled ? 'configured' : 'disabled', recurringGeneration: false };
}
export function assertGenerationEnabled(settings: GenerationSettings) {
  if (!settings.enabled) throw new GenerationError(503, 'GENERATION_DISABLED', settings.reasons.join(' '));
}
export function estimateUsageCents(
  usage: TokenUsage | undefined,
  rates: { inputCentsPerMillion: number; outputCentsPerMillion: number },
): number | null {
  if (
    !usage ||
    !Number.isSafeInteger(usage.inputTokens) ||
    usage.inputTokens < 0 ||
    !Number.isSafeInteger(usage.outputTokens) ||
    usage.outputTokens < 0
  )
    return null;
  return Math.ceil(
    (usage.inputTokens * rates.inputCentsPerMillion + usage.outputTokens * rates.outputCentsPerMillion) /
      1_000_000,
  );
}
