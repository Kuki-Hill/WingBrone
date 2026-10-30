import { MathUtils, Vector3 } from "three";
import { ATTACK_TIMING, RIDER_Y, SWING_START } from "./game";
import { ENEMY_SCALE } from "./lateralCut";

// The flank determines the entry and sweep direction. Only the height
// determines whether the player should rise or duck.
export function iaiCutPose(dodge: "up" | "down", flank: number, t: number) {
  const dock =
    MathUtils.smoothstep(t, 1.22, 1.39) *
    (1 - MathUtils.smoothstep(t, 3.93, 4.9));
  const stroke = MathUtils.smoothstep(t, SWING_START, ATTACK_TIMING.impact);
  const reach = stroke * (1 - MathUtils.smoothstep(t, 3.82, 4.8));
  const scale = ENEMY_SCALE + 0.24 * dock;
  const entryHeight = dodge === "down" ? 2.3 : -2.3;
  // The high sweep crosses the neutral rider's chest; the low one crosses
  // the legs. The opponent's flank height is exaggerated for readability.
  const targetHeight = dodge === "down" ? 1.6 : -0.35;
  const swordY = 3.3 + (dock * (targetHeight - entryHeight)) / scale;
  const root = new Vector3(
    flank * 6.7 * dock,
    MathUtils.lerp(1, RIDER_Y + entryHeight - 3.3 * scale, dock),
    MathUtils.lerp(-23, -4.5, dock),
  );
  const hand = new Vector3(
    flank * (1.1 - 3.05 * reach),
    swordY,
    1.25 + reach * 0.5,
  );
  const sheathMouth = new Vector3(flank * 1.3, swordY, 0.85);
  const sheathEnd = sheathMouth.clone().add(new Vector3(flank * 3.6, 0, -0.9));
  const angle = MathUtils.lerp(-0.2, Math.PI - 0.47, reach);
  const axis = new Vector3(flank * Math.cos(angle), 0, Math.sin(angle));
  const bladeBase = hand.clone().addScaledVector(axis, 0.3);
  return {
    root,
    scale,
    headScale: 1 + 0.72 * dock,
    hand,
    sheathMouth,
    sheathEnd,
    bladeBase,
    bladeTip: bladeBase.clone().addScaledVector(axis, 1.7 + 5.6 * reach),
    elbow: new Vector3(-flank * (1.8 + reach), 4.25, 1.7),
    red: t >= ATTACK_TIMING.cueStart && t <= ATTACK_TIMING.impact + 0.14,
  };
}
