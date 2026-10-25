import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone">
      <span className="eyebrow">404</span>
      <h1>Cette page nous échappe.</h1>
      <p>Elle a peut-être changé d’adresse.</p>
      <Link className="primary" href="/feed">
        Retrouver le fil
      </Link>
    </main>
  );
}
