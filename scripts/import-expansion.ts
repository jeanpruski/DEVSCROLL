import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { pool } from '../lib/db';
import { postSchema, questionSchema } from '../lib/contracts';
import { createPost, publishPost, saveDraft, createQuestion } from '../modules/content/service';

const target = new URL(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(target.hostname))
  throw new Error('Import local uniquement : utiliser le circuit éditorial pour une base distante.');
const posts = postSchema.array().parse(JSON.parse(await readFile('content/posts.json', 'utf8')));
const questions = questionSchema.array().parse(JSON.parse(await readFile('content/questions.json', 'utf8')));
const batch = JSON.parse(await readFile('content/batches/expansion-100.json', 'utf8')) as {
  id: string;
  slugs: string[];
  conceptKeys: string[];
};
const art = JSON.parse(await readFile('content/art-manifest.json', 'utf8')) as {
  assets: { url: string; kind: string; bytes: number }[];
};
const additions = posts.filter((p) => batch.slugs.includes(p.slug));
if (additions.length !== 100) throw new Error('Exactement 100 nouveaux posts attendus.');
async function snapshot() {
  return (
    await pool.query(
      `SELECT pg_database_size(current_database())::bigint "databaseBytes",(SELECT count(*) FROM posts WHERE status='published')::int "publishedPosts",(SELECT count(*) FROM post_versions)::int versions,(SELECT count(*) FROM question_versions)::int questions,(SELECT coalesce(sum(pg_column_size(content)),0) FROM post_versions)::bigint "storedContentBytes",(SELECT sum(pg_total_relation_size(t::regclass)) FROM unnest(ARRAY['posts','post_versions','question_versions','concepts','audit_log']) t)::bigint "contentTablesAndIndexesBytes"`,
    )
  ).rows[0];
}
const packed = (value: unknown) => {
  const bytes = Buffer.from(JSON.stringify(value));
  return {
    jsonBytes: bytes.length,
    gzipBytes: gzipSync(bytes).length,
    brotliBytes: brotliCompressSync(bytes).length,
  };
};
const lock = await pool.connect();
try {
  await lock.query('SELECT pg_advisory_lock(18251026)');
  const previousReport = await readFile('content/batches/expansion-100.usage.json', 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  const before = await snapshot(),
    started = performance.now();
  const owner = (await pool.query('SELECT id FROM "user" WHERE role=\'owner\' ORDER BY "createdAt" LIMIT 1'))
    .rows[0]?.id;
  if (!owner) throw new Error('Créer le propriétaire avant import.');
  let inserted = 0,
    recovered = 0,
    visualVersions = 0,
    preservedDrafts = 0;
  for (const post of additions) {
    const row = (
      await pool.query(
        'SELECT p.*,v.content FROM posts p JOIN post_versions v ON v.id=p.latest_version_id WHERE p.slug=$1',
        [post.slug],
      )
    ).rows[0];
    if (!row) {
      const created = await createPost(post, owner);
      await publishPost(created.id, owner);
      inserted++;
    } else if (row.status !== 'published') {
      if (!isDeepStrictEqual(postSchema.parse(row.content), { ...post, status: 'draft' }))
        throw new Error(`Un brouillon existant différent doit être relu : ${post.slug}`);
      await publishPost(row.id, owner);
      recovered++;
    }
  }
  for (const post of posts.filter((p) => !batch.slugs.includes(p.slug))) {
    const row = (
      await pool.query(
        "SELECT p.*,v.content FROM posts p JOIN post_versions v ON v.id=p.current_published_version_id WHERE p.slug=$1 AND p.status='published'",
        [post.slug],
      )
    ).rows[0];
    if (!row || isDeepStrictEqual(row.content.visual, post.visual)) continue;
    if (row.latest_version_id !== row.current_published_version_id) {
      preservedDrafts++;
      continue;
    }
    await saveDraft(row.id, { ...row.content, visual: post.visual }, owner);
    await publishPost(row.id, owner);
    visualVersions++;
  }
  let addedQuestions = 0;
  for (const q of questions.filter((q) => batch.conceptKeys.includes(q.conceptKey))) {
    if ((await pool.query('SELECT 1 FROM question_versions WHERE concept_key=$1', [q.conceptKey])).rowCount)
      continue;
    await createQuestion(q, owner);
    addedQuestions++;
  }
  const after = await snapshot();
  const verified = (
    await pool.query(
      "SELECT count(*)::int n FROM posts p JOIN post_versions v ON v.id=p.current_published_version_id WHERE p.status='published' AND p.slug=ANY($1::text[]) AND v.content ? 'visual'",
      [batch.slugs],
    )
  ).rows[0].n;
  if (verified !== 100) throw new Error('Le lot doit contenir 100 posts publiés et illustrés.');
  const newQuestions = questions.filter((q) => batch.conceptKeys.includes(q.conceptKey));
  const assets = await Promise.all(
    art.assets.map(async (a) => {
      const b = await readFile(`public${a.url}`);
      return {
        url: a.url,
        kind: a.kind,
        bytes: b.length,
        gzipBytes: gzipSync(b).length,
        brotliBytes: brotliCompressSync(b).length,
      };
    }),
  );
  const aggregate = assets.reduce(
    (n, a) => ({
      bytes: n.bytes + a.bytes,
      gzipBytes: n.gzipBytes + a.gzipBytes,
      brotliBytes: n.brotliBytes + a.brotliBytes,
    }),
    { bytes: 0, gzipBytes: 0, brotliBytes: 0 },
  );
  const usedNew = new Set(additions.map((p) => p.visual!.url));
  const measure = {
    batchId: batch.id,
    measuredAt: new Date().toISOString(),
    addedPosts: 100,
    totalCorpusPosts: posts.length,
    addedQuestions: newQuestions.length,
    postVisuals: posts.filter((p) => p.visual).length,
    visualAssignments: {
      logos: posts.filter((p) => p.visual?.kind === 'logo').length,
      stickers: posts.filter((p) => p.visual?.kind === 'sticker').length,
    },
    content: packed(additions),
    questions: packed(newQuestions),
    totalCorpus: packed({ posts, questions }),
    images: {
      uniqueFiles: assets.length,
      uniqueFilesUsedByNewPosts: usedNew.size,
      ...aggregate,
      files: assets,
    },
    generation: {
      method:
        'Rédaction dans cette conversation et SVG locaux ; aucun fournisseur de génération appelé par l’application.',
      providerApiCalls: 0,
      providerInputTokens: 0,
      providerOutputTokens: 0,
      providerCostUsd: 0,
      imageGenerationCalls: 0,
      imageGenerationCostUsd: 0,
      conversationTokens: null,
      conversationCost: null,
      pricingEstimate: false,
    },
    database: {
      before,
      after,
      physicalDatabaseDeltaBytes: Number(after.databaseBytes) - Number(before.databaseBytes),
      contentTablesAndIndexesDeltaBytes:
        Number(after.contentTablesAndIndexesBytes) - Number(before.contentTablesAndIndexesBytes),
      storedContentDeltaBytes: Number(after.storedContentBytes) - Number(before.storedContentBytes),
      note: 'Variation observée, incluant index, audit et nouvelles versions des visuels. La réutilisation de pages libres peut modifier le delta physique.',
    },
    import: {
      inserted,
      recovered,
      visualVersions,
      preservedDrafts,
      addedQuestions,
      durationMs: Math.round(performance.now() - started),
    },
    limits: [
      'Les tokens et le coût de la conversation ne sont pas exposés ; aucun montant n’est inventé.',
      'Les tailles gzip/brotli sont des mesures de compression sur le corpus, pas une facture réseau ni des tokens.',
      'Les images sont partagées et mises en cache : leur total unique n’est pas à multiplier par 100.',
    ],
  };
  if (inserted || !previousReport)
    await writeFile('content/batches/expansion-100.usage.json', JSON.stringify(measure, null, 2) + '\n');
  await mkdir('.local', { recursive: true });
  await writeFile('.local/last-expansion-import.json', JSON.stringify(measure, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        inserted,
        recovered,
        visualVersions,
        preservedDrafts,
        addedQuestions,
        publishedIllustrated: verified,
        before,
        after,
        content: measure.content,
        images: aggregate,
        apiCostUsd: 0,
        durationMs: measure.import.durationMs,
      },
      null,
      2,
    ),
  );
  // The first real import is retained; idempotence runs must not overwrite its before/after evidence.
  const retained = previousReport && inserted === 0 ? previousReport : measure;
  const kb = (n: number) => (n / 1024).toFixed(1) + ' Kio';
  await writeFile(
    'docs/CONTENT-CONSUMPTION.md',
    `# Lot de 100 posts : consommation mesurée\n\nMesure réelle du ${retained.measuredAt}. 100 nouveaux posts et 100 QCM ; corpus total de 130 posts avec un visuel chacun.\n\n| Ressource | Mesure |\n| --- | --- |\n| JSON des 100 posts | ${kb(retained.content.jsonBytes)} |\n| Même JSON compressé gzip | ${kb(retained.content.gzipBytes)} |\n| Même JSON compressé Brotli | ${kb(retained.content.brotliBytes)} |\n| JSON des 100 QCM | ${kb(retained.questions.jsonBytes)} |\n| Visuels uniques : ${retained.images.uniqueFiles} SVG | ${kb(retained.images.bytes)} |\n| SVG compressés séparément avec gzip, total | ${kb(retained.images.gzipBytes)} |\n| Variation physique PostgreSQL observée | ${kb(retained.database.physicalDatabaseDeltaBytes)} |\n| Variation tables de contenu + index + audit | ${kb(retained.database.contentTablesAndIndexesDeltaBytes)} |\n| Variation données JSON stockées des versions | ${kb(retained.database.storedContentDeltaBytes)} |\n| Appels API de génération de l’application | 0 |\n| Tokens API de l’application | 0 entrée / 0 sortie |\n| Coût API de génération texte/images | 0 USD |\n| Tokens/coût de cette conversation | Non accessibles |\n\nLes textes ont été rédigés dans cette conversation. Les visuels utilisent des tracés de logos Simple Icons et des stickers SVG locaux ; aucun appel payant de génération d’image. Les consommations de la conversation ne sont pas incluses dans « 0 USD API » et ne sont pas mesurables ici. Il ne s’agit donc pas d’un benchmark du prix d’un fournisseur IA.\n\nLes ${retained.images.uniqueFiles} fichiers sont partagés entre les posts, dont ${retained.images.uniqueFilesUsedByNewPosts} utilisés par les nouveaux. URLs avec empreinte, cache public long, dimensions réservées, chargement paresseux. Le poids unique n’est pas multiplié par cent ; un navigateur ayant déjà chargé un visuel peut le réutiliser. gzip/Brotli désignent des mesures locales de compression, sans promettre le même transfert sur tous les hébergeurs.\n\nL’import préserve les posts et réponses existants. Les visuels des 30 premiers posts passent par de nouvelles versions éditoriales ; un brouillon en cours est conservé. Le delta PostgreSQL inclut ces versions, les index et l’audit, et peut varier selon la réutilisation des pages libres. Le fichier de preuve détaillé est [expansion-100.usage.json](../content/batches/expansion-100.usage.json).\n\nCommandes : \`npm run content:build\`, \`npm run content:import\`, puis une seconde importation pour vérifier zéro ajout. La première mesure reste conservée pour ne pas remplacer le coût initial par celui d’un import vide.\n`,
  );
} finally {
  await lock.query('SELECT pg_advisory_unlock(18251026)').catch(() => {});
  lock.release();
  await pool.end();
}
