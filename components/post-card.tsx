'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Heart,
  MoreHorizontal,
  Code2,
  Flag,
  EyeOff,
  ThumbsUp,
} from 'lucide-react';
import type { Block, PublicPost } from '@/lib/contracts';
import { difficultyLabels, formatLabels, topicLabels } from '@/lib/contracts';
import { mutation, request } from '@/lib/client';

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <div className="code-heading">
        <span>
          <i />
          <i />
          <i />
        </span>
        <span>{language}</span>
        <button
          title="Copier le code"
          aria-label="Copier le code"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <pre tabIndex={0}>
        <code>
          {code.split('\n').map((line, i) => (
            <span className="code-line" key={i}>
              <span className="line-number" aria-hidden="true">
                {i + 1}
              </span>
              <span>{line}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
export function ContentBlock({ block }: { block: Block }) {
  if (block.type === 'paragraph') return <p>{block.text}</p>;
  if (block.type === 'code') return <CodeBlock code={block.code} language={block.language} />;
  if (block.type === 'list')
    return (
      <ul className="content-list">
        {block.items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    );
  if (block.type === 'comparison')
    return (
      <div className="comparison">
        <div>
          <span>{block.leftLabel}</span>
          <p>{block.left}</p>
        </div>
        <div>
          <span>{block.rightLabel}</span>
          <p>{block.right}</p>
        </div>
      </div>
    );
  return (
    <figure>
      <img src={block.url} alt={block.alt} loading="lazy" referrerPolicy="no-referrer" />
      <figcaption>{block.alt}</figcaption>
    </figure>
  );
}

export function PostCard({
  post,
  sessionId,
  onSave,
  detail = false,
  preview = false,
}: {
  post: PublicPost;
  sessionId?: string;
  onSave?: (id: string, saved: boolean) => void;
  detail?: boolean;
  preview?: boolean;
}) {
  const [saved, setSaved] = useState(post.saved),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [slide, setSlide] = useState(0),
    [menu, setMenu] = useState(false),
    [notice, setNotice] = useState('');
  const ref = useRef<HTMLElement>(null),
    qualified = useRef(false),
    slideRef = useRef(slide);
  useEffect(() => {
    slideRef.current = slide;
  }, [slide]);
  useEffect(() => {
    setSaved(post.saved);
  }, [post.saved]);
  useEffect(() => {
    if (!sessionId || !ref.current || preview) return;
    let ratio = 0,
      elapsed = 0,
      last = performance.now(),
      pending = false;
    const seen = new Set<number>();
    const observer = new IntersectionObserver(
      ([entry]) => {
        ratio = entry.intersectionRatio;
        last = performance.now();
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(ref.current);
    const timer = setInterval(() => {
      const now = performance.now();
      if (ratio >= 0.6 && document.visibilityState === 'visible') {
        elapsed += now - last;
        seen.add(slideRef.current);
      }
      last = now;
      if (elapsed >= 5000 && !qualified.current && !pending) {
        pending = true;
        mutation('/api/exposures', {
          sessionId,
          postId: post.id,
          eventId: crypto.randomUUID(),
          visibleMs: Math.floor(elapsed),
          ratio: 0.6,
          slides: [...seen],
        })
          .then((data) => {
            qualified.current = true;
            window.dispatchEvent(new CustomEvent('devscroll:exposure', { detail: data }));
          })
          .catch(() => {
            pending = false;
          });
      }
    }, 250);
    return () => {
      clearInterval(timer);
      observer.disconnect();
    };
  }, [sessionId, post.id, preview]);
  async function save() {
    if (busy || preview) return;
    const next = !saved;
    setSaved(next);
    setBusy(true);
    setError('');
    try {
      await request(`/api/saved/${post.id}`, { method: next ? 'PUT' : 'DELETE', keepalive: true });
      onSave?.(post.id, next);
    } catch (e) {
      setSaved(!next);
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }
  async function feedback(kind: string) {
    setMenu(false);
    try {
      if (kind === 'report') {
        const reason = window.prompt('Quelle erreur as-tu repérée ?');
        if (!reason) return;
        await mutation('/api/reports', { postVersionId: post.versionId, reason });
        setNotice('Signalement transmis à la revue éditoriale.');
      } else {
        await mutation('/api/feedback', { postId: post.id, kind });
        setNotice('Préférence enregistrée.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.');
    }
  }
  if (post.unavailable)
    return (
      <article className="post-card unavailable">
        <BookmarkCheck size={20} />
        <h2>Un contenu sauvegardé est indisponible.</h2>
        <p>Il a été retiré pour vérification. Ton favori est conservé.</p>
        <button onClick={save}>Retirer des favoris</button>
      </article>
    );
  return (
    <article className={`post-card format-${post.format}`} ref={ref} id={`post-${post.id}`}>
      <div className="post-top">
        <div className="post-meta">
          <span className={`topic-icon topic-${post.topic}`}>
            <Code2 size={17} />
          </span>
          <span>
            <strong>{topicLabels[post.topic] || post.topic}</strong>
            <small>
              {difficultyLabels[post.difficulty]}
              <span>·</span>
              {formatLabels[post.format]}
            </small>
          </span>
        </div>
        {!preview && (
          <div className="menu-anchor">
            <button
              className="icon-button"
              aria-label="Autres actions"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal size={20} />
            </button>
            {menu && (
              <div className="popover">
                <button onClick={() => feedback('known')}>
                  <Check size={15} />
                  Je connais déjà
                </button>
                <button onClick={() => feedback('more')}>
                  <ThumbsUp size={15} />
                  Plus comme ça
                </button>
                <button onClick={() => feedback('less')}>
                  <EyeOff size={15} />
                  Moins comme ça
                </button>
                <button onClick={() => feedback('report')}>
                  <Flag size={15} />
                  Signaler une erreur
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <h2>{detail || preview ? post.title : <Link href={`/posts/${post.slug}`}>{post.title}</Link>}</h2>
      <div className="post-body">
        {post.format === 'carousel' && !detail ? (
          <>
            <div className="slide-label">
              CARTE {slide + 1} / {post.blocks.length}
            </div>
            <div className="slide-body">
              <ContentBlock block={post.blocks[slide]} />
            </div>
            <div className="carousel-controls">
              <button
                className="icon-button"
                aria-label="Carte précédente"
                disabled={slide === 0}
                onClick={() => setSlide(slide - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                {post.blocks.map((_, i) => (
                  <button
                    key={i}
                    className={slide === i ? 'active' : ''}
                    aria-label={`Carte ${i + 1}`}
                    aria-current={slide === i ? 'step' : undefined}
                    onClick={() => setSlide(i)}
                  />
                ))}
              </div>
              <button
                className="icon-button"
                aria-label="Carte suivante"
                disabled={slide === post.blocks.length - 1}
                onClick={() => setSlide(slide + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </>
        ) : (
          post.blocks.map((b, i) => <ContentBlock key={i} block={b} />)
        )}
      </div>
      <div className="takeaway">
        <span>À RETENIR</span>
        <p>{post.takeaway}</p>
      </div>
      <div className="post-bottom">
        <button
          className={`save-button ${saved ? 'is-saved' : ''}`}
          aria-label={saved ? 'Retirer des favoris' : 'Enregistrer dans les favoris'}
          aria-pressed={saved}
          disabled={busy || preview}
          onClick={save}
        >
          <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
          <span>{saved ? 'Enregistré' : 'Garder l’idée'}</span>
        </button>
        <span className="post-tags">
          {post.tags.slice(0, 2).map((t) => (
            <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`}>
              #{t}
            </Link>
          ))}
        </span>
        {!detail && !preview && (
          <Link className="detail-link" href={`/posts/${post.slug}`} aria-label={`Ouvrir ${post.title}`}>
            <ArrowUpRight size={20} />
          </Link>
        )}
      </div>
      {post.savedAt && (
        <p className="fine saved-date">Enregistré le {new Date(post.savedAt).toLocaleDateString('fr-FR')}</p>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {detail && (
        <details className="sources">
          <summary>
            Sources & contexte{' '}
            <span>
              {post.sources.length} référence{post.sources.length > 1 ? 's' : ''}
            </span>
          </summary>
          <p>
            {post.context.technology}
            {post.context.version ? ` · ${post.context.version}` : ''} · Version éditoriale {post.version}
          </p>
          {post.sources.map((s) => (
            <div key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
                <ArrowUpRight size={14} />
              </a>
              <p className="fine">
                {s.publisher} · consulté le {new Date(s.accessedAt).toLocaleDateString('fr-FR')}
              </p>
              <ul>
                {s.claims.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      )}
    </article>
  );
}
