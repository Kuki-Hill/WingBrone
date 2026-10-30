import { MathUtils, Vector3 } from "three";
import { ATTACK_TIMING, SWING_START } from "./game";

export const ENEMY_SCALE = 1.12;
export const SLASH_RELEASE = SWING_START + 0.08;

// Local coordinates face the player. Positive X is screen-right.
// Both grips share the blade axis in high guard. The support hand releases
// only after the red directional cue, as the cutting hand extends.
export function lateralCutPose(side: "left" | "right", time: number) {
  const sign = side === "left" ? -1 : 1;
  const lift = MathUtils.smoothstep(time, 0.18, 1.08);
  const tilt = MathUtils.smoothstep(time, 1.22, 2.08);
  const ignition = MathUtils.smoothstep(time, 0.32, 0.54);
  const bladeLength = ignition * (1 - MathUtils.smoothstep(time, 4.18, 4.44));
  const swing = MathUtils.smoothstep(time, SWING_START, ATTACK_TIMING.impact);
  const recover = MathUtils.smoothstep(time, ATTACK_TIMING.impact + 0.15, 4.85);
  const angle = ((sign * Math.PI) / 4) * tilt;
  // During the overhead lift the tip pitches behind the crown. Bringing it
  // upright into the lateral guard keeps the full 45° silhouette readable.
  const arc = (1 - lift) * 1.05 - lift * (1 - tilt) * 0.52 + Math.PI * swing;
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
    2.9 + (3.2 * lift - 3.0 * swing) * (1 - recover),
    2.1 + (-1.55 * lift + 4.65 * swing) * (1 - recover),
  );
  const onAxis = (distance: number) =>
    center.clone().addScaledVector(axis, distance);
  const release = swing * (1 - recover);
  const gripSpan = MathUtils.lerp(
    0.45,
    1.5 / Math.cos(angle),
    lift * (1 - release) * (1 - recover),
  );
  const base = gripSpan + 0.33;
  return {
    rearGrip: onAxis(-gripSpan).lerp(new Vector3(1.25, 3.5, 1.2), release),
    frontGrip: onAxis(gripSpan),
    rearElbow: onAxis(-gripSpan - 1.55).lerp(
      new Vector3(2.95, 3.65, 0.7),
      release,
    ),
    frontElbow: onAxis(gripSpan - 1.2),
    hiltBase: onAxis(-gripSpan - 0.25),
    bladeLength,
    bladeBase: onAxis(base),
    bladeTip: onAxis(base + 6.42 * bladeLength),
    // Red means the existing one-second dodge window has opened.
    red: time >= ATTACK_TIMING.cueStart && time <= ATTACK_TIMING.impact + 0.12,
    rootZ: -23 + 7 * swing * (1 - recover),
  };
}
