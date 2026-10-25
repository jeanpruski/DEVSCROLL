import { createHash } from 'node:crypto';
export type Candidate = {
  id: string;
  topic: string;
  conceptKey: string;
  difficulty: string;
  feedback?: string;
  saved?: boolean;
};
/** Version 1: preference + level + deterministic tie break, with every fifth slot discovery. */
export function rankCandidates(
  candidates: Candidate[],
  preferences: { topics?: string[]; difficulty?: string },
  seed: string,
): string[] {
  const topics = preferences.topics ?? [];
  const score = (p: Candidate) =>
    (topics.includes(p.topic) ? 20 : 0) +
    (p.difficulty === preferences.difficulty ? 8 : 0) +
    (p.saved ? 2 : 0) +
    (p.feedback === 'more' ? 6 : p.feedback === 'less' ? -25 : p.feedback === 'known' ? -35 : 0);
  const sorted = [...candidates].sort(
    (a, b) =>
      score(b) - score(a) ||
      createHash('sha256')
        .update(`${seed}:${a.id}`)
        .digest('hex')
        .localeCompare(createHash('sha256').update(`${seed}:${b.id}`).digest('hex')),
  );
  const result: Candidate[] = [];
  while (sorted.length) {
    const last = result.at(-1);
    const previous = result.at(-2);
    const discover = result.length % 5 === 4;
    const diverse = (p: Candidate) =>
      p.conceptKey !== last?.conceptKey && !(p.topic === last?.topic && p.topic === previous?.topic);
    let index = sorted.findIndex(
      (p) => diverse(p) && (discover ? !topics.includes(p.topic) : topics.includes(p.topic)),
    );
    if (index < 0) index = sorted.findIndex(diverse);
    if (index < 0) index = 0;
    result.push(sorted.splice(index, 1)[0]);
  }
  return result.map((p) => p.id);
}
