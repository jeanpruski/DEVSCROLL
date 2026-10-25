'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  Download,
  Heart,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sprout,
} from 'lucide-react';
import type { PublicPost, PublicQuestion } from '@/lib/contracts';
import { difficultyLabels, formatLabels, topicLabels } from '@/lib/contracts';
import { ApiError, mutation, request } from '@/lib/client';
import { PostCard } from './post-card';
import { Quiz, type QuizResult } from './quiz';
import { ReadingAside } from './shell';
import { Admin } from './admin';

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Sprout size={25} />
      </span>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
export function Failure({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <p>{error}</p>
      {retry && (
        <button onClick={retry}>
          <RefreshCw size={15} />
          Réessayer
        </button>
      )}
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="skeleton" role="status" aria-label="Chargement">
      <div />
      <div />
      <div />
      <div />
    </div>
  );
}
function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError('');
    request<T>(url, { signal: c.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [url, revision]);
  return { data, error, loading, reload };
}
export function Workspace({ route }: { route: string[] }) {
  if (route[0] === 'admin') return <Admin path={route.slice(1)} />;
  if (route[0] === 'feed') return <Feed />;
  if (route[0] === 'explore' || route[0] === 'saved') return <Library saved={route[0] === 'saved'} />;
  if (route[0] === 'posts' && route[1]) return <PostDetail slug={route[1]} />;
  if (route[0] === 'reviews') return <Reviews />;
  if (route[0] === 'profile') return <Profile />;
  if (route[0] === 'onboarding') return <Profile onboarding />;
  return (
    <Empty title="Cette page n’existe pas.">
      <Link href="/feed">Revenir au fil</Link>
    </Empty>
  );
}
type FeedPage = {
  posts: PublicPost[];
  sessionId: string;
  nextCursor: string | null;
  exhausted: boolean;
  question?: PublicQuestion | null;
  qualifiedCount?: number;
};
function Feed() {
  const [posts, setPosts] = useState<PublicPost[]>([]),
    [sessionId, setSessionId] = useState(''),
    [cursor, setCursor] = useState<string | null>(null),
    [exhausted, setExhausted] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [questions, setQuestions] = useState<PublicQuestion[]>([]),
    [count, setCount] = useState(0),
    [filter, setFilter] = useState('all');
  const mounted = useRef(false);
  const question = questions[0] || null;
  const offerQuestion = useCallback(
    (q: PublicQuestion) =>
      setQuestions((items) => (items.some((x) => x.id === q.id) ? items : [...items, q])),
    [],
  );
  const load = useCallback(
    async (next?: string, replay = false) => {
      setBusy(true);
      setError('');
      try {
        const previous = sessionStorage.getItem('devscroll:feed-session');
        const search = new URLSearchParams();
        if (previous && !replay) search.set('sessionId', previous);
        if (next) search.set('cursor', next);
        if (replay) search.set('replay', '1');
        let data: FeedPage;
        let resumed = !!previous;
        try {
          data = await request<FeedPage>(`/api/feed?${search}`);
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 410) throw e;
          sessionStorage.removeItem('devscroll:feed-session');
          sessionStorage.removeItem('devscroll:feed-scroll');
          sessionStorage.removeItem('devscroll:feed-loaded');
          resumed = false;
          next = undefined;
          data = await request<FeedPage>('/api/feed');
        }
        if (!next && resumed && !replay) {
          const target = Math.min(120, Number(sessionStorage.getItem('devscroll:feed-loaded') || 6));
          while (data.nextCursor && data.posts.length < target) {
            const page = await request<FeedPage>(`/api/feed?cursor=${encodeURIComponent(data.nextCursor)}`);
            data = {
              ...page,
              posts: [...data.posts, ...page.posts],
              question: data.question || page.question,
            };
          }
        }
        setSessionId(data.sessionId);
        sessionStorage.setItem('devscroll:feed-session', data.sessionId);
        setPosts((p) => {
          const list = next ? [...p, ...data.posts.filter((n) => !p.some((o) => o.id === n.id))] : data.posts;
          sessionStorage.setItem('devscroll:feed-loaded', String(list.length));
          return list;
        });
        setCursor(data.nextCursor);
        setExhausted(data.exhausted);
        if (data.question) offerQuestion(data.question);
        if (!next && !replay && resumed) {
          const y = Number(sessionStorage.getItem('devscroll:feed-scroll') || 0);
          requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Le fil est momentanément indisponible.');
      } finally {
        setBusy(false);
      }
    },
    [offerQuestion],
  );
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      void load();
    }
    const scroll = () => sessionStorage.setItem('devscroll:feed-scroll', String(window.scrollY));
    const exposure = (e: Event) => {
      setCount((c) => c + 1);
      const q = (e as CustomEvent).detail?.question;
      if (q) offerQuestion(q);
    };
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('devscroll:exposure', exposure);
    return () => {
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('devscroll:exposure', exposure);
    };
  }, [load, offerQuestion]);
  const list =
    filter === 'code'
      ? posts.filter((p) => p.format === 'code' || p.blocks.some((b) => b.type === 'code'))
      : filter === 'discovery'
        ? posts.filter((p) => ['history', 'carousel', 'comparison'].includes(p.format))
        : posts;
  return (
    <div className="reading-layout">
      <main className="reading-main">
        <div className="page-eyebrow">
          <span className="status-dot" />
          LA CURIOSITÉ, AU QUOTIDIEN<span className="private-pill">ESPACE PRIVÉ</span>
        </div>
        <div className="page-heading">
          <div>
            <h1>
              Une idée à la fois<span className="mint">.</span>
            </h1>
            <p>Un détour technique. Un nouveau déclic.</p>
          </div>
          <Link className="icon-button" href="/profile" aria-label="Régler mes préférences">
            <SlidersHorizontal size={20} />
          </Link>
        </div>
        <div className="feed-tabs" role="group" aria-label="Formats affichés">
          {[
            { key: 'all', label: 'Pour toi', icon: Sparkles },
            { key: 'code', label: 'Côté code', icon: BookOpen },
            { key: 'discovery', label: 'Découvertes', icon: Compass },
          ].map((t) => (
            <button key={t.key} className={filter === t.key ? 'active' : ''} onClick={() => setFilter(t.key)}>
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="feed-note">
          <span className="tiny-heart">
            <Heart size={13} />
          </span>
          Un like enregistre le post. Tu le retrouveras dans tes favoris.
        </div>
        {count >= 10 && (
          <div className="session-summary">
            <Check size={18} />
            <div>
              <strong>{count} posts explorés. Une bonne pause ?</strong>
              <p>Tu peux retrouver tes favoris ou revenir plus tard.</p>
            </div>
            <Link href="/saved">
              <ArrowRight size={18} />
            </Link>
          </div>
        )}
        {question && (
          <Quiz
            key={question.id}
            question={{ ...question, mode: 'review' }}
            onDone={() => setQuestions((items) => items.slice(1))}
          />
        )}
        <div className="post-list">
          {list.map((p) => (
            <PostCard key={p.id} post={p} sessionId={sessionId} />
          ))}
        </div>
        {busy && <Skeleton />}
        {error && <Failure error={error} retry={() => load(cursor || undefined)} />}
        {!busy && !error && !list.length && !exhausted && (
          <Empty title="Aucun post dans ce format.">
            <p>Essaie « Pour toi » pour retrouver tous les sujets.</p>
          </Empty>
        )}
        {!busy && cursor && (
          <button className="load-more" onClick={() => load(cursor)}>
            Encore quelques idées
            <ChevronDown size={17} />
          </button>
        )}
        {!busy && exhausted && (
          <Empty title="Tu as fait le tour des nouveaux posts.">
            <p>Les bonnes idées restent à portée de main.</p>
            <div className="button-row">
              <Link className="primary" href="/saved">
                Mes favoris
                <Heart size={16} />
              </Link>
              <Link href="/reviews">Réviser</Link>
              <button
                className="text-button"
                onClick={() => {
                  sessionStorage.removeItem('devscroll:feed-scroll');
                  void load(undefined, true);
                }}
              >
                Relire volontairement
              </button>
            </div>
          </Empty>
        )}
      </main>
      <ReadingAside />
    </div>
  );
}

function Library({ saved }: { saved: boolean }) {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') || ''),
    [debounced, setDebounced] = useState(q),
    [topic, setTopic] = useState(params.get('topic') || ''),
    [difficulty, setDifficulty] = useState(''),
    [format, setFormat] = useState(''),
    [after, setAfter] = useState(''),
    [cursor, setCursor] = useState(''),
    [extra, setExtra] = useState<PublicPost[]>([]),
    [moreBusy, setMoreBusy] = useState(false),
    [moreError, setMoreError] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setCursor('');
      setExtra([]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const search = new URLSearchParams({ q: debounced, scope: saved ? 'saved' : 'all' });
  if (topic) search.set('topic', topic);
  if (difficulty) search.set('difficulty', difficulty);
  if (format) search.set('format', format);
  if (after) search.set('after', new Date(after + 'T00:00:00').toISOString());
  const url = `/api/search?${search}`,
    { data, error, loading, reload } = useResource<{
      posts: PublicPost[];
      nextCursor: string | null;
      total: number;
    }>(url);
  const pageController = useRef<AbortController | null>(null);
  const activeUrl = useRef(url);
  useEffect(() => {
    activeUrl.current = url;
    pageController.current?.abort();
    setExtra([]);
    setCursor('');
    setMoreBusy(false);
    setMoreError('');
    return () => pageController.current?.abort();
  }, [url]);
  useEffect(() => {
    setExtra([]);
    setCursor('');
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href);
      if (q) u.searchParams.set('q', q);
      else u.searchParams.delete('q');
      if (topic) u.searchParams.set('topic', topic);
      else u.searchParams.delete('topic');
      window.history.replaceState(null, '', u);
    }
  }, [topic, difficulty, format, after, q]);
  async function more() {
    if (!data) return;
    const expectedUrl = url;
    pageController.current?.abort();
    const controller = new AbortController();
    pageController.current = controller;
    setMoreBusy(true);
    setMoreError('');
    try {
      const r = await request<{ posts: PublicPost[]; nextCursor: string | null }>(
        url + `&cursor=${encodeURIComponent(cursor || data.nextCursor || '')}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || activeUrl.current !== expectedUrl) return;
      setExtra((x) => [...x, ...r.posts]);
      setCursor(r.nextCursor || 'END');
    } catch (e) {
      if (!controller.signal.aborted) setMoreError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      if (!controller.signal.aborted) setMoreBusy(false);
    }
  }
  return (
    <main className="wide-main library">
      <span className="eyebrow">{saved ? 'LES IDÉES QUI RESTENT' : 'SUIVRE UN FIL DE CURIOSITÉ'}</span>
      <div className="page-heading">
        <div>
          <h1>
            {saved ? 'Ta bibliothèque' : 'Explorer'}
            <span className="mint">.</span>
          </h1>
          <p>
            {saved
              ? 'Ce que tu as aimé, prêt à resservir.'
              : 'Cherche une notion, un outil ou une nouvelle piste.'}
          </p>
        </div>
        {saved ? (
          <Heart className="heading-icon" size={30} />
        ) : (
          <Compass className="heading-icon" size={30} />
        )}
      </div>
      <div className="search-field">
        <Search size={20} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            saved ? 'Retrouver une idée enregistrée…' : 'AbortController, index SQL, annuler requête…'
          }
          aria-label={saved ? 'Rechercher dans mes favoris' : 'Rechercher dans les posts'}
        />
        {q && (
          <button className="text-button" onClick={() => setQ('')}>
            Effacer
          </button>
        )}
        <kbd>/</kbd>
      </div>
      <div className="filters">
        <label className="sr-only" htmlFor="topic">
          Thème
        </label>
        <select id="topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Tous les thèmes</option>
          {Object.entries(topicLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="difficulty">
          Niveau
        </label>
        <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Tous les niveaux</option>
          {Object.entries(difficultyLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="format">
          Format
        </label>
        <select id="format" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">Tous les formats</option>
          {Object.entries(formatLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {saved && (
          <label className="date-filter">
            Depuis
            <input type="date" value={after} onChange={(e) => setAfter(e.target.value)} />
          </label>
        )}
      </div>
      {!saved && !q && !topic && (
        <div className="topic-chips">
          {['javascript', 'sql', 'devops', 'http', 'ai', 'integrations'].map((t) => (
            <button key={t} onClick={() => setTopic(t)}>
              # {topicLabels[t]}
            </button>
          ))}
        </div>
      )}
      <div className="results-heading">
        <span>
          {loading
            ? 'Recherche…'
            : `${data?.total || 0} idée${data?.total === 1 ? '' : 's'} ${saved ? 'enregistrée' + (data?.total === 1 ? '' : 's') : 'à explorer'}`}
        </span>
        <span>{saved ? 'Derniers enregistrements' : 'Recherche lexicale · alias éditoriaux'}</span>
      </div>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <Failure error={error} retry={reload} />
      ) : data?.posts.length ? (
        <div className="library-grid">
          {[...data.posts, ...extra].map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            saved && !q ? 'Les idées utiles se gardent.' : 'Aucune idée ne correspond à cette recherche.'
          }
        >
          <p>
            {saved && !q
              ? 'Un cœur dans le fil et le post t’attend ici.'
              : 'Essaie un nom technique, un thème ou des mots plus courts.'}
          </p>
          <Link href="/feed" className="primary">
            Explorer le fil
            <ArrowRight size={16} />
          </Link>
        </Empty>
      )}
      {data?.nextCursor && cursor !== 'END' && (
        <button className="load-more" onClick={more} disabled={moreBusy}>
          {moreBusy ? 'Chargement…' : 'Voir la suite'}
          <ChevronDown size={16} />
        </button>
      )}
      {moreError && <Failure error={moreError} retry={more} />}
    </main>
  );
}
function PostDetail({ slug }: { slug: string }) {
  const { data, error, loading, reload } = useResource<{ post: PublicPost; question?: PublicQuestion }>(
    `/api/posts/${encodeURIComponent(slug)}`,
  );
  return (
    <main className="detail-main">
      <button
        className="back-link"
        onClick={() => {
          if (window.history.length > 1) window.history.back();
          else window.location.replace('/feed');
        }}
      >
        <ArrowLeft size={16} />
        Revenir à la lecture
      </button>
      {loading ? (
        <Skeleton />
      ) : error ? (
        <Failure error={error} retry={reload} />
      ) : data ? (
        <>
          <PostCard post={data.post} detail />
          {data.question && <Quiz question={{ ...data.question, mode: 'immediate' }} />}
          <Link className="load-more" href="/feed">
            Continuer le fil
            <ArrowRight size={16} />
          </Link>
        </>
      ) : null}
    </main>
  );
}
function Reviews() {
  const { data, error, loading, reload } = useResource<{
    questions: PublicQuestion[];
    dueCount: number;
    states?: { conceptKey: string; dueAt: string; stageIndex: number }[];
    revalidation?: { conceptKey: string }[];
    pendingConfidence?: { question: PublicQuestion; result: QuizResult }[];
  }>('/api/reviews');
  const [completed, setCompleted] = useState<string[]>([]),
    [actionError, setActionError] = useState('');
  const pending = data?.pendingConfidence?.find((p) => !completed.includes(p.question.id));
  const question = pending?.question || data?.questions.find((q) => !completed.includes(q.id));
  async function revalidate(conceptKey: string) {
    try {
      await mutation('/api/reviews/revalidate', { conceptKey });
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Réévaluation impossible.');
    }
  }
  return (
    <main className="detail-main">
      <span className="eyebrow">LAISSER LES IDÉES S’INSTALLER</span>
      <div className="page-heading">
        <div>
          <h1>
            On se souvient<span className="mint"> ?</span>
          </h1>
          <p>Une question, un petit effort, un rappel qui reste.</p>
        </div>
      </div>
      <div className="review-banner">
        <BookOpen size={21} />
        <div>
          <strong>
            {loading
              ? 'Un instant…'
              : `${Math.max(0, (data?.dueCount || 0) - completed.length)} notion${(data?.dueCount || 0) - completed.length === 1 ? '' : 's'} à revoir`}
          </strong>
          <p>Tu peux toujours passer. Il n’y a aucune série à maintenir.</p>
        </div>
      </div>
      {data?.revalidation?.map((s) => (
        <section className="panel" key={s.conceptKey}>
          <h2>Une question a été corrigée.</h2>
          <p>
            La notion <code>{s.conceptKey}</code> est suspendue. Relis le contenu si nécessaire, puis reprends
            son calendrier à partir de demain.
          </p>
          <button onClick={() => revalidate(s.conceptKey)}>Reprendre cette notion demain</button>
        </section>
      ))}
      {actionError && <Failure error={actionError} />}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <Failure error={error} retry={reload} />
      ) : question ? (
        <Quiz
          key={question.id}
          question={{ ...question, mode: 'review' }}
          initialResult={pending?.result}
          onDone={() => setCompleted((c) => [...c, question.id])}
        />
      ) : (
        <Empty title="Tout est à jour pour le moment.">
          <p>Les notions sauvegardées reviendront à partir du lendemain. Laisse-leur un peu de temps.</p>
          <Link href="/feed" className="primary">
            Reprendre le fil
            <ArrowRight size={16} />
          </Link>
        </Empty>
      )}
      {data?.states && data.states.length > 0 && (
        <section className="panel">
          <h2>Les prochaines retrouvailles</h2>
          {data.states.slice(0, 12).map((s) => (
            <div className="schedule-row" key={s.conceptKey}>
              <code>{s.conceptKey}</code>
              <span>{new Date(s.dueAt).toLocaleDateString('fr-FR')}</span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
type Preferences = {
  topics: string[];
  difficulty: string;
  reviewsEnabled: boolean;
  sessionMinutes: number;
  onboarded: boolean;
};
function Profile({ onboarding = false }: { onboarding?: boolean }) {
  const { data, error, loading, reload } = useResource<{ preferences: Preferences }>('/api/preferences');
  const profile = useResource<{
    stats: { exposures: number; saved: number; attempts: number; correct: number; due: number };
  }>('/api/profile');
  const [prefs, setPrefs] = useState<Preferences>({
      topics: ['javascript', 'typescript', 'node', 'react', 'sql', 'linux', 'devops', 'http'],
      difficulty: 'intermediate',
      reviewsEnabled: true,
      sessionMinutes: 5,
      onboarded: false,
    }),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [saveError, setSaveError] = useState('');
  useEffect(() => {
    if (data?.preferences) setPrefs(data.preferences);
  }, [data]);
  async function save(e: React.SubmitEvent) {
    e.preventDefault();
    setBusy(true);
    setSaveError('');
    try {
      await mutation('/api/preferences', { ...prefs, onboarded: true }, 'PUT');
      setNotice('Tes préférences sont enregistrées.');
      if (onboarding) window.location.replace('/feed');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      const { createAuthClient } = await import('better-auth/react');
      await createAuthClient().signOut();
      sessionStorage.clear();
      for (const key of Object.keys(localStorage))
        if (key.startsWith('devscroll:') && key !== 'devscroll:theme') localStorage.removeItem(key);
      if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
      window.location.replace('/login');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Déconnexion impossible.');
      setBusy(false);
    }
  }
  async function remove() {
    const confirmation = window.prompt(
      'Pour supprimer ton compte et toutes tes interactions, saisis ton adresse email. Le corpus éditorial sera conservé.',
    );
    if (!confirmation) return;
    setBusy(true);
    try {
      await mutation('/api/account', { confirmation }, 'DELETE');
      sessionStorage.clear();
      window.location.replace('/login');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Suppression impossible.');
      setBusy(false);
    }
  }
  return (
    <main className="wide-main profile-main">
      <span className="eyebrow">{onboarding ? 'BIENVENUE DANS TON ESPACE' : 'LE FIL, À TA FAÇON'}</span>
      <div className="page-heading">
        <div>
          <h1>
            {onboarding ? 'Ta curiosité commence ici' : 'Ton espace'}
            <span className="mint">.</span>
          </h1>
          <p>
            {onboarding
              ? 'Quelques préférences, puis place aux découvertes.'
              : 'Choisis tes sujets. Apprends à ton rythme.'}
          </p>
        </div>
        <Settings2 size={28} className="heading-icon" />
      </div>
      {!onboarding && profile.data && (
        <div className="stats-grid">
          {[
            { n: profile.data.stats.exposures, label: 'Posts explorés' },
            { n: profile.data.stats.saved, label: 'Idées sauvegardées' },
            { n: profile.data.stats.attempts, label: 'Questions tentées' },
            { n: profile.data.stats.correct, label: 'Réponses justes' },
            { n: profile.data.stats.due, label: 'Notions à revoir' },
          ].map((s) => (
            <div key={s.label}>
              <strong>{s.n}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
      {!onboarding && (
        <p className="fine">
          Ces chiffres décrivent ton activité. Ils ne mesurent pas une maîtrise ou une compétence.
        </p>
      )}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <Failure error={error} retry={reload} />
      ) : (
        <form className="panel preferences" onSubmit={save}>
          <h2>Les sujets qui te parlent</h2>
          <p>Un point de départ. Le fil te proposera aussi quelques détours.</p>
          <div className="topic-picker">
            {Object.entries(topicLabels).map(([k, v]) => (
              <button
                key={k}
                type="button"
                className={prefs.topics.includes(k) ? 'selected' : ''}
                aria-pressed={prefs.topics.includes(k)}
                onClick={() =>
                  setPrefs((p) => ({
                    ...p,
                    topics: p.topics.includes(k) ? p.topics.filter((x) => x !== k) : [...p.topics, k],
                  }))
                }
              >
                {prefs.topics.includes(k) ? <Check size={15} /> : <Plus size={15} />} {v}
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label>
              Niveau habituel
              <select
                value={prefs.difficulty}
                onChange={(e) => setPrefs((p) => ({ ...p, difficulty: e.target.value }))}
              >
                {Object.entries(difficultyLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Une pause de…
              <select
                value={prefs.sessionMinutes}
                onChange={(e) => setPrefs((p) => ({ ...p, sessionMinutes: Number(e.target.value) }))}
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
            </label>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={prefs.reviewsEnabled}
              onChange={(e) => setPrefs((p) => ({ ...p, reviewsEnabled: e.target.checked }))}
            />
            <span>
              <strong>Revoir les notions sauvegardées</strong>
              <small>
                Un premier rappel le lendemain, puis des délais espacés. Aucun rappel automatique hors de
                l’application.
              </small>
            </span>
          </label>
          <button className="primary" disabled={busy || !prefs.topics.length}>
            {onboarding ? 'Ouvrir mon fil' : 'Enregistrer mes préférences'}
            <ArrowRight size={16} />
          </button>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {saveError && (
            <p className="error-message" role="alert">
              {saveError}
            </p>
          )}
        </form>
      )}
      {!onboarding && (
        <section className="panel account-panel">
          <h2>Tes données t’appartiennent</h2>
          <p>Exporte tes favoris, tes réponses et tes préférences dans un fichier JSON.</p>
          <div className="button-row">
            <a href="/api/export" className="button" download>
              <Download size={16} />
              Exporter mes données
            </a>
            <Link className="button" href="/admin/quality">
              Diagnostic & qualité
              <ArrowUpRight size={15} />
            </Link>
            <button onClick={logout} disabled={busy}>
              <LogOut size={16} />
              Déconnexion
            </button>
          </div>
          <details className="danger-zone">
            <summary>Suppression du compte</summary>
            <p>Cette action supprime tes interactions et ta connexion. Elle est irréversible.</p>
            <button className="danger" disabled={busy} onClick={remove}>
              Supprimer mon compte
            </button>
          </details>
        </section>
      )}
    </main>
  );
}
