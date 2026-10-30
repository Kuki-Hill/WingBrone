import { describe, expect, it } from "vitest";
import { poseFromResult } from "../src/pose";
import { Game, HeadGate, type Direction } from "../src/game";

function cameraResult(yaw: number, pitch: number) {
  const y = (yaw * Math.PI) / 180,
    p = (pitch * Math.PI) / 180;
  const data = Array(16).fill(0);
  data[0] = 1;
  data[5] = 1;
  data[15] = 1;
  data[8] = Math.sin(y) * Math.cos(p);
  data[9] = -Math.sin(p);
  data[10] = Math.cos(y) * Math.cos(p);
  return {
    faceLandmarks: [
      [
        { x: 0.3, y: 0.2, z: 0, visibility: 1 },
        { x: 0.7, y: 0.8, z: 0, visibility: 1 },
      ],
    ],
    faceBlendshapes: [],
    facialTransformationMatrixes: [{ rows: 4, columns: 4, data }],
  };
}
describe("camera-facing transform to player movement", () => {
  // Signs verified by the player's report: raw negative yaw is physical right;
  // raw negative pitch is looking up. Test the entire pose -> gate -> movement.
  it.each<[Direction, number, number, number, number]>([
    ["right", -20, 0, 1, 0],
    ["left", 20, 0, -1, 0],
    ["up", 0, -15, 0, 1],
    ["down", 0, 15, 0, -1],
  ])(
    "%s head movement moves the avatar in the same direction",
    (direction, yaw, pitch, sx, sy) => {
      const neutral = poseFromResult(cameraResult(3, 2), 10);
      const moved = poseFromResult(cameraResult(yaw + 3, pitch + 2), 10);
      const gate = new HeadGate();
      gate.update(moved.yaw - neutral.yaw, moved.pitch - neutral.pitch, 0);
      const detected = gate.update(
        moved.yaw - neutral.yaw,
        moved.pitch - neutral.pitch,
        110,
      );
      expect(detected).toBe(direction);
      const game = new Game();
      game.start();
      game.trigger(detected!);
      game.tick(0.3);
      expect(Math.sign(game.position[0])).toBe(sx);
      expect(Math.sign(game.position[1])).toBe(sy);
    },
  );
});

