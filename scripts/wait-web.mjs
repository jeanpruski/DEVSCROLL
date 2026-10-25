const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
for (let n = 0; n < 60; n++) {
  try {
    const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) process.exit(0);
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
console.error('Serveur indisponible après60secondes.');
process.exit(1);
