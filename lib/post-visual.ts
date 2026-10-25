import manifest from '@/content/art-manifest.json';
import type { PostContent } from './contracts';

type Visual = NonNullable<PostContent['visual']>;
const topics = manifest.topics as Record<string, { sticker: Visual; logo?: Visual }>;
export function getPostVisual(post: Pick<PostContent, 'slug' | 'topic' | 'visual'>): Visual {
  if (post.visual) return post.visual;
  const art = topics[post.topic] || topics.web;
  const seed = Array.from(post.slug).reduce((value, char) => value + char.charCodeAt(0), 0);
  return seed % 3 === 0 && art.logo ? art.logo : art.sticker;
}
