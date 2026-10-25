import { z } from 'zod';

export const formats = ['concept', 'tip', 'pitfall', 'code', 'history', 'comparison', 'carousel'] as const;
export const difficulties = ['beginner', 'intermediate', 'advanced'] as const;
const safeUrl = z
  .string()
  .url()
  .refine((v) => {
    try {
      const u = new URL(v);
      return (
        u.protocol === 'https:' &&
        !u.username &&
        !u.password &&
        !u.hostname.startsWith('[') &&
        !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) &&
        !/(^|\.)(localhost|local|internal|invalid|test)$/.test(u.hostname)
      );
    } catch {
      return false;
    }
  }, 'URL HTTPS publique sans identifiants requise');
export const sourceSchema = z.object({
  url: safeUrl,
  title: z.string().min(1).max(300),
  publisher: z.string().min(1).max(150),
  accessedAt: z.string().min(10),
  publishedAt: z.string().nullable().optional(),
  claims: z.array(z.string().max(1000)).min(1).max(15),
});
export const visualSchema = z.object({
  kind: z.enum(['logo', 'sticker']),
  url: z.string().regex(/^\/post-art\/[a-z0-9-]+\.svg$/),
  alt: z.string().min(3).max(300),
});
export const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().min(1).max(5000) }),
  z.object({ type: z.literal('list'), items: z.array(z.string().max(1000)).min(1).max(20) }),
  z.object({ type: z.literal('code'), language: z.string().max(30), code: z.string().min(1).max(10000) }),
  z.object({
    type: z.literal('comparison'),
    left: z.string().max(3000),
    right: z.string().max(3000),
    leftLabel: z.string().max(80),
    rightLabel: z.string().max(80),
  }),
  z.object({ type: z.literal('image'), url: safeUrl, alt: z.string().min(1).max(500) }),
]);
export const postSchema = z.object({
  schemaVersion: z.literal(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(160),
  locale: z.literal('fr'),
  title: z.string().min(5).max(180),
  format: z.enum(formats),
  difficulty: z.enum(difficulties),
  topic: z.string().min(1).max(60),
  tags: z.array(z.string().max(60)).max(5),
  conceptKey: z.string().min(3).max(150),
  learningObjective: z.string().min(5).max(600),
  blocks: z.array(blockSchema).min(1).max(20),
  takeaway: z.string().min(5).max(700),
  searchAliases: z.array(z.string().max(150)).max(30),
  context: z.object({ technology: z.string().max(100), version: z.string().max(100).nullable() }),
  sources: z.array(sourceSchema).max(20),
  reviewAfterDays: z.number().int().min(1).max(730),
  status: z.enum(['idea', 'draft', 'review', 'published', 'archived']),
  flags: z.array(z.enum(['needs_sources', 'code_unverified', 'stale', 'reported'])).default([]),
  verification: z.string().max(2000).optional(),
  visual: visualSchema.optional(),
});
export const questionSchema = z
  .object({
    conceptKey: z.string().min(3),
    prompt: z.string().min(10).max(1200),
    choices: z
      .array(z.object({ id: z.string().min(1).max(40), text: z.string().min(1).max(700) }))
      .min(3)
      .max(4),
    correctChoiceId: z.string(),
    explanation: z.string().min(10).max(3000),
  })
  .superRefine((q, ctx) => {
    if (
      new Set(q.choices.map((c) => c.id)).size !== q.choices.length ||
      !q.choices.some((c) => c.id === q.correctChoiceId)
    )
      ctx.addIssue({ code: 'custom', message: 'Choix uniques et solution valide requis' });
  });

export type PostContent = z.infer<typeof postSchema>;
export type Block = z.infer<typeof blockSchema>;
export type QuestionContent = z.infer<typeof questionSchema>;
export type PublicPost = PostContent & {
  id: string;
  versionId: string;
  version: number;
  saved: boolean;
  savedAt?: string | null;
  publishedAt?: string;
  unavailable?: boolean;
};
export type PublicQuestion = {
  id: string;
  conceptKey: string;
  prompt: string;
  choices: { id: string; text: string }[];
  postSlug?: string;
  opportunityId?: string;
  mode?: 'immediate' | 'review';
};
export type AppUser = { id: string; name: string; email: string; role: string };
export const topicLabels: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  react: 'React',
  node: 'Node.js',
  sql: 'SQL & données',
  http: 'HTTP & API',
  linux: 'Linux',
  devops: 'DevOps',
  cloud: 'Cloud',
  integrations: 'Intégrations',
  ai: 'Intelligence artificielle',
  culture: 'Culture technique',
  security: 'Sécurité',
  web: 'Web',
};
export const formatLabels: Record<string, string> = {
  concept: 'Notion',
  tip: 'Astuce',
  pitfall: 'Piège',
  code: 'Code',
  history: 'Histoire',
  comparison: 'Comparaison',
  carousel: 'Carrousel',
};
export const difficultyLabels: Record<string, string> = {
  beginner: 'Rappel',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};
