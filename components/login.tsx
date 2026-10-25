'use client';
import { useState } from 'react';
import { ArrowRight, LockKeyhole, Terminal } from 'lucide-react';
import { createAuthClient } from 'better-auth/react';
import Link from 'next/link';
const authClient = createAuthClient();
export function Login() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      const r = await authClient.signIn.email({
        email: String(data.get('email')),
        password: String(data.get('password')),
      });
      if (r.error) throw new Error(r.error.message || 'Identifiants incorrects.');
      window.location.replace('/feed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-story">
        <Link href="/" className="brand">
          <span className="brand-mark">d/</span>devscroll<span className="brand-dot">.</span>
        </Link>
        <div>
          <span className="eyebrow mint">LE SCROLL QUI RESTE</span>
          <h1>
            La curiosité
            <br />a de la suite
            <br />
            dans les idées<span className="mint">.</span>
          </h1>
          <p>
            Une notion qui fait tilt. Un bout de code qui ressert.
            <br />
            Un petit détour qui change ta façon de construire.
          </p>
          <div className="login-code">
            <Terminal size={17} />
            <code>while (curious) &#123; learn(); &#125;</code>
          </div>
        </div>
        <span className="subtle">Ton espace privé de culture technique.</span>
      </div>
      <section className="login-form">
        <span className="pill">
          <LockKeyhole size={13} /> ESPACE PERSONNEL
        </span>
        <h2>Reprendre le fil.</h2>
        <p>Connecte-toi pour retrouver tes découvertes.</p>
        <form onSubmit={submit}>
          <label>
            Adresse email
            <input name="email" type="email" autoComplete="username" required placeholder="toi@exemple.fr" />
          </label>
          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              placeholder="Ton mot de passe"
            />
          </label>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="primary wide" disabled={busy}>
            {busy ? 'Connexion…' : 'Entrer dans mon espace'}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="fine">Accès sur invitation du propriétaire. Les inscriptions publiques sont fermées.</p>
      </section>
    </main>
  );
}
