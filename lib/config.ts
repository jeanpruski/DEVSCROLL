import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
});
export function validateConfig() {
  return schema.parse(process.env);
}
export const feedConfig = {
  version: 1,
  pageSize: 6,
  sessionMinutes: 30,
  recentExposureDays: 7,
  qualifiedMs: 5000,
  qualifiedRatio: 0.6,
  postsPerQuestion: 5,
  maxQuestions: 3,
} as const;
