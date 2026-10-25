import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { generationSettings } from '../modules/generation/config';
import { ProviderFailure } from '../modules/generation/errors';
import type { GenerationAdapter, ProviderInput } from '../modules/generation/provider';
import type { RunInput } from '../modules/generation/service';

const databaseUrl = process.env.DATABASE_URL;
const enabled = !!databaseUrl && process.env.NODE_ENV !== 'production';
describe.skipIf(!enabled)('generation PostgreSQL in an isolated temporary schema (mock provider)', () => {
  const schema = `generation_test_${randomUUID().replaceAll('-', '')}`;
  const owner = randomUUID();
  let sequence = 0;
  let admin: Client;
  let db: typeof import('../lib/db');
  let service: typeof import('../modules/generation/service');
  let worker: typeof import('../worker/generation');
  const source = {
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',
    title: 'AbortController',
    publisher: 'MDN',
    accessedAt: '2026-10-25',
    excerpt: 'Une opération compatible reçoit explicitement un signal d’annulation. '.repeat(8),
  };
  function input(count = 1): RunInput {
    sequence++;
    return {
      topic: 'javascript',
      difficulty: 'intermediate',
      format: 'concept',
      learningObjective: 'Comprendre une annulation explicite pour une opération compatible.',
      conceptKey: `test.generation.${sequence}`,
      angle: `Angle pédagogique explicite ${sequence}`,
      count,
      sourceUrls: [source.url],
      idempotencyKey: randomUUID(),
    };
  }
  function output(i: ProviderInput) {
    return {
      schemaVersion: 1,
      slug: `brouillon-test-${sequence}-${i.position}`,
      locale: 'fr',
      title: `Une annulation explicite ${i.request.conceptKey} ${i.position}`,
      topic: i.request.topic,
      difficulty: i.request.difficulty,
      format: i.request.format,
      conceptKey: i.request.conceptKey,
      learningObjective: i.request.learningObjective,
      tags: ['async'],
      blocks: [
        {
          type: 'paragraph',
          text: 'Un signal est transmis à une opération compatible, puis le contrôleur peut demander son annulation.',
        },
      ],
      takeaway: 'Transmettre le signal rend l’annulation explicite.',
      searchAliases: ['annuler requête'],
      context: { technology: 'Web', version: null },
      sources: [{ ...source, claims: ['Une opération compatible reçoit le signal.'] }],
      reviewAfterDays: 180,
      status: 'published',
      flags: [],
    };
  }
  function adapter(knownCost = true): GenerationAdapter {
    return {
      generate: vi.fn(async (i) => ({
        output: output(i),
        usage: knownCost ? { inputTokens: 100, outputTokens: 100 } : undefined,
        model: 'mock-model',
        responseId: randomUUID(),
      })),
    };
  }
  async function runNext(mock = adapter()) {
    const job = await service.claimJob();
    expect(job).toBeTruthy();
    const result = await worker.processGenerationJob(job!, {
      adapter: mock,
      fetchSource: async () => source,
    });
    return { job: job!, result, mock };
  }
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && !url.pathname.includes('test'))
      throw new Error('Base locale ou de test requise.');
    admin = new Client({ connectionString: databaseUrl });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(await readFile('migrations/001_core.sql', 'utf8'));
    await admin.query(await readFile('migrations/002_generation.sql', 'utf8'));
    await admin.query(await readFile('migrations/005_generation_attempts.sql', 'utf8'));
    url.searchParams.set('options', `-csearch_path=${schema}`);
    vi.stubEnv('DATABASE_URL', url.href);
    vi.stubEnv('AI_API_KEY', 'unit-test-not-a-real-key');
    vi.stubEnv('AI_MODEL', 'mock-model');
    vi.stubEnv('AI_BASE_URL', 'https://provider.invalid/v1');
    vi.stubEnv('AI_PROVIDER', 'openai-compatible');
    vi.stubEnv('AI_MONTHLY_BUDGET_CENTS', '100000');
    vi.stubEnv('AI_INPUT_CENTS_PER_MILLION', '1000');
    vi.stubEnv('AI_OUTPUT_CENTS_PER_MILLION', '2000');
    db = await import('../lib/db');
    service = await import('../modules/generation/service');
    worker = await import('../worker/generation');
    await db.pool.query(
      "INSERT INTO \"user\"(id,name,email,role) VALUES($1,'Generation fixture','generation@test.invalid','owner')",
      [owner],
    );
  });
  afterAll(async () => {
    await db?.pool.end();
    vi.unstubAllEnvs();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });
  it('rejects disabled generation before any reservation', async () => {
    vi.stubEnv('AI_API_KEY', '');
    await expect(service.createRun(owner, input())).rejects.toMatchObject({ code: 'GENERATION_DISABLED' });
    expect(Number((await db.pool.query('SELECT count(*) n FROM generation_runs')).rows[0].n)).toBe(0);
    vi.stubEnv('AI_API_KEY', 'unit-test-not-a-real-key');
  });
  it('deduplicates submission, enforces one lease and creates only drafts atomically', async () => {
    const payload = input(2);
    const [first, second] = await Promise.all([
      service.createRun(owner, payload),
      service.createRun(owner, payload),
    ]);
    expect(first.id).toBe(second.id);
    expect(first.jobs).toHaveLength(2);
    await expect(
      service.createRun(owner, { ...payload, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: 'GENERATION_DUPLICATE' });
    const mock = adapter();
    const job = await service.claimJob();
    expect(job).toBeTruthy();
    expect(await service.claimJob()).toBeNull();
    expect(await worker.processGenerationJob(job!, { adapter: mock, fetchSource: async () => source })).toBe(
      'succeeded',
    );
    expect(await worker.processGenerationJob(job!, { adapter: mock, fetchSource: async () => source })).toBe(
      'lease_lost',
    );
    expect(mock.generate).toHaveBeenCalledTimes(1);
    await runNext();
    const detail = await service.getRun(first.id);
    expect(detail.status).toBe('succeeded');
    expect(detail.reserved_cents).toBe(0);
    const posts = (
      await db.pool.query(
        'SELECT p.status,p.current_published_version_id,v.content FROM generation_results g JOIN posts p ON p.id=g.post_id JOIN post_versions v ON v.id=p.latest_version_id',
      )
    ).rows;
    expect(posts).toHaveLength(2);
    expect(
      posts.every(
        (p) => p.status === 'draft' && !p.current_published_version_id && p.content.status === 'draft',
      ),
    ).toBe(true);
  });
  it('reserves concurrent requests transactionally without exceeding the monthly cap', async () => {
    const budget = await service.getBudget();
    const cap =
      Number(budget.spent_cents) +
      Number(budget.reserved_cents) +
      generationSettings().reservationPerDraftCents;
    vi.stubEnv('AI_MONTHLY_BUDGET_CENTS', String(cap));
    const results = await Promise.allSettled([
      service.createRun(owner, input()),
      service.createRun(owner, input()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const current = await service.getBudget();
    expect(Number(current.spent_cents) + Number(current.reserved_cents)).toBe(cap);
    const job = await service.claimJob();
    expect(job).toBeTruthy();
    const mock = adapter();
    await worker.processGenerationJob(job!, {
      adapter: mock,
      fetchSource: async () => {
        throw new Error('Unreachable source');
      },
    });
    expect(mock.generate).not.toHaveBeenCalled();
    vi.stubEnv('AI_MONTHLY_BUDGET_CENTS', '100000');
  });
  it('retains reservations when usage is absent or a timeout may have billed', async () => {
    const succeeded = await service.createRun(owner, input());
    await runNext(adapter(false));
    const knownDraft = await service.getRun(succeeded.id);
    expect(knownDraft.status).toBe('succeeded');
    expect(knownDraft.cost_unknown).toBe(true);
    expect(knownDraft.reserved_cents).toBeGreaterThan(0);
    const uncertain = await service.createRun(owner, input());
    const mock: GenerationAdapter = {
      generate: vi.fn(async () => {
        throw new ProviderFailure('PROVIDER_NETWORK', 'Timeout', { costUnknown: true });
      }),
    };
    expect((await runNext(mock)).result).toBe('uncertain');
    expect(mock.generate).toHaveBeenCalledTimes(1);
    await expect(service.retryRun(uncertain.id, owner)).rejects.toMatchObject({
      code: 'GENERATION_RETRY_BLOCKED',
    });
    expect(await service.claimJob()).toBeNull();
    const detail = await service.getRun(uncertain.id);
    expect(detail.status).toBe('uncertain');
    expect(detail.reserved_cents).toBeGreaterThan(0);
  });
  it('recovers expired leases before a call, suspends after a call, and releases exhausted pre-call leases', async () => {
    const before = await service.createRun(owner, input());
    const initial = await service.claimJob();
    await db.pool.query("UPDATE generation_jobs SET locked_until=now()-interval '1 second' WHERE id=$1", [
      initial!.id,
    ]);
    const recovered = await service.claimJob();
    expect(recovered!.id).toBe(initial!.id);
    expect(recovered!.attempts).toBe(2);
    expect(
      await worker.processGenerationJob(recovered!, { adapter: adapter(), fetchSource: async () => source }),
    ).toBe('succeeded');
    expect(
      (await service.getRun(before.id)).jobs.filter((j: { post_id?: string }) => j.post_id),
    ).toHaveLength(1);
    const after = await service.createRun(owner, input());
    const started = await service.claimJob();
    await db.pool.query(
      "UPDATE generation_jobs SET call_started_at=now(),locked_until=now()-interval '1 second' WHERE id=$1",
      [started!.id],
    );
    expect(await service.claimJob()).toBeNull();
    expect((await service.getRun(after.id)).status).toBe('uncertain');
    const exhausted = await service.createRun(owner, input());
    const last = await service.claimJob();
    await db.pool.query(
      "UPDATE generation_jobs SET attempts=3,locked_until=now()-interval '1 second' WHERE id=$1",
      [last!.id],
    );
    expect(await service.claimJob()).toBeNull();
    const detail = await service.getRun(exhausted.id);
    expect(detail.status).toBe('failed');
    expect(detail.reserved_cents).toBe(0);
  });
  it('keeps all billed usage across an explicit retry and blocks another actor', async () => {
    const run = await service.createRun(owner, input());
    const invalid: GenerationAdapter = {
      generate: vi.fn(async () => ({
        output: { invalid: true },
        usage: { inputTokens: 100, outputTokens: 100 },
        model: 'mock-model',
      })),
    };
    expect((await runNext(invalid)).result).toBe('failed');
    const failed = await service.getRun(run.id);
    expect(failed.jobs[0].error_code).toBe('OUTPUT_SCHEMA');
    expect(failed.estimated_cost_cents).toBe(1);
    await expect(service.retryRun(run.id, 'another-owner')).rejects.toMatchObject({
      code: 'GENERATION_FORBIDDEN',
    });
    await service.retryRun(run.id, owner);
    await runNext();
    const result = await service.getRun(run.id);
    expect(result.attempts).toHaveLength(2);
    expect(result.estimated_cost_cents).toBe(2);
    expect(result.status).toBe('succeeded');
  });
  it('moves an older queued reservation into the current month before calling', async () => {
    const run = await service.createRun(owner, input());
    const reservation = run.jobs[0].reservation_cents;
    const prior = (
      await db.pool.query(
        "SELECT to_char(date_trunc('month',now() AT TIME ZONE 'UTC')-interval '1 month','YYYY-MM-DD') AS period",
      )
    ).rows[0].period;
    await db.transaction(async (client) => {
      await client.query(
        'INSERT INTO generation_budgets(month,reserved_cents) VALUES($1,$2) ON CONFLICT(month) DO UPDATE SET reserved_cents=generation_budgets.reserved_cents+$2',
        [prior, reservation],
      );
      await client.query('UPDATE generation_budgets SET reserved_cents=reserved_cents-$2 WHERE month=$1', [
        run.jobs[0].budget_month,
        reservation,
      ]);
      await client.query('UPDATE generation_jobs SET budget_month=$2 WHERE run_id=$1', [run.id, prior]);
    });
    expect((await runNext()).result).toBe('succeeded');
    expect(
      (
        await db.pool.query('SELECT reserved_cents,spent_cents FROM generation_budgets WHERE month=$1', [
          prior,
        ])
      ).rows[0],
    ).toMatchObject({ reserved_cents: '0', spent_cents: '0' });
    const result = await service.getRun(run.id);
    expect(result.estimated_cost_cents).toBe(1);
    expect(result.jobs[0].budget_month).not.toEqual(prior);
  });
  it('blocks changed prices or a lowered budget before any provider call', async () => {
    const changed = await service.createRun(owner, input());
    const mock = adapter();
    vi.stubEnv('AI_INPUT_CENTS_PER_MILLION', '2000');
    expect((await runNext(mock)).result).toBe('failed');
    expect(mock.generate).not.toHaveBeenCalled();
    await expect(service.retryRun(changed.id, owner)).rejects.toMatchObject({
      code: 'GENERATION_CONFIG_CHANGED',
    });
    vi.stubEnv('AI_INPUT_CENTS_PER_MILLION', '1000');
    const lowered = await service.createRun(owner, input());
    vi.stubEnv('AI_MONTHLY_BUDGET_CENTS', '1');
    expect((await runNext(mock)).result).toBe('failed');
    expect(mock.generate).not.toHaveBeenCalled();
    expect((await service.getRun(lowered.id)).jobs[0].error_code).toBe('GENERATION_BUDGET');
    vi.stubEnv('AI_MONTHLY_BUDGET_CENTS', '100000');
  });
  it('bounds rate-limit retries and releases their unused reservation', async () => {
    const run = await service.createRun(owner, input());
    const mock: GenerationAdapter = {
      generate: vi.fn(async () => {
        throw new ProviderFailure('PROVIDER_RATE_LIMIT', 'Quota', { costUnknown: false, retryable: true });
      }),
    };
    for (let n = 0; n < 3; n++) {
      expect((await runNext(mock)).result).toBe(n < 2 ? 'retry' : 'failed');
      await db.pool.query('UPDATE generation_jobs SET available_at=now() WHERE run_id=$1', [run.id]);
    }
    expect(mock.generate).toHaveBeenCalledTimes(3);
    const result = await service.getRun(run.id);
    expect(result.status).toBe('failed');
    expect(result.reserved_cents).toBe(0);
    expect(result.attempts).toHaveLength(3);
  });
});
