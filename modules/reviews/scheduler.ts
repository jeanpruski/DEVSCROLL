export const algorithmVersion = 1;
export const intervals = [1, 3, 7, 14, 30, 60, 120] as const;
export type LearningState = { stageIndex: number; dueAt: Date; failures: number };
export function schedule(
  state: LearningState,
  result: { correct: boolean; guessed?: boolean; mode: 'immediate' | 'review'; skipped?: boolean },
  now: Date,
): LearningState {
  if (result.mode === 'immediate' || result.skipped || state.dueAt.getTime() > now.getTime())
    return { ...state };
  const stageIndex = !result.correct
    ? 0
    : result.guessed
      ? state.stageIndex
      : Math.min(intervals.length - 1, state.stageIndex + 1);
  return {
    stageIndex,
    dueAt: new Date(now.getTime() + intervals[stageIndex] * 86_400_000),
    failures: state.failures + (result.correct ? 0 : 1),
  };
}
