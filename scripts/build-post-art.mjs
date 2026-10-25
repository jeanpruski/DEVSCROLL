import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Braces,
  Brackets,
  Orbit,
  Terminal,
  Database,
  Globe,
  GitBranch,
  Cloud,
  Cable,
  BrainCircuit,
  History,
  ShieldCheck,
  PanelsTopLeft,
} from 'lucide-react';

const topics = {
  javascript: ['JavaScript', '#f7df1e', Braces, 'javascript'],
  typescript: ['TypeScript', '#64aafa', Brackets, 'typescript'],
  react: ['React', '#61dafb', Orbit, 'react'],
  node: ['Node.js', '#8ed176', Terminal, 'nodedotjs'],
  sql: ['PostgreSQL', '#8fb7e6', Database, 'postgresql'],
  http: ['HTTP / API', '#f1b28c', Globe, null],
  linux: ['Linux', '#edcf8e', Terminal, 'linux'],
  devops: ['Docker / CI', '#85c6f6', GitBranch, 'docker'],
  cloud: ['Cloud', '#c5b7ee', Cloud, null],
  integrations: ['HubSpot / API', '#ff977b', Cable, 'hubspot'],
  ai: ['IA / RAG', '#c9b0f2', BrainCircuit, null],
  culture: ['Culture technique', '#c7d59b', History, 'git'],
  security: ['Sécurité', '#ecb49c', ShieldCheck, null],
  web: ['HTML / Web', '#f1a888', PanelsTopLeft, 'html5'],
};
await mkdir('public/post-art', { recursive: true });
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const assets = [];
const manifest = {};
const frame = (label, color, art, kind) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="128" viewBox="0 0 360 128"><rect width="360" height="128" rx="12" fill="#17231d"/><path d="M0 96H360M280 0V128" stroke="#2b3d31" stroke-dasharray="3 7"/><circle cx="65" cy="64" r="42" fill="#243a2c"/><path d="M116 31h18m-9-9v18M307 86h12m-6-6v12" stroke="${color}" stroke-opacity=".5" stroke-width="2"/><g>${art}</g><text x="145" y="54" fill="${color}" font-family="ui-monospace,monospace" font-size="9" letter-spacing="2">${kind === 'logo' ? 'REPÈRE TECHNIQUE' : 'UNE IDÉE À GARDER'}</text><text x="145" y="79" fill="#e7ece6" font-family="system-ui,sans-serif" font-size="17" font-weight="500">${escape(label)}</text><circle cx="333" cy="20" r="3" fill="${color}"/></svg>`;
async function save(topic, kind, svg, origin) {
  const hash = createHash('sha256').update(svg).digest('hex');
  const file = `${topic}-${kind}-${hash.slice(0, 12)}.svg`;
  await writeFile(`public/post-art/${file}`, svg);
  const alt = `${kind === 'logo' ? 'Logo' : 'Sticker'} ${topics[topic][0]}`;
  const visual = { kind, url: `/post-art/${file}`, alt };
  assets.push({ ...visual, bytes: Buffer.byteLength(svg), sha256: hash, origin });
  manifest[topic] ??= {};
  manifest[topic][kind] = visual;
}
for (const [topic, [label, color, Icon]] of Object.entries(topics)) {
  const icon = renderToStaticMarkup(
    createElement(Icon, { width: 44, height: 44, color, strokeWidth: 1.8 }),
  ).replace('<svg ', '<svg x="43" y="42" ');
  const sticker = `<g transform="rotate(-9 65 64)"><rect x="29" y="27" width="72" height="74" rx="19" fill="#dcebd7" stroke="#ffffff" stroke-width="3"/><rect x="35" y="33" width="60" height="62" rx="14" fill="#243a2c"/></g>${icon}`;
  await save(
    topic,
    'sticker',
    frame(label, color, sticker, 'sticker'),
    'DevScroll original composition; Lucide icons (ISC license), see public/post-art/LICENSES.txt',
  );
}
const results = await Promise.allSettled(
  Object.entries(topics)
    .filter(([, v]) => v[3])
    .map(async ([topic, [label, color, , slug]]) => {
      const url = `https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/${slug}.svg`;
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);
      const svg = await response.text();
      if (/<(script|foreignObject|image|use)\b|\bon\w+=|(?:href|xlink:href)=/i.test(svg))
        throw new Error(`${slug}: SVG inattendu`);
      const paths = svg.match(/<path\b[^>]*\/>/g)?.join('');
      if (!paths) throw new Error(`${slug}: tracé absent`);
      await save(
        topic,
        'logo',
        frame(
          label,
          color,
          `<svg x="41" y="40" width="48" height="48" viewBox="0 0 24 24" fill="${color}">${paths}</svg>`,
          'logo',
        ),
        url,
      );
    }),
);
const failures = results.filter((r) => r.status === 'rejected').map((r) => String(r.reason));
await writeFile(
  'content/art-manifest.json',
  JSON.stringify({ schemaVersion: 1, topics: manifest, assets, failures }, null, 2) + '\n',
);
await writeFile(
  'public/post-art/LICENSES.txt',
  'DevScroll sticker compositions: original project artwork.\nBrand paths: Simple Icons, CC0 1.0, https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md\nBrands remain owned by their respective owners; logos identify technologies discussed.\nSticker pictograms: Lucide, ISC license, https://lucide.dev/license\n',
);
console.log(
  JSON.stringify({
    assets: assets.length,
    logos: assets.filter((a) => a.kind === 'logo').length,
    stickers: assets.filter((a) => a.kind === 'sticker').length,
    bytes: assets.reduce((n, a) => n + a.bytes, 0),
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
