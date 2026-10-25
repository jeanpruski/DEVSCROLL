import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { pool } from '../lib/db';
import {
  createPost,
  publishPost,
  saveDraft,
  getPost,
  savePost,
  createQuestion,
} from '../modules/content/service';
import { getFeed, recordExposure, encodeCursor, decodeCursor } from '../modules/feed/service';
import { getReviews, submitAttempt, revalidateConcept } from '../modules/reviews/service';
import { searchPosts } from '../modules/search/service';
import { importPosts, adminPost, listPosts } from '../modules/content/admin';
import { changeStatus } from '../modules/content/service';
import { runMaintenance } from '../modules/feed/maintenance';
import type { PostContent } from '../lib/contracts';

const configured = !!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production';
describe.skipIf(!configured)('PostgreSQL integration (isolated fixtures)', () => {
  const suffix = randomUUID().slice(0, 8),
    owner = randomUUID(),
    reader = randomUUID();
  const ids: string[] = [];
  const concepts: string[] = [];
  let questionId: string;
  let subjectId: string;
  let slug: string;
  function content(i: number): PostContent {
    return {
      schemaVersion: 1,
      slug: `integration-${suffix}-${i}`,
      locale: 'fr',
      title: `AbortController et identifiants techniques ${suffix} ${i}`,
      format: 'concept',
      difficulty: 'intermediate',
      topic: i % 2 ? 'javascript' : 'sql',
      tags: ['test'],
      conceptKey: `integration.${suffix}.${i}`,
      learningObjective: 'Tester une notion sans modifier le corpus.',
      blocks: [
        {
          type: 'paragraph',
          text: 'C++ C# .env Promise.all CI/CD Node.js : annuler une requête avec AbortController.',
        },
      ],
      takeaway: 'Une annulation reste explicite.',
      searchAliases: [`annuler requête ${suffix}`, `testisolated${suffix}`],
      context: { technology: 'Web', version: null },
      sources: [
        {
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController',
          title: 'AbortController',
          publisher: 'MDN',
          accessedAt: '2026-10-25',
          claims: ['Annuler une requête.'],
        },
      ],
      reviewAfterDays: 180,
      status: 'draft',
      flags: [],
    };
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && !url.pathname.includes('test'))
      throw new Error('Utiliser une base de test ou locale.');
    await pool.query(
      "INSERT INTO \"user\"(id,name,email,role) VALUES($1,'Test owner',$2,'owner'),($3,'Test reader',$4,'reader')",
      [owner, `owner-${suffix}@test.invalid`, reader, `reader-${suffix}@test.invalid`],
    );
    for (let i = 0; i < 19; i++) {
      const p = await createPost(content(i), owner);
      ids.push(p.id);
      concepts.push(p.content.conceptKey);
      if (i < 18) await publishPost(p.id, owner);
    }
    subjectId = ids[0];
    slug = content(0).slug;
    questionId = (
      await createQuestion(
        {
          conceptKey: concepts[0],
          prompt: 'Comment annuler explicitement une requête compatible ?',
          choices: [
            { id: 'signal', text: 'Transmettre un AbortSignal.' },
            { id: 'race', text: 'Ignorer son résultat.' },
            { id: 'all', text: 'Utiliser Promise.all.' },
          ],
          correctChoiceId: 'signal',
          explanation: 'La requête reçoit un AbortSignal puis le contrôleur déclenche abort().',
        },
        owner,
      )
    ).id;
  });
  afterAll(async () => {
    await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [[owner, reader]]);
    await pool.query(
      'UPDATE posts SET current_published_version_id=NULL,latest_version_id=NULL WHERE id=ANY($1::uuid[])',
      [ids],
    );
    await pool.query('DELETE FROM question_versions WHERE concept_key=ANY($1::text[])', [concepts]);
    await pool.query('DELETE FROM post_versions WHERE post_id=ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM posts WHERE id=ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM concepts WHERE key=ANY($1::text[])', [concepts]);
    await pool.query('DELETE FROM audit_log WHERE target_id=ANY($1::text[])', [[...ids, questionId]]);
    await pool.end();
  });
  it('does not expose drafts or solutions before submission', async () => {
    await expect(getPost(content(18).slug, reader)).rejects.toMatchObject({ status: 404 });
    const detail = await getPost(slug, reader);
    expect(detail.question).not.toHaveProperty('correctChoiceId');
    expect(detail.question).not.toHaveProperty('explanation');
  });
  it('serves three stable pages without duplicates and rejects cross-user cursors', async () => {
    const first = await getFeed(reader);
    const again = await getFeed(reader, null, false, first.sessionId);
    expect(again.posts.map((p) => p.id)).toEqual(first.posts.map((p) => p.id));
    const second = await getFeed(reader, first.nextCursor);
    const third = await getFeed(reader, second.nextCursor);
    const all = [...first.posts, ...second.posts, ...third.posts].map((p) => p.id);
    expect(all.length).toBe(18);
    expect(new Set(all).size).toBe(18);
    expect(() => decodeCursor(encodeCursor(first.sessionId, 6, reader), owner)).toThrow();
    await expect(
      recordExposure(owner, {
        sessionId: first.sessionId,
        postId: first.posts[0].id,
        eventId: randomUUID(),
        visibleMs: 6000,
        ratio: 0.8,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('persists idempotent likes and applies ownership before search counts', async () => {
    await Promise.all([savePost(reader, subjectId), savePost(reader, subjectId)]);
    expect(
      Number(
        (
          await pool.query('SELECT count(*) n FROM saved_posts WHERE user_id=$1 AND post_id=$2', [
            reader,
            subjectId,
          ])
        ).rows[0].n,
      ),
    ).toBe(1);
    const params = new URLSearchParams({ scope: 'saved', q: `testisolated${suffix}` });
    expect((await searchPosts(reader, params)).posts.some((p) => p.id === subjectId)).toBe(true);
    expect((await searchPosts(owner, params)).total).toBe(0);
    for (const q of ['C++', 'C#', '.env', 'Promise.all', 'CI/CD', 'Node.js', `annuler requête ${suffix}`])
      expect(
        (await searchPosts(reader, new URLSearchParams({ scope: 'saved', q }))).posts.map((p) => p.id),
      ).toContain(subjectId);
    const typo = await searchPosts(reader, new URLSearchParams({ scope: 'saved', q: 'AbortControler' }));
    if (typo.searchMode === 'lexical+trigram') expect(typo.posts.map((p) => p.id)).toContain(subjectId);
  });
  it('stores exposure once and does not count a short pass as qualified', async () => {
    const f = await getFeed(reader);
    const eventId = randomUUID();
    const body = { sessionId: f.sessionId, postId: f.posts[0].id, eventId, visibleMs: 1000, ratio: 0.8 };
    expect((await recordExposure(reader, body)).qualified).toBe(false);
    await recordExposure(reader, { ...body, visibleMs: 6000 });
    await recordExposure(reader, { ...body, visibleMs: 6000 });
    const row = (
      await pool.query(
        'SELECT count(*) n,bool_and(qualified) qualified,max(visible_ms) ms FROM exposures WHERE user_id=$1 AND event_id=$2',
        [reader, eventId],
      )
    ).rows[0];
    expect(Number(row.n)).toBe(1);
    expect(row.qualified).toBe(true);
    expect(row.ms).toBe(6000);
  });
  it('keeps immediate tests separate and schedules one effective concurrent review', async () => {
    await savePost(reader, subjectId);
    await pool.query(
      "UPDATE learning_states SET due_at=now()-interval '1 day' WHERE user_id=$1 AND concept_key=$2",
      [reader, concepts[0]],
    );
    const before = (
      await pool.query('SELECT * FROM learning_states WHERE user_id=$1 AND concept_key=$2', [
        reader,
        concepts[0],
      ])
    ).rows[0];
    await submitAttempt(reader, {
      questionId,
      choiceId: 'signal',
      mode: 'immediate',
      idempotencyKey: randomUUID(),
    });
    expect(
      (
        await pool.query('SELECT due_at FROM learning_states WHERE user_id=$1 AND concept_key=$2', [
          reader,
          concepts[0],
        ])
      ).rows[0].due_at,
    ).toEqual(before.due_at);
    const question = (await getReviews(reader)).questions.find((q) => q.id === questionId)!;
    expect(question).toBeDefined();
    expect(question).not.toHaveProperty('explanation');
    await expect(
      submitAttempt(owner, {
        questionId,
        choiceId: 'signal',
        mode: 'review',
        opportunityId: question.opportunityId,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 404 });
    const base = { questionId, choiceId: 'signal', mode: 'review', opportunityId: question.opportunityId };
    const responses = await Promise.all([
      submitAttempt(reader, { ...base, idempotencyKey: randomUUID() }),
      submitAttempt(reader, { ...base, idempotencyKey: randomUUID() }),
    ]);
    const effective = responses.filter((r) => r.effective);
    expect(effective).toHaveLength(1);
    expect(
      (
        await pool.query('SELECT stage_index FROM learning_states WHERE user_id=$1 AND concept_key=$2', [
          reader,
          concepts[0],
        ])
      ).rows[0].stage_index,
    ).toBe(0);
    const resumed = (await getReviews(reader)).pendingConfidence;
    expect(resumed).toHaveLength(1);
    expect(resumed[0].question.id).toBe(questionId);
    expect(resumed[0].result.attemptId).toBe(effective[0].attemptId);
    expect(resumed[0].result.explanation).toBeDefined();
    expect((await getReviews(owner)).pendingConfidence).toHaveLength(0);
    const confidence = {
      questionId,
      mode: 'review',
      action: 'confidence',
      attemptId: effective[0].attemptId,
      guessed: false,
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all([submitAttempt(reader, confidence), submitAttempt(reader, confidence)]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].stageIndex).toBe(1);
    expect((await getReviews(reader)).pendingConfidence).toHaveLength(0);
    expect(
      (
        await pool.query('SELECT lock_version FROM learning_states WHERE user_id=$1 AND concept_key=$2', [
          reader,
          concepts[0],
        ])
      ).rows[0].lock_version,
    ).toBe(1);
  });
  it('does not penalize skipping or advance a guessed answer', async () => {
    await pool.query(
      "UPDATE learning_states SET due_at=now()-interval '1 day',last_skipped_at=NULL,stage_index=2 WHERE user_id=$1 AND concept_key=$2",
      [reader, concepts[0]],
    );
    let q = (await getReviews(reader)).questions.find((q) => q.id === questionId)!;
    const before = (
      await pool.query('SELECT due_at FROM learning_states WHERE user_id=$1 AND concept_key=$2', [
        reader,
        concepts[0],
      ])
    ).rows[0].due_at;
    const key = randomUUID();
    const skip = {
      questionId,
      mode: 'review',
      opportunityId: q.opportunityId,
      action: 'skip',
      idempotencyKey: key,
    };
    expect(await submitAttempt(reader, skip)).toEqual(await submitAttempt(reader, skip));
    expect(
      (
        await pool.query('SELECT due_at FROM learning_states WHERE user_id=$1 AND concept_key=$2', [
          reader,
          concepts[0],
        ])
      ).rows[0].due_at,
    ).toEqual(before);
    expect((await getReviews(reader)).questions.some((q) => q.id === questionId)).toBe(false);
    await pool.query('UPDATE learning_states SET last_skipped_at=NULL WHERE user_id=$1 AND concept_key=$2', [
      reader,
      concepts[0],
    ]);
    q = (await getReviews(reader)).questions.find((q) => q.id === questionId)!;
    const answer = await submitAttempt(reader, {
      questionId,
      mode: 'review',
      opportunityId: q.opportunityId,
      choiceId: 'signal',
      idempotencyKey: randomUUID(),
    });
    const result = await submitAttempt(reader, {
      questionId,
      mode: 'review',
      action: 'confidence',
      attemptId: answer.attemptId,
      guessed: true,
      idempotencyKey: randomUUID(),
    });
    expect(result.stageIndex).toBe(2);
  });
  it('retains session review quotas across refresh and excludes newly exposed concepts', async () => {
    const createdQuestions: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const created = await createQuestion(
        {
          conceptKey: concepts[i],
          prompt: `Quelle action explicite correspond à la notion ${i} ?`,
          choices: [
            { id: 'a', text: 'Une action explicite.' },
            { id: 'b', text: 'Une déduction automatique.' },
            { id: 'c', text: 'Un résultat sans contexte.' },
          ],
          correctChoiceId: 'a',
          explanation: 'Une action explicite est nécessaire dans ce contexte.',
        },
        owner,
      );
      createdQuestions.push(created.id);
      await savePost(owner, ids[i]);
      await pool.query(
        "INSERT INTO post_feedback(user_id,post_id,kind) VALUES($1,$2,'known') ON CONFLICT(user_id,post_id) DO UPDATE SET kind='known'",
        [owner, ids[i]],
      );
    }
    await pool.query("UPDATE learning_states SET due_at=now()-interval '1 day' WHERE user_id=$1", [owner]);
    // A fresh snapshot is stable across all qualification requests.
    const f = await getFeed(owner, null, true);
    let cursor = f.nextCursor;
    const pages = [...f.posts];
    while (cursor && pages.length < 20) {
      const next = await getFeed(owner, cursor);
      pages.push(...next.posts);
      cursor = next.nextCursor;
    }
    const reviewed: string[] = [];
    for (let i = 0; i < Math.min(15, pages.length); i++) {
      const event = await recordExposure(owner, {
        sessionId: f.sessionId,
        postId: pages[i].id,
        eventId: randomUUID(),
        visibleMs: 6000,
        ratio: 0.8,
      });
      if (i < 4) expect(event.question).toBeUndefined();
      if (event.question) {
        expect(reviewed).not.toContain(event.question.id);
        reviewed.push(event.question.id);
        const exposed = pages.slice(0, i + 1).map((p) => p.conceptKey);
        expect(exposed).not.toContain(event.question.conceptKey);
      }
      const refreshed = await getFeed(owner, null, false, f.sessionId);
      expect(refreshed.question).toBeUndefined();
    }
    expect(reviewed.length).toBe(3);
    if (pages[15])
      expect(
        (
          await recordExposure(owner, {
            sessionId: f.sessionId,
            postId: pages[15].id,
            eventId: randomUUID(),
            visibleMs: 6000,
            ratio: 0.8,
          })
        ).question,
      ).toBeUndefined();
    const s = (await pool.query('SELECT question_count FROM feed_sessions WHERE id=$1', [f.sessionId]))
      .rows[0];
    expect(s.question_count).toBe(reviewed.length);
    // Keep audit fixture cleanup bounded.
    await pool.query('DELETE FROM audit_log WHERE target_id=ANY($1::text[])', [createdQuestions]);
  });
  it('withdraws corrected questions and waits for explicit revalidation', async () => {
    await pool.query(
      "UPDATE learning_states SET due_at=now()-interval '1 day',last_skipped_at=NULL WHERE user_id=$1 AND concept_key=$2",
      [reader, concepts[0]],
    );
    const old = (await getReviews(reader)).questions.find((q) => q.id === questionId)!;
    const pending = await submitAttempt(reader, {
      questionId,
      mode: 'review',
      choiceId: 'signal',
      opportunityId: old.opportunityId,
      idempotencyKey: randomUUID(),
    });
    const revised = await createQuestion(
      {
        conceptKey: concepts[0],
        prompt: 'Quel mécanisme signale une annulation à une opération compatible ?',
        choices: [
          { id: 'signal', text: 'Le signal transmis à l’opération.' },
          { id: 'race', text: 'Le seul résultat de Promise.race.' },
          { id: 'all', text: 'Le rejet de Promise.all.' },
        ],
        correctChoiceId: 'signal',
        explanation:
          'Un signal transmis permet une annulation coopérative ; une promesse rejetée ne suffit pas.',
      },
      owner,
    );
    await expect(
      submitAttempt(reader, {
        questionId,
        mode: 'review',
        choiceId: 'signal',
        opportunityId: old.opportunityId,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'QUESTION_WITHDRAWN' });
    await expect(
      submitAttempt(reader, {
        questionId,
        mode: 'review',
        action: 'confidence',
        attemptId: pending.attemptId,
        guessed: false,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'QUESTION_WITHDRAWN' });
    const suspended = await getReviews(reader);
    expect(suspended.revalidation.some((s) => s.conceptKey === concepts[0])).toBe(true);
    expect(suspended.questions.some((q) => q.conceptKey === concepts[0])).toBe(false);
    const reset = await revalidateConcept(reader, concepts[0]);
    expect(reset.state.stageIndex).toBe(0);
    expect(reset.state.needsRevalidation).toBe(false);
    expect(new Date(reset.state.dueAt).getTime()).toBeGreaterThan(Date.now());
    expect((await getPost(slug, reader)).question?.id).toBe(revised.id);
    await pool.query('DELETE FROM audit_log WHERE target_id=$1', [revised.id]);
  });
  it('publishes atomically while preserving older immutable versions', async () => {
    const original = await getPost(slug, reader);
    const draft = content(0);
    draft.title = 'Une correction qui attend sa publication';
    const revised = await saveDraft(subjectId, draft, owner);
    expect((await getPost(slug, reader)).post.title).toBe(original.post.title);
    await publishPost(subjectId, owner);
    expect((await getPost(slug, reader)).post.title).toBe(draft.title);
    expect(
      (await pool.query('SELECT content FROM post_versions WHERE id=$1', [original.post.versionId])).rows[0]
        .content.title,
    ).toBe(original.post.title);
    const historical = await adminPost(subjectId, 1);
    expect(historical.post.title).toBe(original.post.title);
    expect(historical.post).toMatchObject({
      version: 1,
      publicationStatus: 'published',
      latestVersion: false,
      readOnly: true,
    });
    const latest = await adminPost(subjectId);
    expect(latest.post.title).toBe(draft.title);
    expect(latest.post).toMatchObject({ version: 2, latestVersion: true, readOnly: false });
    expect(latest.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(latest.versions[1].createdAt).toBeInstanceOf(Date);
    expect((await listPosts(new URLSearchParams())).posts.find((p) => p.id === subjectId)?.format).toBe(
      draft.format,
    );
    await expect(adminPost(subjectId, 99999)).rejects.toMatchObject({ status: 404 });
    const imported = await importPosts({ posts: [draft] }, owner);
    expect(imported.skipped).toContain(slug);
    expect(imported.imported).toHaveLength(0);
    await changeStatus(subjectId, 'unpublish', owner);
    await expect(getPost(slug, reader)).rejects.toMatchObject({ status: 404 });
    const saved = await searchPosts(reader, new URLSearchParams({ scope: 'saved' }));
    const unavailable = saved.posts.find((p) => p.id === subjectId);
    expect(unavailable).toMatchObject({ unavailable: true });
    expect(unavailable).not.toHaveProperty('blocks');
    await publishPost(subjectId, owner);
    expect(revised.version).toBe(2);
  });
  it('purges 90-day raw exposure events once while retaining descriptive totals', async () => {
    const before = (
      await pool.query(
        'SELECT count(*) n,count(*) FILTER(WHERE qualified) qualified,sum(visible_ms) ms FROM exposures WHERE user_id=$1',
        [reader],
      )
    ).rows[0];
    expect(Number(before.n)).toBeGreaterThan(0);
    await pool.query("UPDATE exposures SET created_at=now()-interval '91 days' WHERE user_id=$1", [reader]);
    await pool.query("UPDATE feed_sessions SET last_active_at=now()-interval '91 days' WHERE user_id=$1", [
      reader,
    ]);
    const first = await runMaintenance();
    expect(first.exposuresDeleted).toBeGreaterThanOrEqual(Number(before.n));
    expect((await pool.query('SELECT id FROM exposures WHERE user_id=$1', [reader])).rowCount).toBe(0);
    const totals = async () =>
      (
        await pool.query(
          'SELECT sum(exposure_count) n,sum(qualified_count) qualified,sum(visible_ms) ms FROM exposure_rollups WHERE user_id=$1',
          [reader],
        )
      ).rows[0];
    const archived = await totals();
    expect(Number(archived.n)).toBe(Number(before.n));
    expect(Number(archived.qualified)).toBe(Number(before.qualified));
    expect(Number(archived.ms)).toBe(Number(before.ms));
    await runMaintenance();
    expect(await totals()).toEqual(archived);
    expect((await pool.query('SELECT id FROM feed_sessions WHERE user_id=$1', [reader])).rowCount).toBe(0);
  });
});
