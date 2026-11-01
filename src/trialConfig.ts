// One source for scheduling, HUD, grading and exported score cards.
export const TRIAL = { attacks: 25, seconds: 60 } as const;
export function performanceTier(hits: number) {
  const score = Math.max(0, Math.min(TRIAL.attacks, Math.floor(hits)));
  return score === TRIAL.attacks
    ? 4
    : score / TRIAL.attacks >= 0.75
      ? 3
      : score / TRIAL.attacks >= 0.5
        ? 2
        : score / TRIAL.attacks >= 0.25
          ? 1
          : 0;
}
