import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { postSchema, visualSchema } from '../lib/contracts';
import { getPostVisual } from '../lib/post-visual';

const posts = postSchema.array().parse(JSON.parse(readFileSync('content/posts.json', 'utf8')));
const batch = JSON.parse(readFileSync('content/batches/expansion-100.json', 'utf8')) as { slugs: string[] };
const additions = posts.filter((p) => batch.slugs.includes(p.slug));

describe('extension éditoriale et visuels locaux', () => {
  it('ajoute cent textes distincts substantiels avec sources et contexte', () => {
    expect(additions).toHaveLength(100);
    expect(new Set(additions.map((p) => p.title)).size).toBe(100);
    expect(new Set(additions.map((p) => p.sources[0].url)).size).toBe(100);
    const firstParagraphs = additions.map((p) => p.blocks.find((b) => b.type === 'paragraph'));
    expect(new Set(firstParagraphs.map((b) => JSON.stringify(b))).size).toBe(100);
    for (const p of additions) {
      const words = p.blocks
        .filter((b) => b.type === 'paragraph')
        .map((b) => b.text)
        .join(' ')
        .split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(90);
      expect(words).toBeLessThanOrEqual(180);
      expect(p.learningObjective.length).toBeGreaterThan(10);
      expect(p.sources[0].claims).toContain(p.takeaway);
    }
  });
  it('sert un vrai SVG local pour chacun des 130 posts, avec un mélange logos et stickers', () => {
    const kinds = new Set();
    for (const p of posts) {
      const art = getPostVisual(p);
      kinds.add(art.kind);
      expect(existsSync(`public${art.url}`)).toBe(true);
      const svg = readFileSync(`public${art.url}`, 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).not.toMatch(/<(?:script|foreignObject|image|use)\b|\bon\w+=|(?:href|xlink:href)=/i);
      expect(Buffer.byteLength(svg)).toBeLessThan(10000);
      expect(art.alt.length).toBeGreaterThan(5);
    }
    expect(kinds).toEqual(new Set(['logo', 'sticker']));
    const unknown = getPostVisual({ slug: 'nouveau-sujet', topic: 'inconnu' });
    expect(existsSync(`public${unknown.url}`)).toBe(true);
  });
  it('refuse les chemins de visuels arbitraires et conserve les anciens posts sans couverture explicite', () => {
    for (const url of [
      '/post-art/../../.env',
      'https://example.org/a.svg',
      '/api/export',
      '/post-art/a.svg?secret=1',
    ])
      expect(visualSchema.safeParse({ kind: 'sticker', url, alt: 'Test visuel' }).success).toBe(false);
    const old = { ...posts[0], visual: undefined };
    expect(postSchema.safeParse(old).success).toBe(true);
    expect(getPostVisual(old).url).toMatch(/^\/post-art\//);
  });
});
