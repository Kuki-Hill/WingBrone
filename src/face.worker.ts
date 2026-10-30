/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { poseFromResult } from "./pose";
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
        postMessage({
          type: "pose",
          ...poseFromResult(result, performance.now() - started),
        });
      } finally {
        image.close();
      }
    }
  } catch (err) {
    postMessage({ type: "error", message: String(err) });
  }
};
