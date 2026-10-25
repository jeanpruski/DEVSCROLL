'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, CircleHelp, X } from 'lucide-react';
import type { PublicQuestion } from '@/lib/contracts';
import { mutation } from '@/lib/client';
export type QuizResult = {
  id?: string;
  attemptId?: string;
  correct: boolean;
  explanation: string;
  correctChoiceId?: string;
  dueAt?: string;
  nextDueAt?: string;
  effective?: boolean;
};
type Result = QuizResult;
export function Quiz({
  question,
  onDone,
  initialResult,
}: {
  question: PublicQuestion;
  onDone?: () => void;
  initialResult?: QuizResult;
}) {
  const [choice, setChoice] = useState(''),
    [result, setResult] = useState<Result | null>(initialResult || null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false),
    [key] = useState(() => crypto.randomUUID()),
    [confidenceKey] = useState(() => crypto.randomUUID());
  const mode = question.mode || 'review';
  async function answer() {
    if (!choice || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await mutation<Result>('/api/attempts', {
        questionId: question.id,
        choiceId: choice,
        mode,
        opportunityId: question.opportunityId,
        idempotencyKey: key,
        action: 'answer',
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réponse impossible.');
    } finally {
      setBusy(false);
    }
  }
  async function finish(guessed = false) {
    setBusy(true);
    try {
      if (mode === 'review' && result?.correct)
        await mutation('/api/attempts', {
          questionId: question.id,
          mode,
          action: 'confidence',
          attemptId: result.attemptId || result.id,
          guessed,
          idempotencyKey: confidenceKey,
        });
      setDone(true);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }
  async function skip() {
    setBusy(true);
    try {
      await mutation('/api/attempts', {
        questionId: question.id,
        mode,
        opportunityId: question.opportunityId,
        idempotencyKey: key,
        action: 'skip',
      });
      setDone(true);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Passage impossible.');
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="notice" role="status">
        {result
          ? 'Réponse enregistrée. Tu peux poursuivre à ton rythme.'
          : 'Question passée. Son échéance reste inchangée.'}
      </div>
    );
  return (
    <section className="quiz">
      <div className="section-kicker">
        <CircleHelp size={18} />
        {mode === 'immediate' ? 'UN PETIT TEST POUR COMPRENDRE' : 'UNE PAUSE POUR SE SOUVENIR'}
      </div>
      <h2>{question.prompt}</h2>
      <div className="choices">
        {question.choices.map((c) => (
          <button
            key={c.id}
            className={`${choice === c.id ? 'selected ' : ''}${result && c.id === result.correctChoiceId ? 'correct' : ''}`}
            disabled={!!result || busy}
            onClick={() => setChoice(c.id)}
          >
            <span className="choice-radio">
              {result && c.id === result.correctChoiceId ? <Check size={14} /> : null}
            </span>
            {c.text}
          </button>
        ))}
      </div>
      {!result ? (
        <div className="quiz-actions">
          <button className="primary" disabled={!choice || busy} onClick={answer}>
            Vérifier
            <ArrowRight size={16} />
          </button>
          <button className="text-button" disabled={busy} onClick={skip}>
            Passer
          </button>
        </div>
      ) : (
        <div className="correction" aria-live="polite">
          <strong>
            {result.correct ? (
              <>
                <Check size={17} />
                Bien vu.
              </>
            ) : (
              <>
                <X size={17} />
                Une occasion de clarifier.
              </>
            )}
          </strong>
          <p>{result.explanation}</p>
          {mode === 'review' && result.correct && <p className="fine">Comment as-tu trouvé cette réponse ?</p>}
          <div className="button-row">
            <button className="primary" disabled={busy} onClick={() => finish(false)}>
              {mode === 'review' && result.correct ? 'Continuer avec confiance' : 'Continuer'}
              <ArrowRight size={16} />
            </button>
            {mode === 'review' && result.correct && (
              <button disabled={busy} onClick={() => finish(true)}>
                J’avais deviné
              </button>
            )}
          </div>
          {question.postSlug && (
            <Link className="source-link" href={`/posts/${question.postSlug}`}>
              Relire le post source
            </Link>
          )}
          {mode === 'immediate' && (
            <p className="fine">Ce test immédiat ne modifie pas ton calendrier de révision.</p>
          )}
        </div>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
