import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { platform, arch, cpus } from 'node:os';
import { Pool } from 'pg';
import { z } from 'zod';
import { postSchema, type PostContent } from '../lib/contracts';

const evaluationSchema = z.object({
  schemaVersion: z.literal(1),
  origin: z.literal('editorial'),
  notRealUserQueries: z.literal(true),
  description: z.string(),
  savedSlugs: z.array(z.string()),
  technicalFixtures: z.array(
    z.object({ slug: z.string(), title: z.string(), text: z.string(), searchAliases: z.array(z.string()) }),
  ),
  cases: z
    .array(
      z.object({
        id: z.string(),
        query: z.string(),
        scope: z.enum(['all', 'saved']),
        corpus: z.enum(['seed', 'technical-fixtures']),
        kind: z.string(),
        expectedSlugs: z.array(z.string()),
        forbiddenSlugs: z.array(z.string()).optional(),
      }),
    )
    .length(25),
});
const evaluation = evaluationSchema.parse(
  JSON.parse(await readFile('content/search-evaluation.json', 'utf8')),
);
const seed = postSchema.array().parse(JSON.parse(await readFile('content/posts.json', 'utf8')));
const connectionString = process.env.BENCHMARK_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL ou BENCHMARK_DATABASE_URL requis.');
const target = new URL(connectionString);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname))
  throw new Error('Le benchmark accepte uniquement PostgreSQL en loopback.');
if (process.env.NODE_ENV === 'production') throw new Error('Benchmark refusé en production.');
if (target.searchParams.has('options'))
  throw new Error('Retirer les options de connexion pour garantir un search_path isolé.');
const schema = `devscroll_bench_${randomUUID().replaceAll('-', '')}`;
// The only persistent-database DDL is the creation/deletion of this exact owned schema.
const admin = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000 });
const isolated = new Pool({
  connectionString,
  max: 3,
  connectionTimeoutMillis: 5_000,
  options: `-c search_path=${schema},public -c statement_timeout=10000 -c lock_timeout=3000`,
});
let created = false;
let report: Record<string, unknown> | undefined;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await isolated.query(await readFile('migrations/001_core.sql', 'utf8'));
  await isolated.query(await readFile('migrations/007_search_performance.sql', 'utf8'));
  await isolated.query(await readFile('migrations/008_search_hints.sql', 'utf8'));
  const relation = (
    await isolated.query(
      "SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid='posts'::regclass",
    )
  ).rows[0];
  if (relation.nspname !== schema) throw new Error('Isolation de la table posts non confirmée.');
  const extension = await isolated.query(
    "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm'",
  );
  if (extension.rowCount && extension.rows[0].nspname !== 'public')
    throw new Error('pg_trgm doit être dans public pour ce banc isolé.');
  if (extension.rowCount)
    await isolated.query(
      'CREATE INDEX post_versions_trigram_idx ON post_versions USING gin(search_normalized gin_trgm_ops)',
    );
  // Set the singleton before importing any service: no service can use the ordinary pool.
  (globalThis as unknown as { devscrollPool?: Pool }).devscrollPool = isolated;
  process.env.BETTER_AUTH_SECRET ??= 'benchmark-only-cursor-secret-not-a-user-session';
  const { searchableText } = await import('../modules/content/service');
  const { searchPosts } = await import('../modules/search/service');
  const owner = `benchmark-${randomUUID()}`;
  const stranger = `benchmark-other-${randomUUID()}`;
  await isolated.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3),($4,$5,$6)', [
    owner,
    'Benchmark',
    `${owner}@example.invalid`,
    stranger,
    'Autre compte fictif',
    `${stranger}@example.invalid`,
  ]);

  const ids = new Map<string, string>();
  async function insertPosts(contents: PostContent[]) {
    const records = contents.map((content, i) => {
      const text = searchableText(content);
      const id = randomUUID();
      ids.set(content.slug, id);
      return {
        id,
        vid: randomUUID(),
        slug: content.slug,
        concept: content.conceptKey,
        objective: content.learningObjective,
        content,
        title: text.title,
        body: text.body,
        normalized: text.normalized,
        date: new Date(Date.UTC(2026, 9, 25) - i * 1_000).toISOString(),
      };
    });
    const payload = JSON.stringify(records);
    await isolated.query(
      `INSERT INTO concepts(key,objective) SELECT DISTINCT concept,objective FROM jsonb_to_recordset($1) x(concept text,objective text) ON CONFLICT DO NOTHING`,
      [payload],
    );
    await isolated.query(
      `INSERT INTO posts(id,slug,status,concept_key) SELECT id,slug,'published',concept FROM jsonb_to_recordset($1) x(id uuid,slug text,concept text)`,
      [payload],
    );
    await isolated.query(
      `INSERT INTO post_versions(id,post_id,version,content,search_fr,search_simple,search_normalized,published_at)
      SELECT vid,id,1,content,setweight(to_tsvector('french',title),'A')||setweight(to_tsvector('french',body),'B'),
      setweight(to_tsvector('simple',title),'A')||setweight(to_tsvector('simple',body),'B'),normalized,date
      FROM jsonb_to_recordset($1) x(vid uuid,id uuid,content jsonb,title text,body text,normalized text,date timestamptz)`,
      [payload],
    );
    await isolated.query(
      `UPDATE posts p SET current_published_version_id=x.vid,latest_version_id=x.vid FROM jsonb_to_recordset($1) x(id uuid,vid uuid) WHERE p.id=x.id`,
      [payload],
    );
  }
  await insertPosts(seed);
  for (const slug of evaluation.savedSlugs) {
    if (!ids.has(slug)) throw new Error(`Favori attendu absent : ${slug}`);
    await isolated.query('INSERT INTO saved_posts(user_id,post_id) VALUES($1,$2)', [owner, ids.get(slug)]);
  }
  const syntheticBase: PostContent = {
    ...seed[0],
    sources: [],
    flags: [],
    format: 'concept',
    topic: 'benchmark-technical',
    context: { technology: 'Fixture synthétique, jamais seedée', version: null },
  };
  await insertPosts(
    evaluation.technicalFixtures.map((fixture) => ({
      ...syntheticBase,
      ...fixture,
      conceptKey: `benchmark.${fixture.slug}`,
      blocks: [{ type: 'paragraph', text: fixture.text }],
      learningObjective: 'Tester un identifiant technique sans ajouter de contenu utilisateur.',
      takeaway: 'Donnée de test artificielle, réservée au schéma du benchmark.',
    })),
  );
  await isolated.query('ANALYZE');
  const relevance = [];
  for (const test of evaluation.cases) {
    const params = new URLSearchParams({ q: test.query, scope: test.scope });
    if (test.corpus === 'technical-fixtures') params.set('topic', 'benchmark-technical');
    const result = await searchPosts(owner, params);
    const slugs = result.posts.map((post) => post.slug);
    const ranks = test.expectedSlugs.map((slug) => slugs.indexOf(slug) + 1);
    const hits = ranks.filter((rank) => rank > 0).length;
    relevance.push({
      ...test,
      slugs,
      total: result.total,
      mode: result.searchMode,
      recallAt12: ranks.length ? hits / ranks.length : null,
      reciprocalRankAt12: ranks.length
        ? Math.min(...ranks.filter((rank) => rank > 0)) < Infinity
          ? 1 / Math.min(...ranks.filter((rank) => rank > 0))
          : 0
        : null,
      passed: ranks.length ? hits === ranks.length : result.total === 0,
      forbiddenAbsent: !(test.forbiddenSlugs ?? []).some((slug) => slugs.includes(slug)),
    });
  }
  // An unrelated user has no saved entries even when the first user has matches.
  const foreignSaved = await searchPosts(
    stranger,
    new URLSearchParams({ q: 'annuler requête', scope: 'saved' }),
  );
  if (foreignSaved.total !== 0) throw new Error('Échec de l’isolation des favoris ; benchmark interrompu.');
  const positives = relevance.filter((entry) => entry.recallAt12 !== null);
  const seedPositives = positives.filter((entry) => entry.corpus === 'seed');
  const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
  const metrics = (entries: typeof positives) => ({
    cases: entries.length,
    recallAt12: average(entries.map((entry) => entry.recallAt12 ?? 0)),
    mrrAt12: average(entries.map((entry) => entry.reciprocalRankAt12 ?? 0)),
  });
  const bulkStart = performance.now();
  // Separate artificial workload. It is never imported by db:seed or stored in public.
  const keywords = [
    'AbortController',
    'Promise.all',
    '.env',
    'CI/CD',
    'Node.js',
    'SQL NULL',
    'webhook',
    'cache',
    'permissions',
    'transaction',
  ];
  for (let batch = 0; batch < 20; batch++) {
    const contents = Array.from({ length: 500 }, (_, j) => {
      const index = batch * 500 + j;
      const keyword = keywords[index % keywords.length];
      return {
        ...syntheticBase,
        slug: `benchmark-volume-${index}`,
        title: `Échantillon artificiel ${keyword} ${index}`,
        conceptKey: `benchmark.volume.${index}`,
        topic: 'benchmark-volume',
        searchAliases: [keyword],
        blocks: [
          {
            type: 'paragraph' as const,
            text: `Ce document artificiel numéro ${index} sert uniquement à mesurer la recherche locale autour du terme ${keyword}. Il ne constitue pas un conseil technique. Le texte produit un volume régulier de données indexables avec une diversité de mots et un identifiant stable. Le scénario reproduit des lectures de contenu et des favoris sur un compte fictif, sans interaction avec le corpus privé. Les scores de pertinence sont calculés séparément sur les publications rédigées. La mesure de durée inclut les requêtes SQL et la conversion des résultats par le service applicatif.`,
          },
        ],
      };
    });
    await insertPosts(contents);
  }
  // 1,000 artificial saved posts give the saved filter a useful workload.
  await isolated.query(
    "INSERT INTO saved_posts(user_id,post_id) SELECT $1,p.id FROM posts p WHERE p.slug LIKE 'benchmark-volume-%' ORDER BY p.slug LIMIT 1000",
    [owner],
  );
  await isolated.query('ANALYZE');
  const bulkMs = performance.now() - bulkStart;
  const workload = [
    { q: 'AbortController', scope: 'all' },
    { q: 'Promise.all', scope: 'all' },
    { q: '.env', scope: 'all' },
    { q: 'AbortControler', scope: 'all' },
    { q: 'annuler requête', scope: 'saved' },
  ];
  for (const query of workload) await searchPosts(owner, new URLSearchParams(query));
  const samples: { q: string; scope: string; ms: number; total: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const query = workload[i % workload.length];
    const started = performance.now();
    const result = await searchPosts(owner, new URLSearchParams(query));
    samples.push({ ...query, ms: performance.now() - started, total: result.total });
  }
  const sorted = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  const percentile = (ratio: number) => sorted[Math.ceil(sorted.length * ratio) - 1];
  const statements: { text: string; values: unknown[] }[] = [];
  const originalQuery = isolated.query;
  isolated.query = new Proxy(originalQuery, {
    apply(fn, thisArg, args) {
      if (typeof args[0] === 'string' && /^WITH (matching|candidates)/.test(args[0])) {
        statements.push({ text: args[0], values: Array.isArray(args[1]) ? args[1] : [] });
      }
      return Reflect.apply(fn, thisArg, args);
    },
  });
  const plans = [];
  try {
    for (const query of [workload[0], workload[3], workload[4]]) {
      statements.length = 0;
      await searchPosts(owner, new URLSearchParams(query));
      for (const [index, statement] of [...statements].entries()) {
        const result = await Reflect.apply(originalQuery, isolated, [
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement.text}`,
          statement.values,
        ]);
        plans.push({
          query,
          operation: statements.length === 1 ? 'count-and-page' : index === 0 ? 'count' : 'page',
          plan: result.rows[0]['QUERY PLAN'][0],
        });
      }
    }
  } finally {
    isolated.query = originalQuery;
  }
  report = {
    recordedAt: new Date().toISOString(),
    datasetOrigin: 'editorial, pas des requêtes réelles de Jean',
    environment: {
      node: process.version,
      postgres: (await isolated.query('SHOW server_version')).rows[0].server_version,
      os: `${platform()} ${arch()}`,
      cpu: cpus()[0]?.model,
      poolMax: 3,
      concurrency: 1,
      trigram: !!extension.rowCount,
    },
    isolation: {
      schema,
      postsTableSchema: relation.nspname,
      foreignSavedCount: foreignSaved.total,
      publicWrites: false,
      cleanup: 'pending',
    },
    relevance: {
      seed: metrics(seedPositives),
      technicalFixtures: metrics(positives.filter((entry) => entry.corpus === 'technical-fixtures')),
      allPositive: metrics(positives),
      exclusionsPassed: relevance.filter(
        (entry) => entry.kind === 'saved-exclusion' && entry.passed && entry.forbiddenAbsent,
      ).length,
      cases: relevance,
    },
    performance: {
      seedPosts: seed.length,
      technicalFixtures: evaluation.technicalFixtures.length,
      syntheticPosts: 10000,
      totalPosts: Number((await isolated.query('SELECT count(*) n FROM posts')).rows[0].n),
      syntheticSavedPosts: 1000,
      setupMs: bulkMs,
      warmupCalls: workload.length,
      measuredCalls: samples.length,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      maxMs: sorted.at(-1),
      targetMs: 500,
      meetsLocalTarget: percentile(0.95) < 500,
      samples,
    },
    plans,
  };
} finally {
  await isolated.end();
  if (created) {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    const remaining = await admin.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema]);
    if (remaining.rowCount) throw new Error('Le schéma de benchmark existe encore.');
    if (report) (report.isolation as Record<string, unknown>).cleanup = 'verified-removed';
  }
  await admin.end();
}
if (!report) throw new Error('Aucun résultat de benchmark.');
await mkdir('.local', { recursive: true });
await writeFile('.local/search-benchmark.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      report: '.local/search-benchmark.json',
      environment: report.environment,
      relevance: { ...(report.relevance as Record<string, unknown>), cases: undefined },
      performance: { ...(report.performance as Record<string, unknown>), samples: undefined },
      isolation: report.isolation,
    },
    null,
    2,
  ),
);
