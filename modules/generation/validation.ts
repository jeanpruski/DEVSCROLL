import { postSchema, type PostContent } from '../../lib/contracts';
import { GenerationError } from './errors';
import type { DraftRequest } from './provider';
import type { SourceExcerpt } from './sources';
import { getPostVisual } from '../../lib/post-visual';

export function validateGeneratedDraft(
  output: unknown,
  request: DraftRequest,
  sources: SourceExcerpt[],
): PostContent {
  if (output && typeof output === 'object' && 'incomplete' in output && output.incomplete === true) {
    throw new GenerationError(
      422,
      'SOURCE_INSUFFICIENT',
      'Le modèle signale des sources insuffisantes. Complète les références avant un nouveau lot.',
    );
  }
  const result = postSchema.safeParse(output);
  if (!result.success)
    throw new GenerationError(
      422,
      'OUTPUT_SCHEMA',
      'Le brouillon généré ne respecte pas le contrat éditorial.',
    );
  const post = result.data;
  if (!post.sources.length || post.sources.some((s) => !sources.some((actual) => actual.url === s.url))) {
    throw new GenerationError(
      422,
      'OUTPUT_SOURCES',
      'Les affirmations doivent être reliées aux seules sources réellement récupérées.',
    );
  }
  if (
    post.conceptKey !== request.conceptKey ||
    post.topic !== request.topic ||
    post.difficulty !== request.difficulty ||
    post.format !== request.format
  ) {
    throw new GenerationError(
      422,
      'OUTPUT_REQUEST',
      'Le brouillon ne correspond pas à la notion et aux paramètres demandés.',
    );
  }
  if (post.blocks.some((b) => b.type === 'image'))
    throw new GenerationError(
      422,
      'OUTPUT_IMAGE',
      'La génération IA initiale accepte seulement texte, code et comparaisons.',
    );
  return {
    ...post,
    status: 'draft',
    visual: getPostVisual({ ...post, visual: undefined }),
    flags: [
      ...new Set([
        ...post.flags,
        ...(post.blocks.some((b) => b.type === 'code') ? ['code_unverified' as const] : []),
      ]),
    ],
    // Provider-supplied dates/titles are replaced by the server's retrieval metadata.
    sources: post.sources.map((s) => {
      const actual = sources.find((a) => a.url === s.url)!;
      return {
        ...s,
        title: actual.title,
        publisher: actual.publisher,
        accessedAt: actual.accessedAt,
        publishedAt: null,
      };
    }),
    verification:
      'Brouillon IA. Vérification humaine requise : affirmations et extraits, contexte/version, prérequis, code non exécuté et absence de doublon.',
  };
}
