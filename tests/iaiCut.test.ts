import { describe, it, expect } from "vitest";
import {
  attackPhase,
  attackSchedule,
  ATTACK_TIMING,
  Game,
  RIDER_Y,
  RIDER_SCALE,
  FLYING_SWORD_SCALE,
  SWING_START,
} from "../src/game";
import { iaiCutPose, RUSH_START, RUSH_END } from "../src/iaiCut";
import { PerspectiveCamera, Vector3 } from "three";

describe("flank draw and variable tempo", () => {
  it.each(["up", "down"] as const)(
    "reads height for %s from either flank",
    (dir) => {
      for (const flank of [-1, 1]) {
        const pose = iaiCutPose(dir, flank, ATTACK_TIMING.cueStart);
        expect(pose.root.x).toBeCloseTo(0);
        expect(pose.root.z).toBe(-22);
        expect(pose.headScale).toBe(1);
        const arrived = iaiCutPose(dir, flank, RUSH_END);
        expect(Math.sign(arrived.root.x)).toBe(flank);
        expect(arrived.scale).toBeGreaterThan(2);
        expect(arrived.scale / pose.scale).toBeGreaterThan(1.4);
        expect(arrived.legs[0].knee.z).toBeGreaterThan(arrived.legs[0].hip.z);
        const bladeHeight =
          arrived.root.y + arrived.bladeBase.y * arrived.scale;
        expect(Math.sign(bladeHeight - RIDER_Y)).toBe(dir === "up" ? -1 : 1);
        expect(pose.red).toBe(true);
        const cut = iaiCutPose(dir, flank, ATTACK_TIMING.impact);
        expect(cut.bladeBase.y).toBeCloseTo(cut.bladeTip.y);
        expect(Math.sign(cut.root.x + cut.bladeTip.x * cut.scale)).toBe(-flank);
      }
    },
  );
  it("shows distinct high and low red guards before rushing and completes the rush quickly", () => {
    const high = iaiCutPose("down", -1, ATTACK_TIMING.cueStart);
    const low = iaiCutPose("up", 1, ATTACK_TIMING.cueStart);
    expect(high.hand.y - low.hand.y).toBeGreaterThan(1.5);
    expect(iaiCutPose("down", -1, RUSH_START).root.x).toBeCloseTo(0);
    const g = new Game();
    g.start();
    g.schedule.forEach((slot, i) => {
      if (g.attacks[i] === "left" || g.attacks[i] === "right") return;
      const before = slot.impact - 0.4;
      const begin =
        before +
        ((RUSH_START - ATTACK_TIMING.cueEnd) /
          (SWING_START - ATTACK_TIMING.cueEnd)) *
          (slot.bladeStart - before);
      const end =
        slot.bladeStart +
        ((RUSH_END - SWING_START) / (ATTACK_TIMING.impact - SWING_START)) *
          (slot.impact - slot.bladeStart);
      expect(end - begin).toBeLessThan(0.16);
      expect(slot.impact - slot.bladeStart).toBeLessThan(0.131);
    });
  });
  it("raises or lowers the entire opponent at the start before the red cue or flank rush", () => {
    for (const flank of [-1, 1]) {
      const neutral = iaiCutPose("down", flank, 0).root.y;
      const highEarly = iaiCutPose("down", flank, 0.55),
        lowEarly = iaiCutPose("up", flank, 0.55);
      const highReady = iaiCutPose("down", flank, 1),
        lowReady = iaiCutPose("up", flank, 1);
      expect(highEarly.root.y).toBeGreaterThan(neutral);
      expect(lowEarly.root.y).toBeLessThan(neutral);
      expect(highReady.root.y - highEarly.root.y).toBeGreaterThan(0);
      expect(lowReady.root.y - lowEarly.root.y).toBeLessThan(0);
      expect(highReady.root.y - lowReady.root.y).toBeCloseTo(2);
      expect(highReady.root.x).toBeCloseTo(0);
      expect(lowReady.root.x).toBeCloseTo(0);
      expect(highReady.red).toBe(false);
      expect(lowReady.red).toBe(false);
    }
  });
  it("accelerates late attacks and keeps red, swing and impact aligned across the trial", () => {
    const game = new Game();
    game.start();
    game.phase = "trial";
    const slots = game.schedule;
    expect(slots.at(-1)!.end).toBe(60);
    expect(slots[9].start - slots[6].start).toBeLessThan(slots[3].start);
    expect(attackSchedule(game.attacks, () => 0.1)).not.toEqual(
      attackSchedule(game.attacks, () => 0.9),
    );
    slots.forEach((slot, i) => {
      const speed = slot.impact - slot.bladeStart;
      const dir = game.attacks[i];
      expect(
        dir === "up" || dir === "down"
          ? speed < 0.13
          : speed >= 0.26 && speed <= 0.321,
      ).toBe(true);
      expect(attackPhase(slot.bladeStart, slot)).toBeCloseTo(SWING_START);
      game.time = slot.impact - 1;
      expect(game.activeDirection).toBe(dir);
      expect(game.cycle).toBeCloseTo(ATTACK_TIMING.cueStart);
      game.trigger(dir);
      game.tick(1.001);
      expect(game.last?.index).toBe(i);
      expect(game.last?.success).toBe(true);
    });
  });
  it("frames both ends of the diagonal flying sword throughout desktop dodges", () => {
    const camera = new PerspectiveCamera(58, 16 / 9, 0.1, 200);
    for (const [dx, dy] of [
      [0, 0],
      [-2.6, 0],
      [2.6, 0],
      [0, -2.2],
      [0, 2.2],
    ]) {
      camera.position.set(dx * 0.1, 3.1, 13.5);
      camera.lookAt(0, 1.5, -23);
      camera.updateMatrixWorld();
      for (const z of [-3.1, 2.08]) {
        const p = new Vector3(0, 0, z * FLYING_SWORD_SCALE).applyAxisAngle(
          new Vector3(0, 1, 0),
          0.98,
        );
        p.add(new Vector3(0, -0.83, 0))
          .multiplyScalar(RIDER_SCALE)
          .applyAxisAngle(new Vector3(0, 0, 1), -dx * 0.075);
        p.add(new Vector3(dx, dy + RIDER_Y, 1)).project(camera);
        expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeLessThan(0.99);
      }
    }
  });
});
