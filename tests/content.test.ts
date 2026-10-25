import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { postSchema, questionSchema } from '../lib/contracts';

const rawPosts: unknown[] = JSON.parse(readFileSync('content/posts.json', 'utf8'));
const rawQuestions: unknown[] = JSON.parse(readFileSync('content/questions.json', 'utf8'));
const posts = rawPosts.map((post) => postSchema.parse(post));
const questions = rawQuestions.map((question) => questionSchema.parse(question));
const require = createRequire(import.meta.url);

describe('corpus éditorial initial', () => {
  it('livre 30 posts publiables avec la diversité et la traçabilité demandées', () => {
    expect(posts).toHaveLength(30);
    expect(new Set(posts.map((post) => post.slug)).size).toBe(posts.length);
    expect(new Set(posts.map((post) => post.topic)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(posts.map((post) => post.format)).size).toBeGreaterThanOrEqual(6);
    expect(posts.filter((post) => post.format === 'carousel').length).toBeGreaterThanOrEqual(3);
    for (const post of posts) {
      expect(post.status).toBe('published');
      expect(post.flags).toEqual([]);
      expect(post.sources.length).toBeGreaterThan(0);
      expect(post.verification?.length).toBeGreaterThan(20);
      for (const source of post.sources) {
        expect(source.accessedAt).toBe('2026-10-25');
        expect(source.claims.length).toBeGreaterThan(0);
      }
      if (post.format === 'carousel') expect(post.blocks.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('associe à chaque notion une question unique avec solution valide', () => {
    const concepts = new Set(posts.map((post) => post.conceptKey));
    expect(questions.length).toBeGreaterThanOrEqual(12);
    expect(new Set(questions.map((question) => question.conceptKey))).toEqual(concepts);
    for (const question of questions) {
      expect(concepts.has(question.conceptKey)).toBe(true);
      expect(question.choices.filter((choice) => choice.id === question.correctChoiceId)).toHaveLength(1);
    }
  });

  it('prépare 60 autres sujets distincts avec des identifiants stables', () => {
    const backlog = JSON.parse(readFileSync('content/backlog.json', 'utf8')) as {
      id: string;
      conceptKey: string;
      title: string;
      topic: string;
      angle: string;
      format: string;
    }[];
    expect(backlog).toHaveLength(60);
    expect(new Set(backlog.map((item) => item.id)).size).toBe(60);
    expect(new Set(backlog.map((item) => item.conceptKey)).size).toBe(60);
    const initialConcepts = new Set(posts.map((post) => post.conceptKey));
    for (const item of backlog) {
      expect(initialConcepts.has(item.conceptKey)).toBe(false);
      expect(item.angle.length).toBeGreaterThan(15);
      expect(item.topic).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.format).toBeTruthy();
    }
  });
});

// Only these reviewed, fixed editorial examples are executed here. This is not
// an application endpoint for running imported or generated content.
describe('exemples exécutables relus', () => {
  const expected: Record<string, string> = {
    'promise-all-ne-stoppe-pas-les-autres-promesses': 'rejet → terminé',
    'microtaches-avant-le-prochain-timer': 'A\nB\nP\nQ\nT',
    'closure-garde-acces-variable': '1 2 1',
    'node-eventemitter-synchrone': 'avant\nlistener\naprès',
    'backoff-jitter-eviter-le-rendez-vous': '250\n1000\n15000',
  };

  for (const [slug, output] of Object.entries(expected)) {
    it(`exécute l’extrait exact de ${slug}`, () => {
      const block = posts.find((post) => post.slug === slug)?.blocks.find((item) => item.type === 'code');
      expect(block?.type).toBe('code');
      if (!block || block.type !== 'code') throw new Error(`Extrait absent : ${slug}`);
      const result = execFileSync(process.execPath, ['--input-type=module', '-e', block.code], {
        timeout: 2_000,
        encoding: 'utf8',
        env: { PATH: process.env.PATH, NODE_ENV: 'test' },
      });
      expect(result.trim()).toBe(output);
    });
  }

  it('vérifie réellement les types de satisfies puis exécute son JavaScript', () => {
    const post = posts.find((item) => item.slug === 'typescript-satisfies-valider-sans-elargir');
    const block = post?.blocks.find((item) => item.type === 'code');
    if (!block || block.type !== 'code') throw new Error('Extrait TypeScript absent');
    const directory = mkdtempSync(join(tmpdir(), 'devscroll-editorial-'));
    try {
      const file = join(directory, 'satisfies.ts');
      writeFileSync(file, block.code);
      execFileSync(
        process.execPath,
        [
          require.resolve('typescript/bin/tsc'),
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--target',
          'es2022',
          '--module',
          'esnext',
          file,
        ],
        { timeout: 15_000 },
      );
      const emitted = ts.transpileModule(block.code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
      const result = execFileSync(process.execPath, ['--input-type=module', '-e', emitted.outputText], {
        timeout: 2_000,
        encoding: 'utf8',
        env: { PATH: process.env.PATH, NODE_ENV: 'test' },
      });
      expect(result.trim()).toBe('LOCALHOST 3000');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
