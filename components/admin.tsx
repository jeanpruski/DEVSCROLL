'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  Download,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  type Block,
  type PostContent,
  type PublicPost,
  type QuestionContent,
  difficulties,
  difficultyLabels,
  formatLabels,
  formats,
  postSchema,
  topicLabels,
} from '@/lib/contracts';
import { mutation, request } from '@/lib/client';
import { PostCard } from './post-card';
import { Empty, Failure, Skeleton } from './workspace';
const newPost: PostContent = {
  schemaVersion: 1,
  locale: 'fr',
  slug: 'nouvelle-idee',
  title: 'Une nouvelle idée à partager',
  format: 'concept',
  difficulty: 'intermediate',
  topic: 'javascript',
  tags: [],
  conceptKey: 'javascript.nouvelle-idee',
  learningObjective: 'Comprendre une notion et savoir quand l’utiliser.',
  blocks: [{ type: 'paragraph', text: 'Le problème concret, une explication et un exemple.' }],
  takeaway: 'Une phrase qui résume ce qui doit rester.',
  searchAliases: [],
  context: { technology: 'JavaScript', version: null },
  sources: [],
  reviewAfterDays: 180,
  status: 'draft',
  flags: ['needs_sources'],
};
type AdminPost = PostContent & {
  id: string;
  versionId: string;
  version: number;
  updatedAt?: string;
  hasDraft?: boolean;
};
function useAdmin<T>(url: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true);
  const reload = useCallback(() => {
    setBusy(true);
    setError('');
    request<T>(url)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [url]);
  useEffect(reload, [reload]);
  return { data, error, busy, reload };
}
export function Admin({ path }: { path: string[] }) {
  const section = path[0] || 'posts';
  return (
    <main className="wide-main admin-main">
      <span className="eyebrow">LES COULISSES DU FIL</span>
      <div className="page-heading">
        <div>
          <h1>
            L’atelier<span className="mint">.</span>
          </h1>
          <p>Des contenus utiles, des sources et un peu de soin.</p>
        </div>
        <FileText className="heading-icon" size={28} />
      </div>
      <nav className="admin-tabs" aria-label="Administration">
        <Link href="/admin/posts" className={section === 'posts' ? 'active' : ''}>
          Contenus
        </Link>
        <Link href="/admin/generation" className={section === 'generation' ? 'active' : ''}>
          <Sparkles size={15} />
          Assistant IA
        </Link>
        <Link href="/admin/quality" className={section === 'quality' ? 'active' : ''}>
          Qualité & diagnostic
        </Link>
      </nav>
      {section === 'generation' ? (
        <Generation />
      ) : section === 'quality' ? (
        <Quality />
      ) : path[1] ? (
        <Editor id={path[1]} />
      ) : (
        <PostList />
      )}
    </main>
  );
}
function PostList() {
  const { data, error, busy, reload } = useAdmin<{ posts: AdminPost[] }>('/api/admin/posts');
  const [status, setStatus] = useState('all'),
    [notice, setNotice] = useState(''),
    [actionError, setActionError] = useState('');
  async function importFile(file: File) {
    setActionError('');
    try {
      if (file.size > 2_000_000) throw new Error('Le fichier dépasse 2 Mo.');
      const parsed = JSON.parse(await file.text());
      const r = await mutation<{ imported?: string[]; skipped?: string[] }>('/api/admin/import', parsed);
      setNotice(
        `Import terminé${r.imported !== undefined ? ` : ${r.imported.length} contenus importés` : ''}. Les slugs existants sont conservés.`,
      );
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Import impossible.');
    }
  }
  return (
    <>
      <div className="admin-toolbar">
        <div className="button-row">
          <Link className="primary" href="/admin/posts/new">
            <Plus size={17} />
            Écrire un post
          </Link>
          <label className="button file-button">
            <Upload size={16} />
            Importer JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = '';
              }}
            />
          </label>
          <a className="button" href="/api/admin/export" download>
            <Download size={16} />
            Exporter
          </a>
        </div>
        <select aria-label="Filtrer les statuts" value={status} onChange={(e) => setStatus(e.target.value)}>
          {[
            ['all', 'Tous les statuts'],
            ['draft', 'Brouillons'],
            ['review', 'À relire'],
            ['published', 'Publiés'],
            ['archived', 'Archivés'],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {actionError && <Failure error={actionError} />}
      {busy ? (
        <Skeleton />
      ) : error ? (
        <Failure error={error} retry={reload} />
      ) : data?.posts.length ? (
        <div className="editorial-list">
          {data.posts
            .filter((p) => status === 'all' || p.status === status)
            .map((p) => (
              <Link className="editorial-row" key={p.id} href={`/admin/posts/${p.id}`}>
                <span className={`post-status status-${p.status}`}>
                  {
                    {
                      idea: 'Idée',
                      draft: 'Brouillon',
                      review: 'À relire',
                      published: 'Publié',
                      archived: 'Archivé',
                    }[p.status]
                  }
                </span>
                <div>
                  <strong>{p.title}</strong>
                  <small>
                    {topicLabels[p.topic] || p.topic} · {formatLabels[p.format]} · v{p.version}
                  </small>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))}
        </div>
      ) : (
        <Empty title="Une première idée à mettre en mots.">
          <Link className="primary" href="/admin/posts/new">
            Créer un brouillon
            <Plus size={16} />
          </Link>
        </Empty>
      )}
    </>
  );
}

function Editor({ id }: { id: string }) {
  const [content, setContent] = useState<PostContent>(newPost),
    [postId, setPostId] = useState(id === 'new' ? '' : id),
    [version, setVersion] = useState(1),
    [loading, setLoading] = useState(id !== 'new'),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [question, setQuestion] = useState(''),
    [questions, setQuestions] = useState<
      (QuestionContent & { id: string; version: number; status: string })[]
    >([]),
    [versions, setVersions] = useState<
      { version: number; createdAt?: string; isLatest?: boolean; isPublished?: boolean }[]
    >([]),
    [historical, setHistorical] = useState<AdminPost | null>(null);
  useEffect(() => {
    if (id === 'new') return;
    request<{
      post: AdminPost;
      versions?: { version: number; createdAt?: string; isLatest?: boolean; isPublished?: boolean }[];
      questions?: (QuestionContent & { id: string; version: number; status: string })[];
    }>(`/api/admin/posts/${id}`)
      .then((d) => {
        setContent(d.post);
        setVersion(d.post.version);
        setVersions(d.versions || []);
        setQuestions(d.questions || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  function patch<K extends keyof PostContent>(key: K, value: PostContent[K]) {
    setContent((c) => ({ ...c, [key]: value }));
  }
  function blockPatch(index: number, block: Block) {
    setContent((c) => ({ ...c, blocks: c.blocks.map((b, i) => (i === index ? block : b)) }));
  }
  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const parsed = postSchema.parse(content);
      const r = await mutation<{ post?: AdminPost; id?: string; version?: number; content?: PostContent }>(
        postId ? `/api/admin/posts/${postId}` : '/api/admin/posts',
        parsed,
        postId ? 'PUT' : 'POST',
      );
      const nextId = r.post?.id || r.id || postId;
      setPostId(nextId);
      setVersion(r.post?.version || r.version || version);
      if (nextId) {
        const detail = await request<{
          versions: { version: number; createdAt?: string; isLatest?: boolean; isPublished?: boolean }[];
        }>(`/api/admin/posts/${nextId}`).catch(() => null);
        if (detail) setVersions(detail.versions);
      }
      setNotice('Nouvelle version du brouillon enregistrée.');
      if (!postId) window.history.replaceState(null, '', `/admin/posts/${nextId}`);
      return nextId;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function action(kind: string) {
    setBusy(true);
    setError('');
    try {
      const saved = kind === 'publish' ? await save() : postId;
      if (!saved) throw new Error('Enregistre le brouillon avant cette action.');
      setBusy(true);
      await mutation(`/api/admin/posts/${saved}/${kind}`, {});
      setNotice(
        (
          {
            publish: 'Version publiée. Elle est maintenant visible dans le fil.',
            unpublish: 'Publication retirée. Les favoris et historiques sont conservés.',
            archive: 'Contenu archivé.',
            duplicate: 'Copie créée en brouillon.',
          } as Record<string, string>
        )[kind],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }
  async function saveQuestion() {
    setError('');
    setBusy(true);
    try {
      const parsed = JSON.parse(question) as QuestionContent;
      const created = await mutation<{
        question: QuestionContent & { id: string; version: number; status: string };
      }>('/api/admin/questions', { ...parsed, conceptKey: content.conceptKey });
      setQuestions((old) => [created.question, ...old.map((q) => ({ ...q, status: 'withdrawn' }))]);
      setNotice('Question versionnée enregistrée. L’ancienne version est suspendue.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Question invalide.');
    } finally {
      setBusy(false);
    }
  }
  async function withdrawQuestion(questionId: string) {
    setBusy(true);
    setError('');
    try {
      await request(`/api/admin/questions/${questionId}`, { method: 'DELETE' });
      setQuestions((old) => old.map((q) => (q.id === questionId ? { ...q, status: 'withdrawn' } : q)));
      setNotice('Question retirée. Elle ne sera plus proposée en révision.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retrait impossible.');
    } finally {
      setBusy(false);
    }
  }
  async function inspectVersion(n: number) {
    try {
      const detail = await request<{ post: AdminPost }>(`/api/admin/posts/${postId}?version=${n}`);
      setHistorical(detail.post);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Version indisponible.');
    }
  }
  if (loading) return <Skeleton />;
  if (historical)
    return (
      <>
        <button className="back-link" onClick={() => setHistorical(null)}>
          <ArrowLeft size={16} />
          Revenir à la version en cours
        </button>
        <p className="notice">Historique · version {historical.version} · lecture seule</p>
        <div className="detail-main">
          <PostCard post={{ ...historical, saved: false }} detail preview />
        </div>
      </>
    );
  return (
    <>
      <div className="editor-toolbar">
        <Link href="/admin/posts" className="back-link">
          <ArrowLeft size={15} />
          Contenus
        </Link>
        <div className="button-row">
          <button onClick={() => setPreview(!preview)}>
            <Eye size={16} />
            {preview ? 'Revenir à l’éditeur' : 'Aperçu mobile'}
          </button>
          <button className="primary" disabled={busy} onClick={save}>
            <Save size={16} />
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
      {error && <Failure error={error} />}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {preview ? (
        <div className="mobile-preview">
          <PostCard
            post={
              {
                ...content,
                id: postId || 'preview',
                versionId: 'preview',
                version,
                saved: false,
              } as PublicPost
            }
            detail
            preview
          />
        </div>
      ) : (
        <div className="editor-form">
          <section className="panel">
            <div className="section-title">
              <h2>L’idée principale</h2>
              <span className="pill">VERSION {version}</span>
            </div>
            <label>
              Titre
              <input value={content.title} onChange={(e) => patch('title', e.target.value)} />
            </label>
            <div className="field-grid">
              <label>
                Adresse (slug)
                <input value={content.slug} onChange={(e) => patch('slug', e.target.value)} />
              </label>
              <label>
                Notion stable
                <input value={content.conceptKey} onChange={(e) => patch('conceptKey', e.target.value)} />
              </label>
            </div>
            <label>
              Objectif pédagogique
              <textarea
                value={content.learningObjective}
                onChange={(e) => patch('learningObjective', e.target.value)}
                rows={2}
              />
            </label>
            <div className="field-grid three">
              <label>
                Thème
                <select value={content.topic} onChange={(e) => patch('topic', e.target.value)}>
                  {Object.entries(topicLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Format
                <select
                  value={content.format}
                  onChange={(e) => patch('format', e.target.value as PostContent['format'])}
                >
                  {formats.map((f) => (
                    <option key={f} value={f}>
                      {formatLabels[f]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Niveau
                <select
                  value={content.difficulty}
                  onChange={(e) => patch('difficulty', e.target.value as PostContent['difficulty'])}
                >
                  {difficulties.map((d) => (
                    <option key={d} value={d}>
                      {difficultyLabels[d]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-grid">
              <label>
                Tags (virgules, cinq maximum)
                <input
                  value={content.tags.join(', ')}
                  onChange={(e) =>
                    patch(
                      'tags',
                      e.target.value
                        .split(',')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
              <label>
                Alias de recherche (virgules)
                <input
                  value={content.searchAliases.join(', ')}
                  onChange={(e) =>
                    patch(
                      'searchAliases',
                      e.target.value
                        .split(',')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
            </div>
          </section>
          <section className="panel">
            <h2>Les blocs du post</h2>
            <p className="fine">
              Dans un carrousel, chaque bloc devient une carte. Le code reste du texte, il n’est jamais
              exécuté par le serveur.
            </p>
            {content.blocks.map((b, i) => (
              <div key={i} className="block-editor">
                <div className="block-toolbar">
                  <span>
                    {i + 1} / {b.type}
                  </span>
                  <div>
                    <button
                      aria-label={`Monter le bloc ${i + 1}`}
                      disabled={i === 0}
                      onClick={() => {
                        const blocks = [...content.blocks];
                        [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
                        patch('blocks', blocks);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Supprimer le bloc ${i + 1}`}
                      onClick={() =>
                        patch(
                          'blocks',
                          content.blocks.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {b.type === 'paragraph' ? (
                  <textarea
                    aria-label={`Texte du bloc ${i + 1}`}
                    rows={4}
                    value={b.text}
                    onChange={(e) => blockPatch(i, { ...b, text: e.target.value })}
                  />
                ) : b.type === 'code' ? (
                  <>
                    <input
                      aria-label="Langage"
                      value={b.language}
                      onChange={(e) => blockPatch(i, { ...b, language: e.target.value })}
                    />
                    <textarea
                      className="code-input"
                      aria-label="Extrait de code"
                      rows={8}
                      value={b.code}
                      onChange={(e) => blockPatch(i, { ...b, code: e.target.value })}
                    />
                  </>
                ) : b.type === 'list' ? (
                  <textarea
                    aria-label="Éléments de la liste, une ligne par élément"
                    rows={4}
                    value={b.items.join('\n')}
                    onChange={(e) => blockPatch(i, { ...b, items: e.target.value.split('\n') })}
                  />
                ) : b.type === 'comparison' ? (
                  <div className="field-grid">
                    <label>
                      <input
                        aria-label="Libellé gauche"
                        value={b.leftLabel}
                        onChange={(e) => blockPatch(i, { ...b, leftLabel: e.target.value })}
                      />
                      <textarea
                        aria-label="Explication gauche"
                        value={b.left}
                        onChange={(e) => blockPatch(i, { ...b, left: e.target.value })}
                      />
                    </label>
                    <label>
                      <input
                        aria-label="Libellé droit"
                        value={b.rightLabel}
                        onChange={(e) => blockPatch(i, { ...b, rightLabel: e.target.value })}
                      />
                      <textarea
                        aria-label="Explication droite"
                        value={b.right}
                        onChange={(e) => blockPatch(i, { ...b, right: e.target.value })}
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <label>
                      URL de l’image
                      <input value={b.url} onChange={(e) => blockPatch(i, { ...b, url: e.target.value })} />
                    </label>
                    <label>
                      Texte alternatif
                      <input value={b.alt} onChange={(e) => blockPatch(i, { ...b, alt: e.target.value })} />
                    </label>
                  </>
                )}
              </div>
            ))}
            <div className="button-row">
              <button
                onClick={() =>
                  patch('blocks', [...content.blocks, { type: 'paragraph', text: 'Nouveau paragraphe.' }])
                }
              >
                <Plus size={15} />
                Texte
              </button>
              <button
                onClick={() =>
                  patch('blocks', [
                    ...content.blocks,
                    { type: 'code', language: 'javascript', code: '// Un exemple concret' },
                  ])
                }
              >
                <Plus size={15} />
                Code
              </button>
              <button
                onClick={() =>
                  patch('blocks', [
                    ...content.blocks,
                    {
                      type: 'comparison',
                      leftLabel: 'Option A',
                      left: 'Son usage.',
                      rightLabel: 'Option B',
                      right: 'Son usage.',
                    },
                  ])
                }
              >
                <Plus size={15} />
                Comparaison
              </button>
              <button
                onClick={() =>
                  patch('blocks', [...content.blocks, { type: 'list', items: ['Premier point.'] }])
                }
              >
                <Plus size={15} />
                Liste
              </button>
              <button
                onClick={() =>
                  patch('blocks', [
                    ...content.blocks,
                    { type: 'image', url: 'https://example.org/image.png', alt: 'Description à compléter' },
                  ])
                }
              >
                <Plus size={15} />
                Image
              </button>
            </div>
            <label>
              À retenir
              <textarea
                rows={2}
                value={content.takeaway}
                onChange={(e) => patch('takeaway', e.target.value)}
              />
            </label>
          </section>
          <section className="panel">
            <h2>Sources & vérification</h2>
            <p>
              Chaque référence doit soutenir les affirmations du post. Une URL accessible ne prouve pas leur
              exactitude.
            </p>
            {content.sources.map((s, i) => (
              <div className="source-editor" key={i}>
                <label>
                  URL officielle
                  <input
                    type="url"
                    value={s.url}
                    onChange={(e) =>
                      patch(
                        'sources',
                        content.sources.map((x, j) => (i === j ? { ...x, url: e.target.value } : x)),
                      )
                    }
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Titre
                    <input
                      value={s.title}
                      onChange={(e) =>
                        patch(
                          'sources',
                          content.sources.map((x, j) => (i === j ? { ...x, title: e.target.value } : x)),
                        )
                      }
                    />
                  </label>
                  <label>
                    Éditeur
                    <input
                      value={s.publisher}
                      onChange={(e) =>
                        patch(
                          'sources',
                          content.sources.map((x, j) => (i === j ? { ...x, publisher: e.target.value } : x)),
                        )
                      }
                    />
                  </label>
                </div>
                <label>
                  Affirmations soutenues (une par ligne)
                  <textarea
                    value={s.claims.join('\n')}
                    onChange={(e) =>
                      patch(
                        'sources',
                        content.sources.map((x, j) =>
                          i === j ? { ...x, claims: e.target.value.split('\n') } : x,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  className="text-button"
                  onClick={() =>
                    patch(
                      'sources',
                      content.sources.filter((_, j) => i !== j),
                    )
                  }
                >
                  Retirer cette source
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                patch('sources', [
                  ...content.sources,
                  {
                    url: 'https://',
                    title: '',
                    publisher: '',
                    accessedAt: new Date().toISOString().slice(0, 10),
                    claims: [''],
                  },
                ])
              }
            >
              <Plus size={15} />
              Ajouter une source
            </button>
            <div className="field-grid">
              <label>
                Technologie
                <input
                  value={content.context.technology}
                  onChange={(e) => patch('context', { ...content.context, technology: e.target.value })}
                />
              </label>
              <label>
                Version concernée
                <input
                  value={content.context.version || ''}
                  onChange={(e) => patch('context', { ...content.context, version: e.target.value || null })}
                />
              </label>
            </div>
            <label>
              Trace de vérification
              <textarea
                rows={3}
                value={content.verification || ''}
                onChange={(e) => patch('verification', e.target.value)}
              />
            </label>
            <label>
              Réexaminer dans (jours)
              <input
                type="number"
                min={1}
                max={730}
                value={content.reviewAfterDays}
                onChange={(e) => patch('reviewAfterDays', Number(e.target.value))}
              />
            </label>
            <div className="flag-options">
              {(['needs_sources', 'code_unverified', 'stale', 'reported'] as const).map((f) => (
                <label key={f} className="check-label">
                  <input
                    type="checkbox"
                    checked={content.flags.includes(f)}
                    onChange={(e) =>
                      patch(
                        'flags',
                        e.target.checked ? [...content.flags, f] : content.flags.filter((x) => x !== f),
                      )
                    }
                  />
                  {
                    {
                      needs_sources: 'Sources manquantes',
                      code_unverified: 'Code à vérifier',
                      stale: 'À revalider',
                      reported: 'Signalé',
                    }[f]
                  }
                </label>
              ))}
            </div>
          </section>
        </div>
      )}
      <section className="panel publish-panel">
        <h2>Publication & historique</h2>
        <p>
          Enregistrer crée une version. Publier rend cette version visible et conserve les versions
          précédentes.
        </p>
        <div className="button-row">
          <button className="primary" disabled={busy} onClick={() => action('publish')}>
            <Send size={15} />
            Enregistrer & publier
          </button>
          {postId && (
            <>
              <button disabled={busy} onClick={() => action('unpublish')}>
                Dépublier
              </button>
              <button disabled={busy} onClick={() => action('duplicate')}>
                Dupliquer
              </button>
              <button className="danger" disabled={busy} onClick={() => action('archive')}>
                Archiver
              </button>
            </>
          )}
        </div>
        {versions.length > 0 && (
          <details>
            <summary>Historique des versions ({versions.length})</summary>
            {versions.map((v) => (
              <div className="schedule-row" key={v.version}>
                <span>
                  Version {v.version}
                  {v.isLatest ? ' · dernière' : ''}
                  {v.isPublished ? ' · publiée' : ''}
                  {v.createdAt ? ` · ${new Date(v.createdAt).toLocaleString('fr-FR')}` : ''}
                </span>
                <button onClick={() => inspectVersion(v.version)}>Consulter</button>
              </div>
            ))}
          </details>
        )}
      </section>
      <section className="panel">
        <h2>Question associée</h2>
        {questions.map((q) => (
          <div className="quality-row" key={q.id}>
            <div>
              <strong>{q.prompt}</strong>
              <p className="fine">
                Version {q.version} · {q.status === 'active' ? 'Active' : 'Retirée'}
              </p>
            </div>
            <div className="button-row">
              <button
                onClick={() =>
                  setQuestion(
                    JSON.stringify(
                      {
                        conceptKey: q.conceptKey,
                        prompt: q.prompt,
                        choices: q.choices,
                        correctChoiceId: q.correctChoiceId,
                        explanation: q.explanation,
                      },
                      null,
                      2,
                    ),
                  )
                }
              >
                Préparer une correction
              </button>
              {q.status === 'active' && (
                <button className="danger" disabled={busy} onClick={() => withdrawQuestion(q.id)}>
                  Retirer la question
                </button>
              )}
            </div>
          </div>
        ))}
        <p className="fine">
          Une question à réponse unique, avec distracteurs et correction. La création remplace la version
          active sans effacer les réponses.
        </p>
        <textarea
          className="code-input"
          rows={9}
          aria-label="Question au format JSON"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            '{"prompt":"Quelle est la bonne réponse ?","choices":[{"id":"a","text":"Choix A"},{"id":"b","text":"Choix B"},{"id":"c","text":"Choix C"}],"correctChoiceId":"a","explanation":"Pourquoi cette réponse est correcte, et les autres ne le sont pas."}'
          }
        />
        <button disabled={busy || !question} onClick={saveQuestion}>
          <Check size={15} />
          Enregistrer la question
        </button>
      </section>
    </>
  );
}

type Run = {
  id: string;
  status: string;
  error?: string;
  error_message?: string;
  reserved_cents?: number;
  actual_cents?: number;
  created_at?: string;
  payload?: Record<string, unknown>;
  drafts?: { id: string; title?: string }[];
  jobs?: { status: string; attempts: number }[];
};
type GenConfig = {
  enabled: boolean;
  mode: string;
  reasons: string[];
  monthlyBudgetCents: number;
  maxPerRun: number;
  provider?: string;
  model?: string;
  currency?: string;
  reservationPerDraftCents?: number;
};
function Generation() {
  const { data, error, busy, reload } = useAdmin<{
    config: GenConfig;
    runs: Run[];
    budget: { spent_cents: number; reserved_cents: number; period: string };
  }>('/api/admin/generation-runs');
  const [running, setRunning] = useState(false),
    [message, setMessage] = useState(''),
    [failure, setFailure] = useState(''),
    [selected, setSelected] = useState<Run | null>(null),
    [draftCount, setDraftCount] = useState(1);
  useEffect(() => {
    if (!data?.runs.some((r) => ['queued', 'running'].includes(r.status))) return;
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [data, reload]);
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setRunning(true);
    setFailure('');
    const form = new FormData(e.currentTarget);
    try {
      await mutation('/api/admin/generation-runs', {
        topic: form.get('topic'),
        difficulty: form.get('difficulty'),
        format: form.get('format'),
        learningObjective: form.get('objective'),
        conceptKey: form.get('concept'),
        angle: form.get('angle'),
        count: Number(form.get('count')),
        sourceUrls: String(form.get('sources'))
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage('Lot mis en file. Les résultats resteront des brouillons à relire.');
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Création du lot impossible.');
    } finally {
      setRunning(false);
    }
  }
  async function details(id: string) {
    try {
      const r = await request<{ run?: Run } & Run>(`/api/admin/generation-runs/${id}`);
      setSelected(r.run || r);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Détails indisponibles.');
    }
  }
  async function retry(id: string) {
    try {
      await mutation(`/api/admin/generation-runs/${id}/retry`, {});
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Relance impossible.');
    }
  }
  return (
    <>
      {busy && !data ? (
        <Skeleton />
      ) : error ? (
        <Failure error={error} retry={reload} />
      ) : (
        <>
          <div className={`generation-status ${data?.config.enabled ? 'enabled' : ''}`}>
            <Sparkles size={23} />
            <div>
              <strong>
                {data?.config.enabled
                  ? 'Assistant prêt à préparer des brouillons'
                  : 'Mode sans clé IA — le fil reste disponible'}
              </strong>
              <p>
                {data?.config.enabled
                  ? `Budget mensuel : ${(data.config.monthlyBudgetCents / 100).toFixed(2)} ${data.config.currency || 'USD'} maximum. Aucun contenu n’est publié automatiquement.`
                  : (
                      data?.config.reasons || [
                        'Configure le fournisseur, la clé et un plafond explicite pour activer la génération.',
                      ]
                    ).join(' ')}
              </p>
            </div>
          </div>
          <form className="panel" onSubmit={submit}>
            <h2>Préparer un petit lot</h2>
            <p>Jusqu’à cinq brouillons. Des sources officielles et une relecture avant toute publication.</p>
            <div className="field-grid three">
              <label>
                Thème
                <select name="topic">
                  {Object.entries(topicLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Niveau
                <select name="difficulty" defaultValue="intermediate">
                  {difficulties.map((d) => (
                    <option key={d} value={d}>
                      {difficultyLabels[d]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Format
                <select name="format">
                  {formats.map((f) => (
                    <option key={f} value={f}>
                      {formatLabels[f]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Objectif pédagogique
              <input
                name="objective"
                required
                minLength={10}
                placeholder="Distinguer une réponse HTTP en erreur d’une erreur réseau"
              />
            </label>
            <div className="field-grid">
              <label>
                Identifiant de notion
                <input name="concept" required minLength={3} placeholder="web.fetch.errors" />
              </label>
              <label>
                Angle
                <input
                  name="angle"
                  required
                  minLength={5}
                  placeholder="Le piège d’un fetch qui résout sur 404"
                />
              </label>
            </div>
            <label>
              Sources autorisées (une URL HTTPS par ligne)
              <textarea name="sources" required rows={3} placeholder="https://developer.mozilla.org/…" />
            </label>
            <label>
              Nombre de brouillons
              <input
                name="count"
                type="number"
                min={1}
                max={5}
                value={draftCount}
                onChange={(e) => setDraftCount(Number(e.target.value))}
                required
              />
            </label>
            <p className="fine">
              Le coût est réservé avant chaque lot avec les prix et limites de tokens configurés. Sans tarif
              fiable, aucun appel n’est lancé.
            </p>
            {data?.config.enabled && (
              <p className="notice">
                Réserve maximale du lot :{' '}
                {(((data.config.reservationPerDraftCents || 0) * draftCount) / 100).toFixed(2)}{' '}
                {data.config.currency || 'USD'}. Ce mois :{' '}
                {(Number(data.budget.spent_cents) / 100).toFixed(2)} estimés et{' '}
                {(Number(data.budget.reserved_cents) / 100).toFixed(2)} réservés sur{' '}
                {(data.config.monthlyBudgetCents / 100).toFixed(2)}.
              </p>
            )}
            <button className="primary" disabled={!data?.config.enabled || running}>
              {running ? 'Réservation…' : 'Réserver le budget & lancer'}
              <ArrowRight size={16} />
            </button>
          </form>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {failure && <Failure error={failure} />}
          <section className="panel">
            <div className="section-title">
              <h2>Les lots de génération</h2>
              <button className="icon-button" aria-label="Actualiser les lots" onClick={reload}>
                <RefreshCw size={17} />
              </button>
            </div>
            {data?.runs.length ? (
              data.runs.map((r) => (
                <div key={r.id} className="run-row">
                  <button className="text-button" onClick={() => details(r.id)}>
                    <code>{r.id.slice(0, 8)}</code>
                    <span className="pill">{r.status}</span>
                    <ArrowUpRight size={15} />
                  </button>
                  {r.created_at && (
                    <span className="fine">{new Date(r.created_at).toLocaleString('fr-FR')}</span>
                  )}
                  {r.status === 'failed' && <button onClick={() => retry(r.id)}>Relancer</button>}
                </div>
              ))
            ) : (
              <p className="muted">Aucun lot lancé. La génération est toujours une action volontaire.</p>
            )}
          </section>
          {selected && (
            <section className="panel">
              <div className="section-title">
                <h2>Détail du lot</h2>
                <button onClick={() => setSelected(null)}>Fermer</button>
              </div>
              <pre className="json-detail">{JSON.stringify(selected, null, 2)}</pre>
              <Link href="/admin/posts">
                Relire les brouillons dans les contenus
                <ArrowUpRight size={15} />
              </Link>
            </section>
          )}
        </>
      )}
    </>
  );
}
function Quality() {
  const { data, error, busy, reload } = useAdmin<{
    reports: { id: string; reason: string; title?: string; status: string }[];
    stale: { id: string; title: string }[];
    diagnostics?: Record<string, unknown>;
  }>('/api/admin/quality');
  const [notice, setNotice] = useState('');
  async function resolve(id: string) {
    try {
      await mutation(`/api/admin/reports/${id}`, { status: 'resolved' }, 'PUT');
      setNotice('Signalement résolu.');
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Résolution impossible.');
    }
  }
  return (
    <>
      {busy ? (
        <Skeleton />
      ) : error ? (
        <Failure error={error} retry={reload} />
      ) : (
        <>
          <section className="panel">
            <h2>
              <CircleAlert size={19} />
              Signalements
            </h2>
            {data?.reports.length ? (
              data.reports.map((r) => (
                <div className="quality-row" key={r.id}>
                  <div>
                    <strong>{r.title || 'Contenu signalé'}</strong>
                    <p>{r.reason}</p>
                    <span className="pill">{r.status}</span>
                  </div>
                  {r.status !== 'resolved' && (
                    <button onClick={() => resolve(r.id)}>
                      <Check size={15} />
                      Résolu
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="muted">Aucun signalement en attente.</p>
            )}
          </section>
          <section className="panel">
            <h2>Sources à réexaminer</h2>
            <p className="fine">
              Une échéance de revue signale un contrôle à faire, pas une erreur démontrée.
            </p>
            {data?.stale.length ? (
              data.stale.map((p) => (
                <Link className="editorial-row" href={`/admin/posts/${p.id}`} key={p.id}>
                  <strong>{p.title}</strong>
                  <ArrowUpRight size={15} />
                </Link>
              ))
            ) : (
              <p className="muted">Aucune échéance dépassée.</p>
            )}
          </section>
          {data?.diagnostics && (
            <section className="panel">
              <h2>Diagnostic</h2>
              <pre className="json-detail">{JSON.stringify(data.diagnostics, null, 2)}</pre>
            </section>
          )}
          <section className="panel">
            <h2>Quatorze jours pour observer</h2>
            <p>
              Note trois frictions et trois exemples d’idées retrouvées, retenues ou utilisées. Ce retour
              décidera des prochains ajustements et de l’intérêt d’une recherche sémantique.
            </p>
            <a href="/api/export" className="button" download>
              <Download size={16} />
              Exporter mon activité
            </a>
          </section>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
        </>
      )}
    </>
  );
}
