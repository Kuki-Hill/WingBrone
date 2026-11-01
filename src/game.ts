import { TRIAL } from "./trialConfig";
export type Direction = "left" | "right" | "up" | "down";
export const directions: Direction[] = ["left", "right", "up", "down"];
export const labels: Record<Direction, string> = {
  left: "向左",
  right: "向右",
  up: "抬头",
  down: "低头",
};
export const vectors: Record<Direction, [number, number]> = {
  left: [-2.6, 0],
  right: [2.6, 0],
  up: [0, 2.2],
  down: [0, -2.2],
};
export const thresholds = { horizontal: 1.6, vertical: 1.4 };
export const ATTACK_TIMING = { impact: 3.5, cueStart: 2.5, cueEnd: 3.1 };
export const SWING_START = 3.22;
export const RIDER_Y = 0.2;
export const RIDER_SCALE = 1.3;
export const FLYING_SWORD_SCALE = 1.1;
export const DODGE_TIMING = { enter: 0.1, holdUntil: 1.1, duration: 1.4 };
export function attackCue(cycle: number) {
  if (cycle < 1) return { stage: "rest", text: "凝神 · 等待蓄力", count: "" };
  if (cycle < ATTACK_TIMING.cueStart)
    return {
      stage: "prepare",
      text: "准备方向 · 等绿色提示",
      count: String(Math.ceil((ATTACK_TIMING.cueStart - cycle) / 0.5)),
    };
  if (cycle <= ATTACK_TIMING.cueEnd)
    return { stage: "dodge", text: "现在转头闪避", count: "GO" };
  if (cycle < ATTACK_TIMING.impact)
    return { stage: "impact", text: "挥砍落下", count: "" };
  return { stage: "recover", text: "回到正视 · 准备下一次", count: "" };
}
export function safeAt(d: Direction, x: number, y: number) {
  return d === "left"
    ? x < -thresholds.horizontal
    : d === "right"
      ? x > thresholds.horizontal
      : d === "up"
        ? y > thresholds.vertical
        : y < -thresholds.vertical;
}
export function attackStrip(d: Direction, i: number) {
  const horizontal = d === "left" || d === "right";
  const edge = horizontal ? thresholds.horizontal : thresholds.vertical;
  const width = 5.5 + edge;
  const center = ((5.5 - edge) / 2) * (d === "left" || d === "down" ? 1 : -1);
  const row = -5.5 + (i / 16) * 11;
  return {
    position: [
      horizontal ? center : row,
      (horizontal ? row : center) - 1,
      0,
    ] as [number, number, number],
    size: [horizontal ? width : 0.045, horizontal ? 0.045 : width, 0.12] as [
      number,
      number,
      number,
    ],
  };
}
export function sequence() {
  let seed = Math.floor(Math.random() * 0x100000000);
  // Six per direction, plus a randomly rotated extra direction for the 25th.
  const extra = seed % directions.length;
  const a = Array.from(
    { length: TRIAL.attacks },
    (_, i) => directions[(i + extra) % directions.length],
  );
  do {
    for (let i = a.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
  } while (a.some((d, i) => i > 1 && d === a[i - 1] && d === a[i - 2]));
  return a;
}
export type Phase = "home" | "tutorial" | "trial" | "results";
// Start near the former late-game tempo, with modest acceleration and jitter.
// Keep the one-second actionable warning and a full neutral reset between cuts.
export function attackSchedule(attacks: Direction[], random = Math.random) {
  const weights = attacks.map(
    (_, i) =>
      2.7 -
      (0.6 * i) / Math.max(1, attacks.length - 1) +
      (random() - 0.5) * 0.2,
  );
  const total = weights.reduce((sum, v) => sum + v, 0);
  let start = 0;
  return attacks.map((direction, i) => {
    const end =
      i === attacks.length - 1
        ? TRIAL.seconds
        : start + (TRIAL.seconds * weights[i]) / total;
    const impact = end - 0.55 - random() * 0.15;
    const duration =
      direction === "up" || direction === "down"
        ? 0.085 + random() * 0.035
        : 0.26 + random() * 0.06;
    const slot = {
      start,
      end,
      impact,
      bladeStart: impact - duration,
      flank: random() < 0.5 ? -1 : 1,
    };
    start = end;
    return slot;
  });
}

// Pose keyframes and the HUD share one phase coordinate. The collision is
// evaluated against the corresponding absolute time in the same schedule.
export function attackPhase(
  time: number,
  slot: ReturnType<typeof attackSchedule>[number],
) {
  const map = (a: number, b: number, from: number, to: number) =>
    from + (to - from) * Math.max(0, Math.min(1, (time - a) / (b - a)));
  const cue = slot.impact - 1,
    close = slot.impact - 0.4;
  if (time < cue) return map(slot.start, cue, 0, ATTACK_TIMING.cueStart);
  if (time < close)
    return map(cue, close, ATTACK_TIMING.cueStart, ATTACK_TIMING.cueEnd);
  if (time < slot.bladeStart)
    return map(close, slot.bladeStart, ATTACK_TIMING.cueEnd, SWING_START);
  if (time < slot.impact)
    return map(slot.bladeStart, slot.impact, SWING_START, ATTACK_TIMING.impact);
  return map(slot.impact, slot.end, ATTACK_TIMING.impact, 5);
}
export type Outcome = {
  index: number;
  success: boolean;
  combo: number;
  time: number;
  direction: Direction;
};
export class Game {
  phase: Phase = "home";
  time = 0;
  paused = false;
  countdown = 0;
  run = 0;
  resolved = -1;
  tutorialIndex = 0;
  combo = 0;
  best = 0;
  hits = 0;
  outcomes: Outcome[] = [];
  dodge: { direction: Direction; start: number } | null = null;
  last: Outcome | null = null;
  attacks = sequence();
  schedule = attackSchedule(this.attacks);
  capture: Outcome | null = null;
  start() {
    this.attacks = sequence();
    this.schedule = attackSchedule(this.attacks);
    this.run++;
    this.phase = "tutorial";
    this.time = 0;
    this.resolved = -1;
    this.tutorialIndex = 0;
    this.combo = 0;
    this.best = 0;
    this.hits = 0;
    this.outcomes = [];
    this.last = null;
    this.dodge = null;
    this.paused = false;
    this.countdown = 0;
    this.capture = null;
  }
  get activeDirection() {
    return this.phase === "tutorial"
      ? directions[this.tutorialIndex]
      : this.attacks[this.attackIndex];
  }
  get attackIndex() {
    const index = this.schedule.findIndex((slot) => this.time < slot.end);
    return index < 0 ? this.schedule.length - 1 : index;
  }
  get flank() {
    return this.schedule[
      this.phase === "tutorial" ? this.tutorialIndex : this.attackIndex
    ].flank;
  }
  get cycle() {
    return attackPhase(this.time, this.schedule[this.attackIndex]);
  }
  get position(): [number, number] {
    return this.positionAt(this.time);
  }
  get dodgeTiming() {
    return this.phase === "tutorial"
      ? { enter: 0.1, holdUntil: 0.65, duration: 0.9 }
      : DODGE_TIMING;
  }
  positionAt(t: number): [number, number] {
    if (!this.dodge) return [0, 0];
    const age = t - this.dodge.start;
    const timing = this.dodgeTiming;
    if (age < 0 || age >= timing.duration) return [0, 0];
    const envelope =
      age < timing.enter
        ? Math.sin(((age / timing.enter) * Math.PI) / 2)
        : age < timing.holdUntil
          ? 1
          : Math.cos(
              (((age - timing.holdUntil) /
                (timing.duration - timing.holdUntil)) *
                Math.PI) /
                2,
            );
    const v = vectors[this.dodge.direction];
    return [v[0] * envelope, v[1] * envelope];
  }
  trigger(direction: Direction) {
    if (
      this.paused ||
      this.countdown > 0 ||
      !["trial", "tutorial"].includes(this.phase) ||
      (this.dodge && this.time - this.dodge.start < this.dodgeTiming.duration)
    )
      return false;
    this.dodge = { direction, start: this.time };
    return true;
  }
  tick(dt: number) {
    if (this.paused || this.phase === "home" || this.phase === "results")
      return;
    if (this.countdown > 0) {
      this.countdown = Math.max(0, this.countdown - dt);
      return;
    }
    const next = this.time + Math.max(0, dt);
    if (this.phase === "tutorial") {
      this.time = next;
      if (
        this.dodge?.direction === directions[this.tutorialIndex] &&
        this.time - this.dodge.start >= 0.9
      ) {
        this.tutorialIndex++;
        this.dodge = null;
        if (this.tutorialIndex === 4) {
          this.phase = "trial";
          this.time = 0;
          this.countdown = 3;
        }
      }
      return;
    }
    for (let i = this.resolved + 1; i < this.attacks.length; i++) {
      const event = this.schedule[i].impact;
      if (event > next) break;
      const [x, y] = this.positionAt(event);
      const d = this.attacks[i];
      const success = safeAt(d, x, y);
      this.combo = success ? this.combo + 1 : 0;
      this.best = Math.max(this.best, this.combo);
      if (success) this.hits++;
      const result = {
        index: i,
        success,
        combo: this.combo,
        time: event,
        direction: d,
      };
      this.outcomes.push(result);
      this.last = result;
      this.resolved = i;
      if (success && (!this.capture || result.combo >= this.capture.combo))
        this.capture = result;
    }
    this.time = Math.min(TRIAL.seconds, next);
    if (next >= TRIAL.seconds) this.phase = "results";
  }
}
// Looking down tends to hide the eyes sooner than looking up. Require a
// smaller intentional nod instead of making the player tuck their chin.
export const headThresholds = { left: 12, right: 12, up: 9, down: 6 };
export function headLevels(yaw: number, pitch: number, sensitivity = 1) {
  return [
    -yaw / headThresholds.left,
    yaw / headThresholds.right,
    pitch / headThresholds.up,
    -pitch / headThresholds.down,
  ].map((v) => Math.max(0, v * sensitivity));
}
export class HeadGate {
  armed = true;
  candidate: Direction | null = null;
  since = 0;
  update(
    yaw: number,
    pitch: number,
    now: number,
    sensitivity = 1,
  ): Direction | null {
    const values = headLevels(yaw, pitch, sensitivity);
    if (Math.max(...values) < 0.5) {
      this.armed = true;
      this.candidate = null;
      return null;
    }
    if (!this.armed) return null;
    const i = values.indexOf(Math.max(...values));
    if (values[i] < 1) {
      this.candidate = null;
      return null;
    }
    const d = directions[i];
    if (d !== this.candidate) {
      this.candidate = d;
      this.since = now;
      return null;
    }
    if (now - this.since >= (d === "down" ? 40 : 60)) {
      this.armed = false;
      this.candidate = null;
      return d;
    }
    return null;
  }
}
