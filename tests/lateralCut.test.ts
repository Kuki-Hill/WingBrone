import { describe, it, expect } from "vitest";
import { PerspectiveCamera } from "three";
import { ATTACK_TIMING, Game } from "../src/game";
import { ENEMY_SCALE, lateralCutPose } from "../src/lateralCut";

describe("reading the two-handed diagonal attack", () => {
  it.each(["left", "right"] as const)(
    "ignites during the lift, sets crown and chin grips and delivers a one-handed %s cut",
    (side) => {
      const lengthAt = (time: number) => {
        const pose = lateralCutPose(side, time);
        return pose.bladeBase.distanceTo(pose.bladeTip);
      };
      expect(lengthAt(0)).toBe(0);
      expect(lengthAt(0.32)).toBe(0);
      expect(lengthAt(0.43)).toBeCloseTo(lengthAt(0.54) / 2);
      expect(lengthAt(0.54)).toBeCloseTo(6.42);
      expect(lengthAt(4.5)).toBe(0);
      expect(lateralCutPose(side, 0.54).frontGrip.y).toBeGreaterThan(
        lateralCutPose(side, 0.32).frontGrip.y,
      );
      const guard = lateralCutPose(side, ATTACK_TIMING.cueStart);
      expect(guard.frontGrip.y).toBeCloseTo(7.6);
      expect(guard.rearGrip.y).toBeCloseTo(4.6);
      const camera = new PerspectiveCamera(58, 16 / 9, 0.1, 200);
      camera.position.set(0, 3.4, 11);
      camera.lookAt(0, 1.5, -23);
      camera.updateMatrixWorld();
      for (let t = 0.32; t <= ATTACK_TIMING.impact; t += 0.025) {
        const pose = lateralCutPose(side, t);
        const tip = pose.bladeTip.clone().multiplyScalar(ENEMY_SCALE);
        tip.y += 1;
        tip.z += pose.rootZ;
        tip.project(camera);
        expect(Math.max(Math.abs(tip.x), Math.abs(tip.y))).toBeLessThan(0.98);
      }
      const impact = lateralCutPose(side, ATTACK_TIMING.impact);
      expect(impact.frontGrip.distanceTo(impact.hiltBase)).toBeCloseTo(1.15);
      expect(impact.rearGrip.distanceTo(impact.hiltBase)).toBeGreaterThan(2);
    },
  );
  it.each(["left", "right"] as const)(
    "holds the blade pointing %s during the safe input window",
    (side) => {
      const sign = side === "left" ? -1 : 1;
      for (const t of [
        ATTACK_TIMING.cueStart,
        (ATTACK_TIMING.cueStart + ATTACK_TIMING.cueEnd) / 2,
        ATTACK_TIMING.cueEnd,
      ]) {
        const pose = lateralCutPose(side, t);
        const axis = pose.bladeTip.clone().sub(pose.bladeBase).normalize();
        expect(pose.red).toBe(true);
        expect((Math.atan2(axis.x, axis.y) * 180) / Math.PI).toBeCloseTo(
          sign * 45,
        );
        expect(axis.z).toBeCloseTo(0);
        expect((pose.frontGrip.x + pose.rearGrip.x) / 2).toBeCloseTo(0);
        for (const joint of [
          pose.frontGrip,
          pose.rearGrip,
          pose.frontElbow,
          pose.rearElbow,
        ]) {
          expect(
            joint.clone().sub(pose.bladeBase).cross(axis).length(),
          ).toBeCloseTo(0);
        }
        const g = new Game();
        g.start();
        g.phase = "trial";
        g.attacks[0] = side;
        g.time = g.schedule[0].impact + t - ATTACK_TIMING.impact;
        g.trigger(axis.x < 0 ? "left" : "right");
        g.tick(ATTACK_TIMING.impact - t + 0.001);
        expect(g.hits).toBe(1);
      }
      expect(lateralCutPose(side, ATTACK_TIMING.cueStart - 0.1).red).toBe(
        false,
      );
      const landed = lateralCutPose(side, ATTACK_TIMING.impact);
      expect(landed.bladeTip.y).toBeLessThan(landed.frontGrip.y);
      expect(Math.sign(landed.bladeTip.x)).toBe(-sign);
    },
  );
});
