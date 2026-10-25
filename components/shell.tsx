'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Compass,
  Heart,
  House,
  Lightbulb,
  Moon,
  PanelTop,
  Repeat2,
  Sun,
  Terminal,
} from 'lucide-react';
import type { AppUser } from '@/lib/contracts';
const nav = [
  { href: '/feed', label: 'Le fil', icon: House },
  { href: '/explore', label: 'Explorer', icon: Compass },
  { href: '/saved', label: 'Favoris', icon: Heart },
  { href: '/reviews', label: 'Révisions', icon: Repeat2 },
];
export function Shell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const path = usePathname(),
    [light, setLight] = useState(false);
  useEffect(() => {
    const theme = localStorage.getItem('devscroll:theme');
    setLight(theme === 'light');
    document.documentElement.dataset.theme = theme || 'dark';
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? 'light' : 'dark';
    localStorage.setItem('devscroll:theme', next ? 'light' : 'dark');
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/feed" className="brand">
          <span className="brand-mark">d/</span>devscroll<span className="brand-dot">.</span>
        </Link>
        <div className="sidebar-section-label">TON ESPACE</div>
        <nav aria-label="Navigation principale">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-item ${path.startsWith(n.href) ? 'active' : ''}`}
              aria-current={path.startsWith(n.href) ? 'page' : undefined}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.href === '/feed' && <span className="nav-live" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <Lightbulb size={19} />
          <strong>Une idée suffit.</strong>
          <p>
            Pas besoin de tout lire.
            <br />
            Garde ce qui fait tilt.
          </p>
        </div>
        {user.role === 'owner' && (
          <div className="editorial-link">
            <span className="sidebar-section-label">LES COULISSES</span>
            <Link className={`nav-item ${path.startsWith('/admin') ? 'active' : ''}`} href="/admin/posts">
              <PanelTop size={19} />
              Atelier éditorial
              <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
        <div className="sidebar-footer">
          <button
            className="theme-toggle"
            aria-label={light ? 'Activer le mode sombre' : 'Activer le mode clair'}
            onClick={toggle}
          >
            {light ? <Moon size={17} /> : <Sun size={17} />}
            <span>{light ? 'Mode sombre' : 'Mode clair'}</span>
          </button>
          <Link href="/profile" className="profile-link">
            <span className="avatar">{user.name?.slice(0, 1).toUpperCase() || 'J'}</span>
            <span>
              <strong>{user.name || 'Mon profil'}</strong>
              <small>Espace personnel</small>
            </span>
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </aside>
      <header className="mobile-header">
        <Link className="brand" href="/feed">
          <span className="brand-mark">d/</span>devscroll<span className="brand-dot">.</span>
        </Link>
        <Link href="/profile" className="avatar" aria-label="Profil et réglages">
          {user.name?.slice(0, 1).toUpperCase() || 'J'}
        </Link>
      </header>
      <div className="workspace">
        {children}
        <footer className="workspace-footer">
          <Terminal size={13} />
          Construit pour la curiosité. À ton rythme.<span>DEVSCROLL / ESPACE PRIVÉ</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Navigation mobile">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={path.startsWith(n.href) ? 'active' : ''}
            aria-current={path.startsWith(n.href) ? 'page' : undefined}
          >
            <n.icon size={20} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
export function ReadingAside() {
  return (
    <aside className="reading-aside">
      <div className="aside-top">
        <span className="status-dot" />
        UN ESPACE POUR APPRENDRE
      </div>
      <div className="aside-illustration" aria-hidden="true">
        <div className="orb">
          <span>&#123; &#125;</span>
        </div>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <span className="spark spark-one">+</span>
        <span className="spark spark-two">×</span>
      </div>
      <h3>
        Les petites idées
        <br />
        font leur chemin.
      </h3>
      <p>Un like garde le post dans tes favoris. Une révision t’aide à y revenir au bon moment.</p>
      <div className="aside-rule" />
      <div className="aside-step">
        <span>01</span>
        <div>
          <strong>Explore une idée</strong>
          <p>Un sujet, un exemple concret.</p>
        </div>
      </div>
      <div className="aside-step">
        <span>02</span>
        <div>
          <strong>Garde ce qui te parle</strong>
          <p>Retrouve-le dans tes favoris.</p>
        </div>
      </div>
      <div className="aside-step">
        <span>03</span>
        <div>
          <strong>Laisse un peu de temps</strong>
          <p>Révise à ton rythme.</p>
        </div>
      </div>
      <Link href="/reviews" className="aside-link">
        <BookOpen size={16} />
        Voir mes révisions
        <ArrowUpRight size={15} />
      </Link>
    </aside>
  );
}
