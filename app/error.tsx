'use client';
import Link from 'next/link';
export default function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <span className="eyebrow">UNE INTERRUPTION</span>
      <h1>Le fil a besoin d’un instant.</h1>
      <p>Le serveur n’a pas pu terminer la demande. Tes contenus restent enregistrés.</p>
      <button className="primary" onClick={reset}>
        Réessayer
      </button>
      <Link href="/feed">Revenir au fil</Link>
    </main>
  );
}
