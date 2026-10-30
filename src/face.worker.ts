/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
// MediaPipe falls back to self.import when importScripts is unavailable in
// a module worker. The vendored loaders expose ModuleFactory on globalThis.
(self as unknown as { import: (url: string) => Promise<unknown> }).import = (
  url: string,
) => import(/* @vite-ignore */ url);
let detector: FaceLandmarker;
self.onmessage = async (e) => {
  try {
    if (e.data.type === "init") {
      const base = e.data.base;
      detector = await FaceLandmarker.createFromOptions(
        await FilesetResolver.forVisionTasks(base + "vision/wasm"),
        {
          baseOptions: {
            modelAssetPath: base + "vision/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
        },
      );
      postMessage({ type: "ready" });
    } else {
      const image = e.data.image as ImageBitmap;
      const started = performance.now();
      try {
        const result = detector.detectForVideo(image, e.data.time);
        const landmarks = result.faceLandmarks[0];
        const m = result.facialTransformationMatrixes[0]?.data;
        const duration = performance.now() - started;
        if (!landmarks?.length) {
          postMessage({ type: "pose", found: false, duration });
          return;
        }
        if (!m)
          throw new Error(
            "已检测到面部关键点，但未得到头部姿态矩阵，请重新开启摄像头。",
          );
        const xs = landmarks.map((p) => p.x),
          ys = landmarks.map((p) => p.y);
        const box = {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };
        const yaw = (Math.atan2(m[8], m[10]) * 180) / Math.PI;
        const pitch =
          (Math.atan2(-m[9], Math.hypot(m[8], m[10])) * 180) / Math.PI;
        postMessage({ type: "pose", found: true, yaw, pitch, duration, box });
      } finally {
        image.close();
      }
    }
  } catch (err) {
    postMessage({ type: "error", message: String(err) });
  }
};
