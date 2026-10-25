import 'dotenv/config';
import { pool, transaction } from '../lib/db';
import { validateConfig } from '../lib/config';
import { postSchema } from '../lib/contracts';
import { searchableText } from '../modules/content/service';

validateConfig();
let cursor: string | null = null,
  total = 0;
try {
  for (;;) {
    const rows: { id: string; content: unknown }[] = (
      await pool.query(
        'SELECT id,content FROM post_versions WHERE ($1::uuid IS NULL OR id>$1::uuid) ORDER BY id LIMIT 200',
        [cursor],
      )
    ).rows;
    if (!rows.length) break;
    await transaction(async (c) => {
      for (const row of rows) {
        const text = searchableText(postSchema.parse(row.content));
        await c.query(
          `UPDATE post_versions SET search_fr=setweight(to_tsvector('french',$2),'A')||setweight(to_tsvector('french',$3),'B'),
          search_simple=setweight(to_tsvector('simple',$2),'A')||setweight(to_tsvector('simple',$3),'B'),search_normalized=$4 WHERE id=$1`,
          [row.id, text.title, text.body, text.normalized],
        );
      }
    });
    total += rows.length;
    cursor = rows.at(-1)!.id;
  }
  console.log(JSON.stringify({ event: 'search_reindexed', versions: total }));
} finally {
  await pool.end();
}
