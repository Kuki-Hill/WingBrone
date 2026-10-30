import { MathUtils, Vector3 } from "three";
import { ATTACK_TIMING } from "./game";

export const ENEMY_SCALE = 1.12;
export const SLASH_RELEASE = ATTACK_TIMING.cueEnd + 0.1;

// Local coordinates face the player. Positive X is screen-right.
// Both grips, forearms and blade are sampled on one oriented line.
export function lateralCutPose(side: "left" | "right", time: number) {
  const sign = side === "left" ? -1 : 1;
  const lift = MathUtils.smoothstep(time, 0.4, 1.45);
  const tilt = MathUtils.smoothstep(time, 1.45, ATTACK_TIMING.cueStart - 0.08);
  const swing = MathUtils.smoothstep(
    time,
    ATTACK_TIMING.cueEnd,
    ATTACK_TIMING.impact,
  );
  const recover = MathUtils.smoothstep(time, ATTACK_TIMING.impact + 0.15, 4.85);
  const angle = ((sign * Math.PI) / 4) * tilt;
  const arc = (1 - lift) * 1.05 + Math.PI * swing;
  const axis = new Vector3(
    Math.sin(angle) * Math.cos(arc),
    Math.cos(angle) * Math.cos(arc),
    Math.sin(arc),
  );
  // Return by the same forward arc, avoiding a flip as the cut ends.
  if (recover > 0) {
    const returnArc = MathUtils.lerp(Math.PI, 1.05, recover);
    const returnTilt = angle * (1 - recover);
    axis.set(
      Math.sin(returnTilt) * Math.cos(returnArc),
      Math.cos(returnTilt) * Math.cos(returnArc),
      Math.sin(returnArc),
    );
  }
  const center = new Vector3(
    0,
    2.9 + (2.9 * lift - 3.4 * swing) * (1 - recover),
    2.1 + 1.5 * swing * (1 - recover),
  );
  const onAxis = (distance: number) =>
    center.clone().addScaledVector(axis, distance);
  return {
    rearGrip: onAxis(-0.45),
    frontGrip: onAxis(0.45),
    rearElbow: onAxis(-2.0),
    frontElbow: onAxis(-0.75),
    bladeBase: onAxis(0.78),
    bladeTip: onAxis(7.2),
    // Red means the existing one-second dodge window has opened.
    red: time >= ATTACK_TIMING.cueStart && time <= ATTACK_TIMING.impact + 0.12,
    rootZ: -23 + 7 * swing * (1 - recover),
  };
}
