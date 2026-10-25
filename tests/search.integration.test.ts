import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { postSchema } from '../lib/contracts';

const configured = !!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production';
describe.skipIf(!configured)('recherche réelle dans un schéma PostgreSQL isolé', () => {
  const schema = `devscroll_search_test_${randomUUID().replaceAll('-', '')}`;
  const owner = randomUUID();
  const other = randomUUID();
  const marker = `searchfixture${randomUUID().replaceAll('-', '')}`;
  const postIds: string[] = [];
  let admin: Pool;
  let isolated: Pool;
  let searchPosts: typeof import('../modules/search/service').searchPosts;
  let created = false;
  let previousPool: Pool | undefined;

  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL!);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname))
      throw new Error('Ces tests exigent PostgreSQL loopback.');
    admin = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    isolated = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      options: `-c search_path=${schema},public -c statement_timeout=10000`,
    });
    await admin.query(`CREATE SCHEMA ${schema}`);
    created = true;
    await isolated.query(await readFile('migrations/001_core.sql', 'utf8'));
    await isolated.query(await readFile('migrations/007_search_performance.sql', 'utf8'));
    await isolated.query(await readFile('migrations/008_search_hints.sql', 'utf8'));
    expect((await isolated.query('SELECT current_schema() n')).rows[0].n).toBe(schema);
    previousPool = (globalThis as unknown as { devscrollPool?: Pool }).devscrollPool;
    (globalThis as unknown as { devscrollPool?: Pool }).devscrollPool = isolated;
    const service = await import('../modules/search/service');
    searchPosts = service.searchPosts;
    const { searchableText } = await import('../modules/content/service');
    const seed = postSchema.array().parse(JSON.parse(await readFile('content/posts.json', 'utf8')));
    await isolated.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3),($4,$5,$6)', [
      owner,
      'Fixture',
      `${owner}@example.invalid`,
      other,
      'Other',
      `${other}@example.invalid`,
    ]);
    for (let i = 0; i < 16; i++) {
      const content = {
        ...seed[0],
        slug: `${marker}-${i}`,
        title: `Recherche indépendante ${marker} ${i}`,
        conceptKey: `${marker}.${i}`,
        searchAliases: [marker, ...(i === 0 ? ['annuler requête'] : [])],
        context: { technology: i === 0 ? 'C++ C# .env Promise.all CI/CD Node.js' : 'Fixture', version: null },
        blocks: [
          {
            type: 'paragraph' as const,
            text: i === 0 ? 'Opération avec AbortController.' : 'Texte de contrôle indépendant.',
          },
        ],
      };
      const text = searchableText(content);
      const id = randomUUID();
      const vid = randomUUID();
      postIds.push(id);
      await isolated.query('INSERT INTO concepts(key,objective) VALUES($1,$2)', [
        content.conceptKey,
        content.learningObjective,
      ]);
      await isolated.query('INSERT INTO posts(id,slug,status,concept_key) VALUES($1,$2,$3,$4)', [
        id,
        content.slug,
        i === 15 ? 'draft' : 'published',
        content.conceptKey,
      ]);
      await isolated.query(
        `INSERT INTO post_versions(id,post_id,version,content,search_fr,search_simple,search_normalized,published_at)
        VALUES($1,$2,1,$3,setweight(to_tsvector('french',$4),'A')||setweight(to_tsvector('french',$5),'B'),
        setweight(to_tsvector('simple',$4),'A')||setweight(to_tsvector('simple',$5),'B'),$6,now())`,
        [vid, id, JSON.stringify(content), text.title, text.body, text.normalized],
      );
      await isolated.query(
        'UPDATE posts SET latest_version_id=$2,current_published_version_id=$3 WHERE id=$1',
        [id, vid, i === 15 ? null : vid],
      );
    }
    await isolated.query('INSERT INTO saved_posts(user_id,post_id) VALUES($1,$2)', [owner, postIds[0]]);
  }, 20_000);

  afterAll(async () => {
    if (isolated) await isolated.end();
    if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    if (admin) await admin.end();
    (globalThis as unknown as { devscrollPool?: Pool }).devscrollPool = previousPool;
  });

  it('retrouve les identifiants ponctués présents uniquement dans les métadonnées', async () => {
    for (const q of ['C++', 'C#', '.env', 'Promise.all', 'CI/CD', 'Node.js']) {
      const result = await searchPosts(owner, new URLSearchParams({ q }));
      expect(
        result.posts.map((post) => post.id),
        q,
      ).toContain(postIds[0]);
      expect(
        result.posts.map((post) => post.id),
        q,
      ).not.toContain(postIds[15]);
    }
  });

  it('garde le périmètre des favoris avant total et pagination, avec accents et alias', async () => {
    const params = new URLSearchParams({ q: 'annuler requete', scope: 'saved' });
    const own = await searchPosts(owner, params);
    expect(own.total).toBe(1);
    expect(own.posts.map((post) => post.id)).toEqual([postIds[0]]);
    const foreign = await searchPosts(other, params);
    expect(foreign.total).toBe(0);
    expect(foreign.posts).toEqual([]);
  });

  it('pagine sans doublon et refuse un curseur réutilisé par un autre compte', async () => {
    const first = await searchPosts(owner, new URLSearchParams({ q: marker }));
    expect(first.total).toBe(15);
    expect(first.posts).toHaveLength(12);
    expect(first.nextCursor).toBeTruthy();
    const second = await searchPosts(owner, new URLSearchParams({ q: marker, cursor: first.nextCursor! }));
    expect(second.total).toBe(15);
    expect(second.posts).toHaveLength(3);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.posts, ...second.posts].map((post) => post.id)).size).toBe(15);
    await expect(
      searchPosts(other, new URLSearchParams({ q: marker, cursor: first.nextCursor! })),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    await expect(
      searchPosts(owner, new URLSearchParams({ q: 'autre', cursor: first.nextCursor! })),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it('conserve un total correct quand des retraits vident une page déjà demandée', async () => {
    const first = await searchPosts(owner, new URLSearchParams({ q: marker }));
    const changed = postIds.slice(1, 4);
    try {
      await isolated.query("UPDATE posts SET status='draft' WHERE id=ANY($1::uuid[])", [changed]);
      const after = await searchPosts(owner, new URLSearchParams({ q: marker, cursor: first.nextCursor! }));
      expect(after.total).toBe(12);
      expect(after.posts).toEqual([]);
      expect(after.nextCursor).toBeNull();
    } finally {
      await isolated.query("UPDATE posts SET status='published' WHERE id=ANY($1::uuid[])", [changed]);
    }
  });

  it('montre un favori retiré sans contenu et sans le faire ressortir à la recherche', async () => {
    try {
      await isolated.query("UPDATE posts SET status='draft',current_published_version_id=NULL WHERE id=$1", [
        postIds[0],
      ]);
      const empty = await searchPosts(owner, new URLSearchParams({ scope: 'saved' }));
      expect(empty.total).toBe(1);
      expect(empty.posts[0]).toMatchObject({ unavailable: true });
      expect(empty.posts[0]).not.toHaveProperty('blocks');
      const query = await searchPosts(owner, new URLSearchParams({ scope: 'saved', q: marker }));
      expect(query.total).toBe(0);
      expect(query.posts).toEqual([]);
    } finally {
      await isolated.query(
        "UPDATE posts SET status='published',current_published_version_id=latest_version_id WHERE id=$1",
        [postIds[0]],
      );
    }
  });

  it('garde une recherche exacte et les alias fonctionnels sans la branche pg_trgm', async () => {
    const previous = isolated.query;
    isolated.query = new Proxy(previous, {
      apply(fn, thisArg, args) {
        if (typeof args[0] === 'string' && args[0].includes("FROM pg_extension WHERE extname='pg_trgm'")) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        return Reflect.apply(fn, thisArg, args);
      },
    });
    try {
      for (const q of ['Node.js', '.env', 'annuler requete']) {
        const result = await searchPosts(owner, new URLSearchParams({ q, scope: 'saved' }));
        expect(result.searchMode).toBe('lexical');
        expect(result.posts.map((post) => post.id)).toContain(postIds[0]);
      }
    } finally {
      isolated.query = previous;
    }
  });
});
