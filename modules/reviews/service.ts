import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { transaction, type Db } from '@/lib/db';
import { HttpError } from '@/lib/server';
import { publicQuestion } from '@/modules/content/service';
import { schedule } from './scheduler';
import { feedConfig } from '@/lib/config';
import { choiceOrder } from './order';

async function opportunity(c: Db, userId: string, row: Record<string, unknown>, sessionId?: string) {
  const id = randomUUID();
  const order = choiceOrder(row.choices as { id: string }[], id);
  await c.query(
    `INSERT INTO review_opportunities(id,user_id,concept_key,due_at,question_id,choice_order,feed_session_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,concept_key,due_at) DO NOTHING`,
    [id, userId, row.concept_key, row.due_at, row.id, JSON.stringify(order), sessionId ?? null],
  );
  let opp = (
    await c.query('SELECT * FROM review_opportunities WHERE user_id=$1 AND concept_key=$2 AND due_at=$3', [
      userId,
      row.concept_key,
      row.due_at,
    ])
  ).rows[0];
  // Replace an unconsumed, withdrawn version; never rewrite an effective attempt.
  if (opp.question_id !== row.id && !opp.effective_attempt_id) {
    await c.query(
      'UPDATE review_opportunities SET question_id=$2,choice_order=$3 WHERE id=$1 AND effective_attempt_id IS NULL',
      [opp.id, row.id, JSON.stringify(order)],
    );
    opp = { ...opp, question_id: row.id, choice_order: order };
  }
  return { ...publicQuestion(row, opp.choice_order), opportunityId: opp.id, mode: 'review' as const };
}
const dueSql = `SELECT q.*,l.due_at::text due_at,p.slug post_slug FROM learning_states l
 JOIN LATERAL(SELECT * FROM question_versions WHERE concept_key=l.concept_key AND status='active' ORDER BY version DESC LIMIT 1) q ON true
 JOIN LATERAL(SELECT slug FROM posts WHERE concept_key=l.concept_key AND status='published' AND current_published_version_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1) p ON true
 WHERE l.user_id=$1 AND NOT l.needs_revalidation AND l.due_at<=now() AND (l.last_skipped_at IS NULL OR l.last_skipped_at<now()-interval '1 hour')
 AND NOT EXISTS(SELECT 1 FROM review_opportunities o WHERE o.user_id=l.user_id AND o.concept_key=l.concept_key AND o.due_at=l.due_at AND o.effective_attempt_id IS NOT NULL)`;
export async function getReviews(userId: string) {
  return transaction(async (c) => {
    const rows = await c.query(`${dueSql} ORDER BY l.due_at,l.concept_key LIMIT 20`, [userId]);
    const count = await c.query(`SELECT count(*) n FROM (${dueSql}) d`, [userId]);
    const questions = [];
    for (const row of rows.rows) questions.push(await opportunity(c, userId, row));
    // A correct answer awaits the user's confidence choice. Preserve that correction across refresh.
    const pendingRows = (
      await c.query(
        `SELECT q.*,p.slug post_slug,o.id opportunity_id,o.choice_order,a.result
      FROM question_attempts a JOIN question_versions q ON q.id=a.question_id AND q.status='active'
      JOIN review_opportunities o ON o.id=a.opportunity_id AND o.effective_attempt_id=a.id
      JOIN learning_states l ON l.user_id=a.user_id AND l.concept_key=a.concept_key AND NOT l.needs_revalidation AND l.due_at=o.due_at
      JOIN LATERAL(SELECT slug FROM posts WHERE concept_key=a.concept_key AND status='published' ORDER BY updated_at DESC LIMIT 1) p ON true
      WHERE a.user_id=$1 AND a.mode='review' AND a.correct AND a.effective AND NOT a.confidence_submitted
      ORDER BY a.answered_at LIMIT 20`,
        [userId],
      )
    ).rows;
    const pendingConfidence = pendingRows.map((row) => ({
      question: {
        ...publicQuestion(row, row.choice_order),
        opportunityId: row.opportunity_id,
        mode: 'review' as const,
      },
      result: row.result,
    }));
    const states = (
      await c.query(
        'SELECT concept_key "conceptKey",stage_index "stageIndex",due_at "dueAt",failures,needs_revalidation "needsRevalidation" FROM learning_states WHERE user_id=$1 ORDER BY due_at LIMIT 100',
        [userId],
      )
    ).rows;
    return {
      questions,
      pendingConfidence,
      dueCount: Number(count.rows[0].n) + pendingConfidence.length,
      states,
      revalidation: states.filter((s) => s.needsRevalidation),
    };
  });
}
/** Serialize the session quota and presentation so refreshes cannot reset it. */
export async function feedQuestion(userId: string, sessionId: string) {
  return transaction(async (c) => {
    const s = (
      await c.query(
        `SELECT * FROM feed_sessions WHERE id=$1 AND user_id=$2 AND last_active_at>now()-interval '30 minutes' FOR UPDATE`,
        [sessionId, userId],
      )
    ).rows[0];
    if (!s || s.question_count >= feedConfig.maxQuestions) return undefined;
    const prefs = (await c.query('SELECT data FROM user_preferences WHERE user_id=$1', [userId])).rows[0]
      ?.data;
    if (prefs?.reviewsEnabled === false) return undefined;
    const n = Number(
      (
        await c.query(
          'SELECT count(*) n FROM exposures WHERE session_id=$1 AND user_id=$2 AND qualified=true',
          [sessionId, userId],
        )
      ).rows[0].n,
    );
    if (n - s.last_question_at_count < feedConfig.postsPerQuestion) return undefined;
    const rows = await c.query(
      `${dueSql}
      AND NOT EXISTS(SELECT 1 FROM exposures e JOIN posts ep ON ep.id=e.post_id WHERE e.user_id=$1 AND e.session_id=$2 AND e.qualified AND ep.concept_key=l.concept_key)
      AND NOT EXISTS(SELECT 1 FROM review_presentations rp JOIN question_versions pq ON pq.id=rp.question_id WHERE rp.session_id=$2 AND pq.concept_key=l.concept_key)
      ORDER BY l.due_at,l.concept_key LIMIT 1`,
      [userId, sessionId],
    );
    if (!rows.rowCount) return undefined;
    const question = await opportunity(c, userId, rows.rows[0], sessionId);
    await c.query(
      'INSERT INTO review_presentations(session_id,question_id,opportunity_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [sessionId, question.id, question.opportunityId],
    );
    await c.query(
      'UPDATE feed_sessions SET question_count=question_count+1,last_question_at_count=$2 WHERE id=$1',
      [sessionId, n],
    );
    return question;
  });
}
export const attemptSchema = z.object({
  questionId: z.string().uuid(),
  choiceId: z.string().max(40).optional(),
  mode: z.enum(['immediate', 'review']),
  opportunityId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(8).max(150),
  action: z.enum(['skip', 'answer', 'confidence']).default('answer'),
  attemptId: z.string().uuid().optional(),
  guessed: z.boolean().optional(),
});
export async function submitAttempt(userId: string, input: unknown, now = new Date()) {
  const data = attemptSchema.parse(input);
  return transaction(async (c) => {
    if (data.action === 'confidence') {
      if (!data.attemptId || data.guessed === undefined)
        throw new HttpError(422, 'VALIDATION', 'Tentative et confiance requises.');
      const a = (
        await c.query(
          'SELECT a.*,q.status question_status FROM question_attempts a JOIN question_versions q ON q.id=a.question_id WHERE a.id=$1 AND a.user_id=$2 FOR UPDATE OF a FOR SHARE OF q',
          [data.attemptId, userId],
        )
      ).rows[0];
      if (!a || a.question_id !== data.questionId)
        throw new HttpError(404, 'NOT_FOUND', 'Tentative introuvable.');
      if (a.confidence_submitted) return a.result;
      if (a.question_status !== 'active')
        throw new HttpError(409, 'QUESTION_WITHDRAWN', 'Cette question a été retirée.');
      if (!a.correct || a.mode !== 'review' || !a.effective) return a.result;
      const o = (
        await c.query(
          'SELECT *,due_at::text due_at_exact FROM review_opportunities WHERE id=$1 AND user_id=$2 FOR UPDATE',
          [a.opportunity_id, userId],
        )
      ).rows[0];
      const state = (
        await c.query(
          'SELECT *,due_at=$3::timestamptz due_matches FROM learning_states WHERE user_id=$1 AND concept_key=$2 FOR UPDATE',
          [userId, a.concept_key, o?.due_at_exact ?? null],
        )
      ).rows[0];
      const effective =
        !!o && !!state && !state.needs_revalidation && o.effective_attempt_id === a.id && state.due_matches;
      let result = { ...a.result, needsConfidence: false, guessed: data.guessed, effective };
      if (effective)
        result = {
          ...result,
          ...(await updateSchedule(c, userId, state, true, data.guessed, new Date(a.answered_at))),
        };
      await c.query(
        'UPDATE question_attempts SET guessed=$2,confidence_submitted=true,result=$3 WHERE id=$1',
        [a.id, data.guessed, JSON.stringify(result)],
      );
      return result;
    }
    // The per-user advisory lock also protects a first submission racing before a row exists.
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `${userId}:${data.idempotencyKey}`,
    ]);
    const old = (
      await c.query('SELECT * FROM question_attempts WHERE user_id=$1 AND idempotency_key=$2', [
        userId,
        data.idempotencyKey,
      ])
    ).rows[0];
    if (old) {
      if (
        old.question_id !== data.questionId ||
        old.mode !== data.mode ||
        old.action !== data.action ||
        old.choice_id !== (data.choiceId ?? null)
      )
        throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Clé déjà utilisée pour une autre réponse.');
      return old.result;
    }
    const q = (
      await c.query(
        `SELECT q.* FROM question_versions q WHERE q.id=$1 AND q.status='active' AND EXISTS(SELECT 1 FROM posts p WHERE p.concept_key=q.concept_key AND p.status='published' AND p.current_published_version_id IS NOT NULL) FOR SHARE OF q`,
        [data.questionId],
      )
    ).rows[0];
    if (!q) throw new HttpError(409, 'QUESTION_WITHDRAWN', 'Cette question a été retirée.');
    const id = randomUUID();
    let state: Record<string, unknown> | undefined;
    let effective = false;
    let opp: Record<string, unknown> | undefined;
    if (data.mode === 'review') {
      if (!data.opportunityId) throw new HttpError(422, 'VALIDATION', 'Créneau de révision requis.');
      opp = (
        await c.query(
          'SELECT *,due_at::text due_at_exact FROM review_opportunities WHERE id=$1 AND user_id=$2 FOR UPDATE',
          [data.opportunityId, userId],
        )
      ).rows[0];
      if (!opp || opp.question_id !== q.id || opp.concept_key !== q.concept_key)
        throw new HttpError(404, 'NOT_FOUND', 'Créneau de révision introuvable.');
      state = (
        await c.query(
          'SELECT *,due_at=$3::timestamptz due_matches FROM learning_states WHERE user_id=$1 AND concept_key=$2 FOR UPDATE',
          [userId, q.concept_key, opp.due_at_exact],
        )
      ).rows[0];
      effective =
        !!state &&
        !state.needs_revalidation &&
        !opp.effective_attempt_id &&
        new Date(state.due_at as string).getTime() <= now.getTime() &&
        !!state.due_matches;
    }
    if (data.action === 'skip') {
      if (state)
        await c.query('UPDATE learning_states SET last_skipped_at=$3 WHERE user_id=$1 AND concept_key=$2', [
          userId,
          q.concept_key,
          now,
        ]);
      const result = { attemptId: id, skipped: true, effective: false };
      await insertAttempt(c, { id, userId, q, opp, data, correct: null, result, effective: false, now });
      return result;
    }
    if (!data.choiceId || !(q.choices as { id: string }[]).some((ch) => ch.id === data.choiceId))
      throw new HttpError(422, 'INVALID_CHOICE', 'Choix invalide.');
    const correct = data.choiceId === q.correct_choice_id;
    let result: Record<string, unknown> = {
      attemptId: id,
      correct,
      correctChoiceId: q.correct_choice_id,
      explanation: q.explanation,
      effective,
      needsConfidence: correct && effective,
    };
    if (effective && !correct && state)
      result = { ...result, ...(await updateSchedule(c, userId, state, false, false, now)) };
    await insertAttempt(c, { id, userId, q, opp, data, correct, result, effective, now });
    if (effective)
      await c.query(
        'UPDATE review_opportunities SET effective_attempt_id=$2 WHERE id=$1 AND effective_attempt_id IS NULL',
        [opp!.id, id],
      );
    return result;
  });
}
export async function revalidateConcept(userId: string, conceptKey: string) {
  return transaction(async (c) => {
    const exists = await c.query(
      `SELECT 1 FROM posts p WHERE p.concept_key=$1 AND p.status='published' AND EXISTS(SELECT 1 FROM question_versions q WHERE q.concept_key=p.concept_key AND q.status='active') FOR SHARE`,
      [conceptKey],
    );
    if (!exists.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Notion sans question publiée disponible.');
    const result = await c.query(
      `INSERT INTO learning_states(user_id,concept_key) VALUES($1,$2)
      ON CONFLICT(user_id,concept_key) DO UPDATE SET stage_index=CASE WHEN learning_states.needs_revalidation THEN 0 ELSE learning_states.stage_index END,
      due_at=CASE WHEN learning_states.needs_revalidation THEN now()+interval '1 day' ELSE learning_states.due_at END,
      needs_revalidation=false,last_skipped_at=NULL RETURNING concept_key "conceptKey",stage_index "stageIndex",due_at "dueAt",needs_revalidation "needsRevalidation"`,
      [userId, conceptKey],
    );
    return { state: result.rows[0] };
  });
}
async function updateSchedule(
  c: Db,
  userId: string,
  state: Record<string, unknown>,
  correct: boolean,
  guessed: boolean,
  now: Date,
) {
  const next = schedule(
    {
      stageIndex: Number(state.stage_index),
      dueAt: new Date(state.due_at as string),
      failures: Number(state.failures),
    },
    { correct, guessed, mode: 'review' },
    now,
  );
  await c.query(
    'UPDATE learning_states SET stage_index=$3,due_at=$4,failures=$5,last_answered_at=$6,lock_version=lock_version+1 WHERE user_id=$1 AND concept_key=$2',
    [userId, state.concept_key, next.stageIndex, next.dueAt, next.failures, now],
  );
  return { stageIndex: next.stageIndex, dueAt: next.dueAt.toISOString(), failures: next.failures };
}
async function insertAttempt(
  c: Db,
  args: {
    id: string;
    userId: string;
    q: Record<string, unknown>;
    opp?: Record<string, unknown>;
    data: z.infer<typeof attemptSchema>;
    correct: boolean | null;
    result: object;
    effective: boolean;
    now: Date;
  },
) {
  const { id, userId, q, opp, data, correct, result, effective, now } = args;
  await c.query(
    `INSERT INTO question_attempts(id,user_id,question_id,concept_key,opportunity_id,mode,choice_id,correct,action,effective,confidence_submitted,result,idempotency_key,answered_at,choice_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      userId,
      q.id,
      q.concept_key,
      opp?.id ?? null,
      data.mode,
      data.choiceId ?? null,
      correct,
      data.action,
      effective,
      !correct || !effective,
      JSON.stringify(result),
      data.idempotencyKey,
      now,
      JSON.stringify(opp?.choice_order ?? choiceOrder(q.choices as { id: string }[], `${q.id}:${userId}`)),
    ],
  );
}
