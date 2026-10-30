import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Pose } from "./camera";
export function poseFromResult(
  result: FaceLandmarkerResult,
  duration: number,
): Pose {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks?.length) return { found: false, yaw: 0, pitch: 0, duration };
  const m = result.facialTransformationMatrixes[0]?.data;
  if (!m) throw new Error("检测到面部，但头部姿态矩阵缺失");
  const xs = landmarks.map((p) => p.x),
    ys = landmarks.map((p) => p.y);
  return {
    found: true,
    duration,
    yaw: (Math.atan2(m[8], m[10]) * 180) / Math.PI,
    pitch: (Math.atan2(-m[9], Math.hypot(m[8], m[10])) * 180) / Math.PI,
    box: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
  };
}
