import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { postSchema, questionSchema, topicLabels, type PostContent } from '../lib/contracts';
import { getPostVisual } from '../lib/post-visual';
import { expansion } from '../content/batches/expansion-100.source.mjs';

const date = '2026-10-25';
const original = postSchema.array().parse(JSON.parse(await readFile('content/posts.json', 'utf8')));
const originalQuestions = questionSchema
  .array()
  .parse(JSON.parse(await readFile('content/questions.json', 'utf8')));
const backlog = JSON.parse(await readFile('content/backlog.json', 'utf8')) as {
  id: string;
  title: string;
  topic: string;
  conceptKey: string;
  angle: string;
  format: PostContent['format'];
  status: string;
  postSlug?: string;
}[];
const audit = JSON.parse(await readFile('content/batches/expansion-100.sources.json', 'utf8')) as {
  url: string;
  status: number;
  title: string;
  textBytes: number;
}[];
const base = original.filter((p) => !expansion.some((e) => e.slug === p.slug));
if (base.length !== 30 || expansion.length !== 100)
  throw new Error('Le lot exige 30 posts préservés et exactement 100 nouvelles notions.');
const additions = expansion.map((entry) => {
  const idea = backlog.find((b) => b.id === `CONTENT-${entry.id.toString().padStart(3, '0')}`);
  const topic = 'topic' in entry ? entry.topic : idea?.topic;
  const title = 'title' in entry ? entry.title : idea?.title;
  const conceptKey = 'conceptKey' in entry ? entry.conceptKey : idea?.conceptKey;
  if (!topic || !title || !conceptKey) throw new Error(`Métadonnées absentes pour ${entry.id}`);
  const reference = audit.find((a) => a.url === entry.source);
  const verifiedBash = entry.id === 63 || entry.id === 64;
  if ((!reference || reference.status !== 200 || reference.textBytes < 100) && !verifiedBash)
    throw new Error(`Référence à contrôler : ${entry.id} ${entry.source}`);
  const sourceTitle = reference?.title || `GNU Bash — ${entry.id === 63 ? 'Exit Status' : 'Pipelines'}`;
  const format =
    idea?.format === 'code'
      ? 'concept'
      : idea?.format || (['concept', 'tip', 'pitfall', 'comparison', 'carousel'] as const)[entry.id % 5];
  const post = postSchema.parse({
    schemaVersion: 1,
    slug: entry.slug,
    locale: 'fr',
    title,
    topic,
    format,
    difficulty: [52, 81, 88, 115, 123].includes(entry.id)
      ? 'advanced'
      : entry.id % 7 === 0
        ? 'beginner'
        : 'intermediate',
    tags: [topic, entry.slug.split('-').slice(1, 3).join('-')],
    conceptKey,
    learningObjective: idea?.angle || entry.takeaway,
    blocks: entry.text.map((text) => ({ type: 'paragraph', text })),
    takeaway: entry.takeaway,
    searchAliases: [title, entry.slug.replaceAll('-', ' ')],
    context: {
      technology: topicLabels[topic] || topic,
      version:
        topic === 'sql'
          ? 'PostgreSQL 16'
          : topic === 'typescript'
            ? 'TypeScript 5.9'
            : topic === 'react'
              ? 'React 19'
              : topic === 'node'
                ? 'Node.js 22'
                : null,
    },
    sources: [
      {
        url: entry.source,
        title: sourceTitle.replaceAll('&lt;', '<').replaceAll('&gt;', '>'),
        publisher: new URL(entry.source).hostname.replace(/^www\./, ''),
        accessedAt: date,
        claims: [entry.takeaway],
      },
    ],
    reviewAfterDays: ['ai', 'integrations', 'cloud'].includes(topic) ? 60 : 180,
    status: 'published',
    flags: [],
    verification: verifiedBash
      ? 'Comportement exact vérifié avec /bin/bash : sorties 0, 7, pipeline 0 et pipefail 1. Référence GNU consultée, puis contrôle HTTP direct réussi après une première indisponibilité. Revue éditoriale de la notion et du QCM, sans relecture humaine indépendante.'
      : 'Rédaction originale relue avec la documentation de référence consultée le 25 octobre 2026. Les liens et contenus récupérés sont tracés dans l’audit local ; un HTTP 200 n’est pas une validation factuelle. Aucun extrait de code arbitraire exécuté ; contexte et limites précisés. Relecture humaine indépendante non effectuée.',
  });
  return { ...post, visual: getPostVisual(post) };
});
const questions = expansion.map((e, i) =>
  questionSchema.parse({
    conceptKey: additions[i].conceptKey,
    prompt: e.quiz[0],
    choices: e.quiz.slice(1).map((text, j) => ({ id: ['a', 'b', 'c'][j], text })),
    correctChoiceId: 'a',
    explanation: e.takeaway,
  }),
);
const posts = [...base.map((p) => ({ ...p, visual: getPostVisual(p) })), ...additions];
const allQuestions = [
  ...originalQuestions.filter((q) => !additions.some((p) => p.conceptKey === q.conceptKey)),
  ...questions,
];
if (new Set(posts.map((p) => p.slug)).size !== 130 || new Set(posts.map((p) => p.conceptKey)).size !== 130)
  throw new Error('Doublon éditorial.');
const manifest = {
  id: 'expansion-100-2026-10-25',
  createdAt: date,
  originalCount: 30,
  addedCount: 100,
  slugs: additions.map((p) => p.slug),
  conceptKeys: additions.map((p) => p.conceptKey),
  postsSha256: createHash('sha256').update(JSON.stringify(additions)).digest('hex'),
  method: 'Rédaction dans la conversation ; visuels SVG locaux partagés.',
  providerApiCalls: 0,
  providerInputTokens: 0,
  providerOutputTokens: 0,
  providerCostUsd: 0,
  conversationTokens: null,
  conversationCost: null,
};
await mkdir('content/batches', { recursive: true });
await writeFile('content/posts.json', JSON.stringify(posts, null, 2) + '\n');
await writeFile('content/questions.json', JSON.stringify(allQuestions, null, 2) + '\n');
await writeFile('content/batches/expansion-100.json', JSON.stringify(manifest, null, 2) + '\n');
await writeFile(
  'content/backlog.json',
  JSON.stringify(
    backlog.map((b) => {
      const p = additions.find((p) => p.conceptKey === b.conceptKey);
      return p ? { ...b, status: 'published', postSlug: p.slug } : b;
    }),
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    posts: posts.length,
    questions: allQuestions.length,
    added: additions.length,
    visuals: posts.filter((p) => p.visual).length,
    logos: posts.filter((p) => p.visual.kind === 'logo').length,
    stickers: posts.filter((p) => p.visual.kind === 'sticker').length,
  }),
);
