import { describe, it, expect } from "vitest";
import { ATTACK_TIMING, Game } from "../src/game";
import { lateralCutPose } from "../src/lateralCut";

describe("reading the two-handed diagonal attack", () => {
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
        g.time = t;
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
