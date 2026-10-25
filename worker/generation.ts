import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { transaction } from '../lib/db';
import { createPost } from '../modules/content/service';
import {
  assertGenerationEnabled,
  estimateUsageCents,
  generationSettings,
  type GenerationSettings,
} from '../modules/generation/config';
import { GenerationError } from '../modules/generation/errors';
import {
  buildPrompt,
  createHttpAdapter,
  type GenerationAdapter,
  type ProviderResult,
} from '../modules/generation/provider';
import { failurePolicy } from '../modules/generation/policy';
import { refreshRun, reserveBudget, type GenerationJob } from '../modules/generation/service';
import { fetchSource, type SourceExcerpt } from '../modules/generation/sources';
import { validateGeneratedDraft } from '../modules/generation/validation';

async function lockOwnedJob(client: PoolClient, job: GenerationJob) {
  const current = (
    await client.query(
      "SELECT * FROM generation_jobs WHERE id=$1 AND state='processing' AND lease_token=$2 AND locked_until>now() FOR UPDATE",
      [job.id, job.lease_token],
    )
  ).rows[0];
  if (!current)
    throw new GenerationError(
      409,
      'JOB_LEASE_LOST',
      'Bail du job expiré : son résultat doit être vérifié avant toute relance.',
    );
  return current;
}

async function markCallStarted(job: GenerationJob, sources: SourceExcerpt[], settings: GenerationSettings) {
  const month = await transaction(async (client) => {
    await lockOwnedJob(client, job);
    const period = (
      await client.query(
        "SELECT to_char(date_trunc('month',now() AT TIME ZONE 'UTC'),'YYYY-MM-DD') AS period",
      )
    ).rows[0].period as string;
    const samePeriod = (await client.query('SELECT $1::date=$2::date same', [job.budget_month, period]))
      .rows[0].same;
    if (!samePeriod) {
      // A queued October job may only call in November after reserving November's budget.
      await reserveBudget(client, job.reservation_cents, settings.monthlyBudgetCents, period);
      await client.query(
        'UPDATE generation_budgets SET reserved_cents=reserved_cents-$2,updated_at=now() WHERE month=$1',
        [job.budget_month, job.reservation_cents],
      );
      await client.query('UPDATE generation_jobs SET budget_month=$2 WHERE id=$1', [job.id, period]);
    } else {
      const ledger = (
        await client.query(
          'SELECT spent_cents,reserved_cents FROM generation_budgets WHERE month=$1 FOR UPDATE',
          [period],
        )
      ).rows[0];
      if (Number(ledger.spent_cents) + Number(ledger.reserved_cents) > settings.monthlyBudgetCents)
        throw new GenerationError(
          429,
          'GENERATION_BUDGET',
          'Le plafond a été abaissé depuis la réservation : appel suspendu.',
        );
    }
    await client.query(
      'UPDATE generation_jobs SET call_started_at=now(),sources=$2,updated_at=now() WHERE id=$1',
      [job.id, JSON.stringify(sources)],
    );
    await client.query(
      'UPDATE generation_attempts SET call_started_at=now(),sources=$4 WHERE job_id=$1 AND retry_cycle=$2 AND attempt=$3',
      [job.id, job.retry_cycle, job.attempts, JSON.stringify(sources)],
    );
    return period;
  });
  job.budget_month = month;
}

async function settleBudget(client: PoolClient, job: GenerationJob, cost: number | null) {
  if (cost === null) return;
  await client.query(
    'UPDATE generation_budgets SET reserved_cents=reserved_cents-$2,spent_cents=spent_cents+$3,updated_at=now() WHERE month=$1',
    [job.budget_month, job.reservation_cents, cost],
  );
}

export async function processGenerationJob(
  job: GenerationJob,
  dependencies: { adapter?: GenerationAdapter; fetchSource?: typeof fetchSource } = {},
) {
  let callStarted = false;
  let result: ProviderResult | undefined;
  try {
    const settings = generationSettings();
    assertGenerationEnabled(settings);
    if (!job.user_id)
      throw new GenerationError(
        409,
        'GENERATION_USER_REMOVED',
        'Le compte à l’origine de ce lot a été supprimé.',
      );
    if (
      job.model !== settings.model ||
      job.provider !== settings.provider ||
      job.config_snapshot.endpoint !== settings.endpoint ||
      job.config_snapshot.inputCentsPerMillion !== settings.inputCentsPerMillion ||
      job.config_snapshot.outputCentsPerMillion !== settings.outputCentsPerMillion
    )
      throw new GenerationError(
        409,
        'GENERATION_CONFIG_CHANGED',
        'Fournisseur, modèle ou tarifs modifiés : créer un nouveau lot.',
      );
    const sources: SourceExcerpt[] = [];
    for (const sourceUrl of job.payload.sourceUrls)
      sources.push(await (dependencies.fetchSource ?? fetchSource)(sourceUrl, settings.sourceHosts));
    const input = {
      request: job.payload,
      sources,
      position: job.position,
      total: job.payload.count,
      requestKey: `${job.id}-${job.retry_cycle}-${job.attempts}`,
    };
    buildPrompt(input); // Validate the context bound before marking any potentially billed call.
    await markCallStarted(job, sources, settings);
    callStarted = true;
    result = await (dependencies.adapter ?? createHttpAdapter(settings)).generate(input);
    const post = validateGeneratedDraft(result.output, job.payload, sources);
    post.slug = `${post.slug.slice(0, 145)}-${job.id.slice(0, 8)}`;
    const fingerprint = createHash('sha256')
      .update(
        `${post.conceptKey}:${post.title.normalize('NFKC').toLocaleLowerCase('fr').replace(/\s+/g, ' ').trim()}`,
      )
      .digest('hex');
    const cost = estimateUsageCents(result.usage, job.config_snapshot);
    await transaction(async (client) => {
      await lockOwnedJob(client, job);
      // The lease lock plus unique job result makes creation and completion one atomic operation.
      const existing = (
        await client.query('SELECT post_id FROM generation_results WHERE job_id=$1', [job.id])
      ).rows[0];
      if (existing) return;
      if (
        (await client.query('SELECT 1 FROM generation_results WHERE fingerprint=$1', [fingerprint])).rowCount
      )
        throw new GenerationError(
          409,
          'OUTPUT_DUPLICATE',
          'Un brouillon de cette notion porte déjà le même titre.',
        );
      const draft = await createPost(post, job.user_id, client);
      await client.query('INSERT INTO generation_results(job_id,post_id,fingerprint) VALUES($1,$2,$3)', [
        job.id,
        draft.id,
        fingerprint,
      ]);
      await settleBudget(client, job, cost);
      await client.query(
        `UPDATE generation_jobs SET state='succeeded',cost_state=$3,estimated_cost_cents=$4,usage=$5,response_id=$6,response_model=$7,locked_until=NULL,lease_token=NULL,error_code=NULL,error_message=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2`,
        [
          job.id,
          job.lease_token,
          cost === null ? 'unknown' : 'estimated',
          cost,
          JSON.stringify(result!.usage ?? null),
          result!.responseId ?? null,
          result!.model,
        ],
      );
      await client.query(
        "UPDATE generation_attempts SET state='succeeded',estimated_cost_cents=$4,cost_unknown=$5,usage=$6,response_id=$7,response_model=$8,completed_at=now() WHERE job_id=$1 AND retry_cycle=$2 AND attempt=$3",
        [
          job.id,
          job.retry_cycle,
          job.attempts,
          cost,
          cost === null,
          JSON.stringify(result!.usage ?? null),
          result!.responseId ?? null,
          result!.model,
        ],
      );
      await refreshRun(client, job.run_id);
    });
    return 'succeeded' as const;
  } catch (error) {
    if (error instanceof GenerationError && error.code === 'JOB_LEASE_LOST') return 'lease_lost' as const;
    const policy = failurePolicy(error, callStarted, job.attempts, result?.usage);
    const cost = policy.costUnknown ? null : (estimateUsageCents(policy.usage, job.config_snapshot) ?? 0);
    const code = error instanceof GenerationError ? error.code : 'GENERATION_FAILURE';
    const message =
      error instanceof GenerationError
        ? error.message
        : callStarted
          ? 'Erreur après début d’appel ; coût incertain conservé.'
          : 'Récupération des sources ou préparation impossible.';
    try {
      await transaction(async (client) => {
        await lockOwnedJob(client, job);
        if (!policy.retry) await settleBudget(client, job, cost);
        const state = policy.retry ? 'queued' : policy.costUnknown ? 'uncertain' : 'failed';
        await client.query(
          `UPDATE generation_jobs SET state=$3,cost_state=$4,estimated_cost_cents=$5,usage=$6,error_code=$7,error_message=$8,available_at=now()+$9*interval '1 millisecond',call_started_at=CASE WHEN $3='queued' THEN NULL ELSE call_started_at END,locked_until=NULL,lease_token=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2`,
          [
            job.id,
            job.lease_token,
            state,
            policy.retry ? 'reserved' : policy.costUnknown ? 'unknown' : cost ? 'estimated' : 'released',
            cost,
            JSON.stringify(policy.usage ?? null),
            code,
            message,
            policy.delay,
          ],
        );
        await client.query(
          'UPDATE generation_attempts SET state=$4,estimated_cost_cents=$5,cost_unknown=$6,usage=$7,error_code=$8,error_message=$9,response_id=$10,response_model=$11,completed_at=now() WHERE job_id=$1 AND retry_cycle=$2 AND attempt=$3',
          [
            job.id,
            job.retry_cycle,
            job.attempts,
            state,
            cost,
            policy.costUnknown,
            JSON.stringify(policy.usage ?? null),
            code,
            message,
            result?.responseId ?? null,
            result?.model ?? job.model,
          ],
        );
        await refreshRun(client, job.run_id);
      });
    } catch (settlementError) {
      if (!(settlementError instanceof GenerationError && settlementError.code === 'JOB_LEASE_LOST'))
        throw settlementError;
      return 'lease_lost' as const;
    }
    return policy.retry
      ? ('retry' as const)
      : policy.costUnknown
        ? ('uncertain' as const)
        : ('failed' as const);
  }
}
