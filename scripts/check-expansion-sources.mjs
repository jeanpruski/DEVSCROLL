import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { expansion } from '../content/batches/expansion-100.source.mjs';
const urls = [...new Set(expansion.map((entry) => entry.source))];
if (urls.length !== 100) throw new Error('Cent références distinctes attendues.');
await mkdir('.local/source-reviews', { recursive: true });
const results = [];
for (let i = 0; i < urls.length; i += 6) {
  const batch = await Promise.all(
    urls.slice(i, i + 6).map(async (url) => {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(25000),
          headers: { 'User-Agent': 'DevScroll editorial reference check' },
        });
        const html = await response.text();
        const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || url)
          .replace(/<[^>]*>/g, '')
          .trim();
        const main =
          html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
          html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
          html;
        const text = main
          .replace(/<(script|style|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/&(?:nbsp|amp|lt|gt|quot);/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const sha = createHash('sha256').update(text).digest('hex');
        await writeFile(`.local/source-reviews/${sha}.txt`, text);
        return {
          url,
          finalUrl: response.url,
          status: response.status,
          title,
          textBytes: Buffer.byteLength(text),
          sha256: sha,
          checkedAt: new Date().toISOString(),
        };
      } catch (e) {
        return { url, status: 0, error: e.message };
      }
    }),
  );
  results.push(...batch);
}
await writeFile('.local/expansion-source-audit.json', JSON.stringify(results, null, 2) + '\n');
if (results.every((r) => r.status === 200 && r.textBytes > 100))
  await writeFile('content/batches/expansion-100.sources.json', JSON.stringify(results, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      sources: results.length,
      successful: results.filter((r) => r.status === 200 && r.textBytes > 100).length,
      failed: results
        .filter((r) => r.status !== 200 || r.textBytes < 100)
        .map((r) => ({ url: r.url, status: r.status, error: r.error })),
      titles: results.filter((r) => r.status === 200).map((r) => ({ title: r.title, bytes: r.textBytes })),
    },
    null,
    2,
  ),
);
if (results.some((r) => r.status !== 200 || r.textBytes < 100)) process.exitCode = 1;
