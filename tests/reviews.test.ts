import { describe, it, expect } from 'vitest';
import { schedule } from '../modules/reviews/scheduler';

describe('version 1 review scheduler', () => {
  const now = new Date('2026-10-24T22:00:00Z');
  const state = { stageIndex: 2, dueAt: new Date('2026-10-23T22:00:00Z'), failures: 1 };
  it('advances a due correct answer with normal confidence', () => {
    expect(schedule(state, { correct: true, mode: 'review' }, now)).toEqual({
      stageIndex: 3,
      dueAt: new Date('2026-11-07T22:00:00Z'),
      failures: 1,
    });
  });
  it('keeps the stage for a guessed answer', () => {
    expect(schedule(state, { correct: true, guessed: true, mode: 'review' }, now)).toEqual({
      stageIndex: 2,
      dueAt: new Date('2026-10-31T22:00:00Z'),
      failures: 1,
    });
  });
  it('resets an incorrect answer and counts failure', () => {
    expect(schedule(state, { correct: false, mode: 'review' }, now)).toEqual({
      stageIndex: 0,
      dueAt: new Date('2026-10-25T22:00:00Z'),
      failures: 2,
    });
  });
  it('never promotes immediate, skipped or not-yet-due training', () => {
    expect(schedule(state, { correct: true, mode: 'immediate' }, now)).toEqual(state);
    expect(schedule(state, { correct: false, mode: 'review', skipped: true }, now)).toEqual(state);
    const early = { ...state, dueAt: new Date(now.getTime() + 1) };
    expect(schedule(early, { correct: true, mode: 'review' }, now)).toEqual(early);
  });
  it('uses UTC elapsed durations across daylight saving time and accepts exact deadline', () => {
    const atDeadline = { ...state, stageIndex: 0, dueAt: now };
    const result = schedule(atDeadline, { correct: false, mode: 'review' }, now);
    expect(result.dueAt.getTime() - now.getTime()).toBe(86_400_000);
    expect(result.stageIndex).toBe(0);
  });
  it('caps the schedule and stays coherent over a simulated week', () => {
    expect(schedule({ ...state, stageIndex: 6 }, { correct: true, mode: 'review' }, now).stageIndex).toBe(6);
    let next = { stageIndex: 0, dueAt: now, failures: 0 };
    next = schedule(next, { correct: true, mode: 'review' }, now);
    const secondTime = next.dueAt;
    next = schedule(next, { correct: true, mode: 'review' }, secondTime);
    expect(next.stageIndex).toBe(2);
    expect(next.dueAt.getTime() - now.getTime()).toBe(10 * 86_400_000);
  });
});
