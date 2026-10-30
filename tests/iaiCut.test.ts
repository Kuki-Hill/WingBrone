import { describe, it, expect } from "vitest";
import {
  attackPhase,
  attackSchedule,
  ATTACK_TIMING,
  Game,
  RIDER_Y,
  SWING_START,
} from "../src/game";
import { iaiCutPose } from "../src/iaiCut";
import { PerspectiveCamera, Vector3 } from "three";

describe("flank draw and variable tempo", () => {
  it.each(["up", "down"] as const)(
    "reads height for %s from either flank",
    (dir) => {
      for (const flank of [-1, 1]) {
        const pose = iaiCutPose(dir, flank, ATTACK_TIMING.cueStart);
        expect(Math.sign(pose.root.x)).toBe(flank);
        expect(pose.headScale).toBeGreaterThan(1.6);
        const bladeHeight = pose.root.y + pose.bladeBase.y * pose.scale;
        expect(Math.sign(bladeHeight - RIDER_Y)).toBe(dir === "up" ? -1 : 1);
        expect(pose.red).toBe(true);
        const cut = iaiCutPose(dir, flank, ATTACK_TIMING.impact);
        expect(cut.bladeBase.y).toBeCloseTo(cut.bladeTip.y);
        expect(Math.sign(cut.root.x + cut.bladeTip.x * cut.scale)).toBe(-flank);
      }
    },
  );
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
      expect(dir === "up" || dir === "down" ? speed < 0.2 : speed > 0.3).toBe(
        true,
      );
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
      camera.position.set(dx * 0.1, 3.1, 12.5);
      camera.lookAt(0, 1.5, -23);
      camera.updateMatrixWorld();
      for (const z of [-3.1, 2.08]) {
        const p = new Vector3(0, 0, z * 1.3).applyAxisAngle(
          new Vector3(0, 1, 0),
          0.98,
        );
        p.add(new Vector3(0, -0.83, 0)).applyAxisAngle(
          new Vector3(0, 0, 1),
          -dx * 0.075,
        );
        p.add(new Vector3(dx, dy + RIDER_Y, 1)).project(camera);
        expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeLessThan(0.99);
      }
    }
  });
});
