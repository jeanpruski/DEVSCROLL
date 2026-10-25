import { createHash } from 'node:crypto';
export function choiceOrder(choices: { id: string }[], seed: string) {
  return choices
    .map((c) => c.id)
    .sort((a, b) =>
      createHash('sha256')
        .update(`${seed}:${a}`)
        .digest('hex')
        .localeCompare(createHash('sha256').update(`${seed}:${b}`).digest('hex')),
    );
}
