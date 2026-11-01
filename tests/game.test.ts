import { TRIAL } from "../src/trialConfig";
import { describe, it, expect } from "vitest";
import {
  Game,
  HeadGate,
  sequence,
  directions,
  safeAt,
  attackStrip,
  ATTACK_TIMING,
  attackCue,
  attackSchedule,
  DODGE_TIMING,
} from "../src/game";
describe("trial", () => {
  it("keeps all 25 quick attacks fair through random timing extremes and simulated input delay", () => {
    for (const random of [0, 0.5, 1]) {
      for (const latency of [0, 0.15, 0.3]) {
        const g = new Game();
        g.start();
        g.phase = "trial";
        g.schedule = attackSchedule(g.attacks, () => random);
        g.schedule.forEach((slot, i) => {
          expect(slot.impact - 1).toBeGreaterThan(slot.start);
          if (i)
            expect(slot.impact - g.schedule[i - 1].impact).toBeGreaterThan(
              DODGE_TIMING.duration + 0.1,
            );
          g.time = slot.impact - 1 + latency;
          expect(g.trigger(g.attacks[i])).toBe(true);
          g.tick(1 - latency + 0.001);
          expect(g.last?.success).toBe(true);
        });
        g.tick(TRIAL.seconds - g.time);
        expect(g.phase).toBe("results");
        expect(g.outcomes).toHaveLength(25);
        expect(g.hits).toBe(25);
        expect(g.best).toBe(25);
      }
    }
  });
  it("starts near the former late-game pace and modestly accelerates over the minute", () => {
    const schedule = attackSchedule(sequence(), () => 0.5);
    const intervals = schedule.map((s) => s.end - s.start);
    expect(intervals[0]).toBeCloseTo(2.7);
    expect(intervals.at(-1)).toBeCloseTo(2.1);
    expect(schedule.at(-1)!.end).toBe(60);
    expect(intervals.every((v) => v >= 2 && v <= 2.9)).toBe(true);
  });
  it("the entire green window allows a successful dodge including 300ms input latency", () => {
    for (const d of directions)
      for (const latency of [0, 0.15, 0.3])
        for (
          let t = ATTACK_TIMING.cueStart;
          t <= ATTACK_TIMING.cueEnd + 0.00001;
          t += 0.01
        ) {
          const g = new Game();
          g.start();
          g.phase = "trial";
          g.attacks[0] = d;
          g.time = g.schedule[0].impact - ATTACK_TIMING.impact + t + latency;
          g.trigger(d);
          g.tick(g.schedule[0].impact - g.time + 0.001);
          expect(g.hits, `${d} at ${t} + ${latency}`).toBe(1);
        }
  });
  it("separates countdown, dodge window, and impact feedback", () => {
    expect(attackCue(1.1).count).toBe("3");
    expect(attackCue(1.8).count).toBe("2");
    expect(attackCue(2.2).count).toBe("1");
    expect(ATTACK_TIMING.impact - ATTACK_TIMING.cueStart).toBe(1);
    expect(attackCue(2.5).stage).toBe("dodge");
    expect(attackCue(3).stage).toBe("dodge");
    expect(attackCue(3.4).stage).toBe("impact");
    expect(attackCue(3.6).stage).toBe("recover");
  });
  it("lets the user move immediately at the one-second warning and remain safe at impact", () => {
    for (const d of directions) {
      const g = new Game();
      g.start();
      g.phase = "trial";
      g.attacks[0] = d;
      g.time = g.schedule[0].impact - 1;
      g.trigger(d);
      g.tick(1.001);
      expect(g.hits).toBe(1);
    }
  });
  it("balances directions and avoids triples", () => {
    const a = sequence();
    expect(a).toHaveLength(TRIAL.attacks);
    for (const d of directions)
      expect([6, 7]).toContain(a.filter((v) => v === d).length);
    expect(a.some((d, i) => i > 1 && d === a[i - 1] && d === a[i - 2])).toBe(
      false,
    );
  });
  it("requires sustained pose and neutral rearming", () => {
    const h = new HeadGate();
    expect(h.update(-15, 0, 0)).toBe(null);
    expect(h.update(-15, 0, 110)).toBe("left");
    expect(h.update(-15, 0, 500)).toBe(null);
    h.update(0, 0, 600);
    h.update(15, 0, 650);
    expect(h.update(15, 0, 760)).toBe("right");
  });
  it("recognizes a small downward nod quickly, without triggering on tiny drift or held posture", () => {
    const h = new HeadGate();
    expect(h.update(0, -3, 0)).toBe(null);
    expect(h.update(0, -3, 200)).toBe(null);
    expect(h.update(0, -6.5, 300)).toBe(null);
    expect(h.update(0, -6.5, 365)).toBe("down");
    expect(h.update(0, -6.5, 800)).toBe(null);
    h.update(0, 0, 900);
    h.update(0, -6.5, 950);
    expect(h.update(0, -6.5, 1015)).toBe("down");
  });
  it("keeps upward threshold deliberate while allowing a smaller downward nod", () => {
    const h = new HeadGate();
    h.update(0, 6.5, 0);
    expect(h.update(0, 6.5, 200)).toBe(null);
    h.update(0, 10, 300);
    expect(h.update(0, 10, 410)).toBe("up");
  });
  it("does not score tutorial", () => {
    const g = new Game();
    g.start();
    for (const d of directions) {
      g.trigger(d);
      g.tick(1);
    }
    expect(g.phase).toBe("trial");
    expect(g.hits).toBe(0);
    expect(g.countdown).toBe(3);
  });
  it("judges event position even when frame crosses collision", () => {
    const g = new Game();
    g.start();
    g.phase = "trial";
    g.time = g.schedule[0].impact - 0.45;
    g.trigger(g.attacks[0]);
    g.tick(0.7);
    expect(g.hits).toBe(1);
    expect(g.capture?.combo).toBe(1);
  });
  it("freezes paused attacks and ignores repeated dodges", () => {
    const g = new Game();
    g.start();
    expect(g.trigger("left")).toBe(true);
    expect(g.trigger("right")).toBe(false);
    g.paused = true;
    g.tick(5);
    expect(g.time).toBe(0);
  });
  it("completes all misses and resets per-run state", () => {
    const g = new Game();
    g.start();
    g.phase = "trial";
    g.tick(61);
    expect(g.outcomes).toHaveLength(TRIAL.attacks);
    expect(g.phase).toBe("results");
    expect(g.capture).toBe(null);
    const run = g.run;
    g.start();
    expect(g.run).toBe(run + 1);
    expect(g.outcomes).toHaveLength(0);
  });
  it("retains highest combo and chooses later equal combo", () => {
    const g = new Game();
    g.start();
    g.phase = "trial";
    for (let i = 0; i < TRIAL.attacks; i++) {
      g.time = g.schedule[i].impact - 0.4;
      g.dodge = null;
      if (i % 2 === 0) g.trigger(g.attacks[i]);
      g.tick(0.5);
    }
    expect(g.capture?.index).toBe(24);
    expect(g.best).toBe(1);
  });
  it("does not award an early or wrong-direction dodge", () => {
    for (const early of [true, false]) {
      const g = new Game();
      g.start();
      g.phase = "trial";
      g.time = g.schedule[0].impact - (early ? 2.5 : 0.4);
      g.trigger(
        early ? g.attacks[0] : directions.find((d) => d !== g.attacks[0])!,
      );
      g.tick(g.schedule[0].impact + 0.5 - g.time);
      expect(g.hits).toBe(0);
    }
  });
  it("does not count down while paused", () => {
    const g = new Game();
    g.start();
    g.countdown = 3;
    g.paused = true;
    g.tick(10);
    expect(g.countdown).toBe(3);
    g.paused = false;
    g.tick(1);
    expect(g.countdown).toBe(2);
    expect(g.time).toBe(0);
  });
  it("renders dangerous region to the same boundary as collision", () => {
    for (const d of directions) {
      const strip = attackStrip(d, 8);
      const horizontal = d === "left" || d === "right";
      const axis = horizontal ? 0 : 1;
      const center = strip.position[axis] + (axis === 1 ? 1 : 0);
      const half = strip.size[axis] / 2;
      const boundary =
        d === "left" || d === "down" ? center - half : center + half;
      const safe = boundary + (d === "left" || d === "down" ? -0.01 : 0.01);
      expect(safeAt(d, horizontal ? safe : 0, horizontal ? 0 : safe)).toBe(
        true,
      );
      expect(safeAt(d, horizontal ? center : 0, horizontal ? 0 : center)).toBe(
        false,
      );
    }
  });
});
