import { MathUtils, Vector3 } from "three";
import { ATTACK_TIMING, RIDER_Y, SWING_START } from "./game";
import { ENEMY_SCALE } from "./lateralCut";
export const RUSH_START = SWING_START - 0.05;
export const RUSH_END = SWING_START + 0.02;
export function upperBodyPoint(point: Vector3, tilt: number) {
  return point
    .sub(new Vector3(0, 3, 0))
    .applyAxisAngle(new Vector3(1, 0, 0), tilt)
    .add(new Vector3(0, 3, 0));
}

// The flank determines the entry and sweep direction. Only the height
// determines whether the player should rise or duck.
export function iaiCutPose(dodge: "up" | "down", flank: number, t: number) {
  const dock =
    MathUtils.smoothstep(t, RUSH_START, RUSH_END) *
    (1 - MathUtils.smoothstep(t, 3.93, 4.9));
  const stroke = MathUtils.smoothstep(t, SWING_START, ATTACK_TIMING.impact);
  const reach = stroke * (1 - MathUtils.smoothstep(t, 3.82, 4.8));
  const scale = ENEMY_SCALE + 0.16 + 0.67 * dock;
  const entryHeight = dodge === "down" ? 2.3 : -2.3;
  const anticipation =
    MathUtils.smoothstep(t, 0.25, 0.85) *
    (1 - MathUtils.smoothstep(t, 4.15, 4.85));
  const preparationY = 0.35 + (dodge === "down" ? 1 : -1) * anticipation;
  // The high sweep crosses the neutral rider's chest; the low one crosses
  // the legs. The opponent's flank height is exaggerated for readability.
  const targetHeight = dodge === "down" ? 1.6 : -0.35;
  const swordY =
    3.3 +
    (1 - dock) * (dodge === "down" ? 0.9 : -0.75) +
    (dock * (targetHeight - entryHeight)) / scale;
  const root = new Vector3(
    flank * 6.7 * dock,
    MathUtils.lerp(preparationY, RIDER_Y + entryHeight - 3.3 * scale, dock),
    MathUtils.lerp(-22, -3.8, dock),
  );
  const hand = new Vector3(
    flank * (1.1 - 3.05 * reach),
    swordY,
    1.25 + reach * 0.5,
  );
  const sheathMouth = new Vector3(
    flank * (1.3 + 0.65 * reach),
    swordY - 0.18 * reach,
    0.85 - 1.1 * reach,
  );
  const sheathEnd = sheathMouth
    .clone()
    .add(new Vector3(flank * 3.6, -0.18 * reach, -1.5));
  const angle = MathUtils.lerp(-0.2, Math.PI - 0.47, reach);
  const axis = new Vector3(flank * Math.cos(angle), 0, Math.sin(angle));
  const bladeBase = hand.clone().addScaledVector(axis, 0.3);
  return {
    root,
    scale,
    headScale: 1,
    torsoTilt: 0.24 * (1 - 0.75 * reach),
    legs: [-1, 1].map((side) => ({
      hip: new Vector3(side * 1.15, -2.1, 0),
      knee: new Vector3(
        side * (1.6 + 0.4 * dock),
        -3.65,
        1.2 + (side === -flank ? reach * 1.4 : -reach * 0.4),
      ),
      foot: new Vector3(
        side * (1.8 + 0.5 * dock),
        -5.1,
        side === -flank ? 1.8 + reach * 1.6 : -0.9 - reach,
      ),
    })),
    hand,
    sheathMouth,
    sheathEnd,
    bladeBase,
    bladeTip: bladeBase.clone().addScaledVector(axis, 1.45 + 5.85 * reach),
    elbow: new Vector3(-flank * (1.8 + reach), 4.25, 1.7),
    red: t >= ATTACK_TIMING.cueStart && t <= ATTACK_TIMING.impact + 0.14,
  };
}
