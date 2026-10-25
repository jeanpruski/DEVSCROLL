import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { difficulties, formats } from '../../lib/contracts';
import { pool, transaction } from '../../lib/db';
import { assertGenerationEnabled, generationSettings, MAX_ATTEMPTS, type GenerationSettings } from './config';
import { GenerationError } from './errors';
import { validateSourceUrl } from './sources';
import { expiredLeaseAction } from './policy';

export const runInputSchema = z
  .object({
    topic: z.string().min(1).max(60),
    difficulty: z.enum(difficulties),
    format: z.enum(formats),
    learningObjective: z.string().min(10).max(600),
    conceptKey: z.string().min(3).max(150),
    angle: z.string().min(5).max(300),
    count: z.number().int().min(1).max(5),
    sourceUrls: z.array(z.string().url().max(2000)).min(1).max(5),
    idempotencyKey: z.string().min(8).max(160),
  })
  .strict();
export type RunInput = z.infer<typeof runInputSchema>;
export type ConfigSnapshot = Pick<
  GenerationSettings,
  | 'inputCentsPerMillion'
  | 'outputCentsPerMillion'
  | 'reservationPerDraftCents'
  | 'monthlyBudgetCents'
  | 'endpoint'
>;
export type GenerationJob = {
  id: string;
  run_id: string;
  position: number;
  state: string;
  attempts: number;
  retry_cycle: number;
  lease_token: string;
  call_started_at: Date | null;
  budget_month: string | Date;
  reservation_cents: number;
  cost_state: string;
  user_id: string | null;
  payload: RunInput;
  model: string;
  provider: string;
  config_snapshot: ConfigSnapshot;
};
function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function normalize(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('fr').replace(/\s+/g, ' ').trim();
}

export async function reserveBudget(client: PoolClient, amount: number, limit: number, month?: string) {
  const period =
    month ??
    (
      await client.query(
        "SELECT to_char(date_trunc('month',now() AT TIME ZONE 'UTC'),'YYYY-MM-DD') AS period",
      )
    ).rows[0].period;
  await client.query('INSERT INTO generation_budgets(month) VALUES($1) ON CONFLICT DO NOTHING', [period]);
  const budget = (await client.query('SELECT * FROM generation_budgets WHERE month=$1 FOR UPDATE', [period]))
    .rows[0];
  if (Number(budget.spent_cents) + Number(budget.reserved_cents) + amount > limit) {
    throw new GenerationError(
      429,
      'GENERATION_BUDGET',
      'Le budget mensuel est insuffisant, y compris les coûts encore incertains.',
    );
  }
  await client.query(
    'UPDATE generation_budgets SET reserved_cents=reserved_cents+$2,updated_at=now() WHERE month=$1',
    [period, amount],
  );
  return period as string;
}

export async function createRun(userId: string, input: unknown) {
  const payload = runInputSchema.parse(input);
  const settings = generationSettings();
  assertGenerationEnabled(settings);
  payload.sourceUrls = [
    ...new Set(payload.sourceUrls.map((url) => validateSourceUrl(url, settings.sourceHosts).href)),
  ];
  const payloadHash = hash(payload);
  const dedupKey = hash([normalize(payload.topic), normalize(payload.conceptKey), normalize(payload.angle)]);
  const runId = await transaction(async (client) => {
    // Serialize identical submit keys before reserving any money.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `generation:${userId}:${payload.idempotencyKey}`,
    ]);
    const previous = (
      await client.query(
        'SELECT id,payload_hash FROM generation_runs WHERE user_id=$1 AND idempotency_key=$2',
        [userId, payload.idempotencyKey],
      )
    ).rows[0];
    if (previous) {
      if (previous.payload_hash !== payloadHash)
        throw new GenerationError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'Cette clé de lot correspond déjà à une autre demande.',
        );
      return previous.id as string;
    }
    const duplicate = await client.query(
      "SELECT id FROM generation_runs WHERE dedup_key=$1 AND status IN ('queued','running','succeeded','partial','uncertain')",
      [dedupKey],
    );
    if (duplicate.rowCount)
      throw new GenerationError(
        409,
        'GENERATION_DUPLICATE',
        'Cette notion et cet angle ont déjà un lot. Consulte son résultat ou choisis un autre angle.',
      );
    const existing = await client.query(
      `SELECT p.id,v.content->>'title' title FROM posts p JOIN post_versions v ON v.id=p.latest_version_id WHERE p.concept_key=$1 OR lower(v.content->>'learningObjective')=lower($2) LIMIT 8`,
      [payload.conceptKey, payload.learningObjective],
    );
    const warnings = existing.rows.map((row) => ({
      code: 'RELATED_CONTENT',
      postId: row.id,
      title: row.title,
      message: 'Notion ou objectif déjà présent : vérifier que l’angle apporte une explication utile.',
    }));
    const month = await reserveBudget(
      client,
      settings.reservationPerDraftCents * payload.count,
      settings.monthlyBudgetCents,
    );
    const id = randomUUID();
    const snapshot: ConfigSnapshot = {
      inputCentsPerMillion: settings.inputCentsPerMillion,
      outputCentsPerMillion: settings.outputCentsPerMillion,
      reservationPerDraftCents: settings.reservationPerDraftCents,
      monthlyBudgetCents: settings.monthlyBudgetCents,
      endpoint: settings.endpoint,
    };
    await client.query(
      `INSERT INTO generation_runs(id,user_id,idempotency_key,payload_hash,dedup_key,payload,provider,model,prompt_version,config_snapshot,warnings) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,
        userId,
        payload.idempotencyKey,
        payloadHash,
        dedupKey,
        JSON.stringify(payload),
        settings.provider,
        settings.model,
        settings.promptVersion,
        JSON.stringify(snapshot),
        JSON.stringify(warnings),
      ],
    );
    for (let position = 1; position <= payload.count; position++)
      await client.query(
        'INSERT INTO generation_jobs(id,run_id,position,budget_month,reservation_cents) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(), id, position, month, settings.reservationPerDraftCents],
      );
    return id;
  });
  return getRun(runId);
}

export async function listRuns() {
  return (
    await pool.query(`SELECT r.*, count(j.id)::integer job_count, count(j.id) FILTER(WHERE j.state='succeeded')::integer draft_count,
    (SELECT coalesce(sum(a.estimated_cost_cents),0)::integer FROM generation_attempts a JOIN generation_jobs aj ON aj.id=a.job_id WHERE aj.run_id=r.id) estimated_cost_cents,
    coalesce(sum(j.reservation_cents) FILTER(WHERE j.cost_state IN ('reserved','unknown')),0)::integer reserved_cents,
    bool_or(j.cost_state='unknown') cost_unknown
    FROM generation_runs r LEFT JOIN generation_jobs j ON j.run_id=r.id GROUP BY r.id ORDER BY r.created_at DESC,r.id DESC LIMIT 50`)
  ).rows;
}

export async function getRun(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    throw new GenerationError(404, 'GENERATION_NOT_FOUND', 'Lot introuvable.');
  const result = await pool.query('SELECT * FROM generation_runs WHERE id=$1', [id]);
  if (!result.rowCount) throw new GenerationError(404, 'GENERATION_NOT_FOUND', 'Lot introuvable.');
  const jobs = (
    await pool.query(
      `SELECT j.*,g.post_id,p.slug FROM generation_jobs j LEFT JOIN generation_results g ON g.job_id=j.id LEFT JOIN posts p ON p.id=g.post_id WHERE j.run_id=$1 ORDER BY j.position`,
      [id],
    )
  ).rows;
  const attempts = (
    await pool.query(
      'SELECT a.* FROM generation_attempts a JOIN generation_jobs j ON j.id=a.job_id WHERE j.run_id=$1 ORDER BY a.created_at,a.id',
      [id],
    )
  ).rows;
  return {
    ...result.rows[0],
    jobs,
    attempts,
    estimated_cost_cents: attempts.reduce((n, a) => n + Number(a.estimated_cost_cents ?? 0), 0),
    reserved_cents: jobs.reduce(
      (n, j) => n + (['reserved', 'unknown'].includes(j.cost_state) ? j.reservation_cents : 0),
      0,
    ),
    cost_unknown: jobs.some((j) => j.cost_state === 'unknown'),
  };
}

export async function retryRun(id: string, userId: string) {
  const settings = generationSettings();
  assertGenerationEnabled(settings);
  if (!z.string().uuid().safeParse(id).success)
    throw new GenerationError(404, 'GENERATION_NOT_FOUND', 'Lot introuvable.');
  await transaction(async (client) => {
    const run = (await client.query('SELECT * FROM generation_runs WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!run) throw new GenerationError(404, 'GENERATION_NOT_FOUND', 'Lot introuvable.');
    if (run.user_id !== userId)
      throw new GenerationError(403, 'GENERATION_FORBIDDEN', 'Ce lot appartient à un autre compte.');
    if (
      run.model !== settings.model ||
      run.provider !== settings.provider ||
      run.config_snapshot.endpoint !== settings.endpoint ||
      run.config_snapshot.inputCentsPerMillion !== settings.inputCentsPerMillion ||
      run.config_snapshot.outputCentsPerMillion !== settings.outputCentsPerMillion
    )
      throw new GenerationError(
        409,
        'GENERATION_CONFIG_CHANGED',
        'Le fournisseur, le modèle ou les tarifs ont changé : crée un nouveau lot.',
      );
    const jobs = (
      await client.query(
        "SELECT * FROM generation_jobs WHERE run_id=$1 AND state='failed' AND cost_state IN ('released','estimated') FOR UPDATE",
        [id],
      )
    ).rows;
    if (!jobs.length)
      throw new GenerationError(
        409,
        'GENERATION_RETRY_BLOCKED',
        'Aucun échec certain à relancer. Une réponse ou facturation inconnue exige une vérification auprès du fournisseur.',
      );
    const month = await reserveBudget(
      client,
      jobs.length * run.config_snapshot.reservationPerDraftCents,
      settings.monthlyBudgetCents,
    );
    for (const job of jobs) {
      // Past estimated usage stays in the monthly ledger; each explicit cycle reserves a fresh attempt.
      await client.query(
        `UPDATE generation_jobs SET state='queued',attempts=0,retry_cycle=retry_cycle+1,available_at=now(),locked_until=NULL,lease_token=NULL,call_started_at=NULL,budget_month=$2,cost_state='reserved',estimated_cost_cents=NULL,usage=NULL,error_code=NULL,error_message=NULL,updated_at=now() WHERE id=$1`,
        [job.id, month],
      );
    }
    await refreshRun(client, id);
  });
  return getRun(id);
}

export async function refreshRun(client: PoolClient, runId: string) {
  await client.query(
    `UPDATE generation_runs SET status=(SELECT CASE
    WHEN count(*) FILTER(WHERE state='processing')>0 THEN 'running'
    WHEN count(*) FILTER(WHERE state='queued')>0 THEN 'queued'
    WHEN count(*) FILTER(WHERE state='uncertain')>0 THEN 'uncertain'
    WHEN count(*) FILTER(WHERE state='succeeded')=count(*) THEN 'succeeded'
    WHEN count(*) FILTER(WHERE state='succeeded')>0 THEN 'partial' ELSE 'failed' END
    FROM generation_jobs WHERE run_id=$1),updated_at=now() WHERE id=$1`,
    [runId],
  );
}

export async function claimJob(): Promise<GenerationJob | null> {
  return transaction(async (client) => {
    // This advisory lock serializes claims across worker processes, enforcing one active job globally.
    if (!(await client.query('SELECT pg_try_advisory_xact_lock(730442061) acquired')).rows[0].acquired)
      return null;
    const expired = (
      await client.query(
        "SELECT * FROM generation_jobs WHERE state='processing' AND locked_until<now() FOR UPDATE SKIP LOCKED",
      )
    ).rows;
    for (const job of expired) {
      const action = expiredLeaseAction(job.call_started_at);
      const exhausted = action === 'queued' && job.attempts >= MAX_ATTEMPTS;
      if (exhausted)
        await client.query(
          'UPDATE generation_budgets SET reserved_cents=reserved_cents-$2,updated_at=now() WHERE month=$1',
          [job.budget_month, job.reservation_cents],
        );
      await client.query(
        `UPDATE generation_jobs SET state=$2,cost_state=CASE WHEN $2='uncertain' THEN 'unknown' WHEN $2='failed' THEN 'released' ELSE cost_state END,
        error_code=CASE WHEN $2='uncertain' THEN 'LEASE_EXPIRED_AFTER_CALL' ELSE NULL END,
        error_message=CASE WHEN $2='uncertain' THEN 'Worker interrompu après début d’appel : coût inconnu, reprise automatique suspendue.' ELSE NULL END,
        locked_until=NULL,lease_token=NULL,updated_at=now() WHERE id=$1`,
        [job.id, exhausted ? 'failed' : action],
      );
      await client.query(
        "UPDATE generation_attempts SET state=$4,cost_unknown=($4='uncertain'),error_code=CASE WHEN $4='uncertain' THEN 'LEASE_EXPIRED_AFTER_CALL' ELSE 'LEASE_EXPIRED_BEFORE_CALL' END,completed_at=now() WHERE job_id=$1 AND retry_cycle=$2 AND attempt=$3",
        [job.id, job.retry_cycle, job.attempts, action],
      );
      await refreshRun(client, job.run_id);
    }
    if (
      (
        await client.query(
          "SELECT 1 FROM generation_jobs WHERE state='processing' AND locked_until>=now() LIMIT 1",
        )
      ).rowCount
    )
      return null;
    const found = (
      await client.query(
        `SELECT j.* FROM generation_jobs j WHERE j.state='queued' AND j.available_at<=now() AND j.attempts<$1 ORDER BY j.created_at,j.position FOR UPDATE OF j SKIP LOCKED LIMIT 1`,
        [MAX_ATTEMPTS],
      )
    ).rows[0];
    if (!found) return null;
    const lease = randomUUID();
    await client.query(
      "UPDATE generation_jobs SET state='processing',attempts=attempts+1,lease_token=$2,locked_until=now()+interval '90 seconds',updated_at=now() WHERE id=$1",
      [found.id, lease],
    );
    await client.query('INSERT INTO generation_attempts(id,job_id,retry_cycle,attempt) VALUES($1,$2,$3,$4)', [
      randomUUID(),
      found.id,
      found.retry_cycle,
      found.attempts + 1,
    ]);
    await refreshRun(client, found.run_id);
    const run = (
      await client.query(
        'SELECT user_id,payload,provider,model,config_snapshot FROM generation_runs WHERE id=$1',
        [found.run_id],
      )
    ).rows[0];
    return {
      ...found,
      ...run,
      state: 'processing',
      attempts: found.attempts + 1,
      lease_token: lease,
    } as GenerationJob;
  });
}

export async function renewLease(job: Pick<GenerationJob, 'id' | 'lease_token'>) {
  const result = await pool.query(
    "UPDATE generation_jobs SET locked_until=now()+interval '90 seconds',updated_at=now() WHERE id=$1 AND lease_token=$2 AND state='processing' AND locked_until>now()",
    [job.id, job.lease_token],
  );
  return !!result.rowCount;
}

export async function getBudget() {
  const result = await pool.query(
    "SELECT *,to_char(month,'YYYY-MM') period FROM generation_budgets WHERE month=date_trunc('month',now() AT TIME ZONE 'UTC')::date",
  );
  return (
    result.rows[0] ?? { spent_cents: 0, reserved_cents: 0, period: new Date().toISOString().slice(0, 7) }
  );
}
