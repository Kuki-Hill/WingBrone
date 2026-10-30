import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { poseFromResult } from "./pose";
export type Pose = {
  found: boolean;
  yaw: number;
  pitch: number;
  duration?: number;
  box?: { x: number; y: number; width: number; height: number };
};
export class HeadCamera {
  worker: Worker | null = null;
  stream: MediaStream | null = null;
  video = document.createElement("video");
  timer = 0;
  busy = false;
  disposed = false;
  private detector: FaceLandmarker | null = null;
  private engine: "starting" | "worker" | "compatibility" = "starting";
  private startupTimer = 0;
  private frameTimer = 0;
  private frameFailures = 0;
  private reportError: (s: string) => void = () => {};
  private reportStatus: (s: string) => void = () => {};
  private reportPose: (p: Pose) => void = () => {};
  private base = "";
  private workerFailure = "";
  private videoFrameHandle: number | null = null;
  private lastSampleAt = -Infinity;
  private lastMediaTime = -1;
  async start(
    onPose: (p: Pose) => void,
    onStatus: (s: string) => void,
    onError: (s: string) => void,
    deviceId?: string,
  ) {
    this.reportPose = onPose;
    this.reportStatus = onStatus;
    this.reportError = onError;
    this.base = new URL(import.meta.env.BASE_URL, location.href).href;
    try {
      onStatus("正在申请摄像头…");
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 384 },
          height: { ideal: 288 },
          frameRate: { ideal: 30, max: 30 },
          ...(deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: "user" }),
        },
        audio: false,
      });
      if (this.disposed) {
        this.stop();
        return;
      }
      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      if (this.disposed) return;
      onStatus("正在加载本地识别模型…");
      try {
        const worker = new Worker(
          new URL("./face.worker.ts", import.meta.url),
          { type: "module" },
        );
        this.worker = worker;
        worker.onerror = (e) => {
          e.preventDefault();
          const details = [
            e.message,
            e.filename,
            e.lineno ? `line ${e.lineno}` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          void this.startCompatibility(
            details || "Worker 启动或运行失败（浏览器未提供详情）",
          );
        };
        worker.onmessageerror = () =>
          void this.startCompatibility("Worker 识别结果无法传输");
        worker.onmessage = (e) => {
          if (this.disposed || this.worker !== worker) return;
          this.busy = false;
          clearTimeout(this.frameTimer);
          if (e.data.type === "ready") {
            clearTimeout(this.startupTimer);
            this.engine = "worker";
            this.beginFrames(30);
            onStatus("请正视屏幕，保持约两秒");
          } else if (e.data.type === "pose") onPose(e.data);
          else if (e.data.type === "error")
            void this.startCompatibility(e.data.message);
        };
        this.startupTimer = window.setTimeout(
          () => void this.startCompatibility("Worker 初始化超时"),
          15000,
        );
        worker.postMessage({ type: "init", base: this.base });
      } catch (err) {
        await this.startCompatibility(String(err));
      }
    } catch (err) {
      if (!this.disposed) onError(String(err));
    }
  }
  private beginFrames(fps: number) {
    this.stopFrames();
    this.lastSampleAt = -Infinity;
    if (typeof this.video.requestVideoFrameCallback === "function") {
      const next = (now: number) => {
        if (this.disposed) return;
        this.videoFrameHandle = this.video.requestVideoFrameCallback(next);
        if (this.busy || now - this.lastSampleAt < 1000 / fps - 2) return;
        this.lastSampleAt = now;
        void this.frame();
      };
      this.videoFrameHandle = this.video.requestVideoFrameCallback(next);
    } else this.timer = window.setInterval(() => void this.frame(), 1000 / fps);
  }
  private stopFrames() {
    clearInterval(this.timer);
    if (this.videoFrameHandle !== null)
      this.video.cancelVideoFrameCallback?.(this.videoFrameHandle);
    this.videoFrameHandle = null;
  }
  private async startCompatibility(reason: string) {
    if (this.disposed || this.engine === "compatibility") return;
    this.engine = "compatibility";
    this.workerFailure = reason;
    clearTimeout(this.startupTimer);
    clearTimeout(this.frameTimer);
    this.stopFrames();
    this.worker?.terminate();
    this.worker = null;
    this.busy = false;
    this.reportStatus("正在启动兼容识别…");
    // Keep inference local when module workers or OffscreenCanvas are unavailable.
    try {
      const { FaceLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      if (this.disposed) return;
      const detector = await FaceLandmarker.createFromOptions(
        await FilesetResolver.forVisionTasks(this.base + "vision/wasm"),
        {
          baseOptions: {
            modelAssetPath: this.base + "vision/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
        },
      );
      if (this.disposed) {
        detector.close();
        return;
      }
      this.detector = detector;
      this.reportStatus("兼容识别已启动 · 请正视屏幕校准");
      this.beginFrames(20);
    } catch (err) {
      if (!this.disposed)
        this.reportError(
          `兼容识别初始化失败：${String(err)}；原识别模块：${this.workerFailure}`,
        );
    }
  }
  async frame() {
    if (this.busy || this.disposed || this.video.readyState < 2) return;
    if (Number.isFinite(this.video.currentTime)) {
      if (this.video.currentTime === this.lastMediaTime) return;
      this.lastMediaTime = this.video.currentTime;
    }
    this.busy = true;
    try {
      if (this.engine === "compatibility") {
        if (!this.detector) {
          this.busy = false;
          return;
        }
        const start = performance.now();
        const result = this.detector.detectForVideo(this.video, start);
        if (!this.disposed)
          this.reportPose(poseFromResult(result, performance.now() - start));
        this.busy = false;
        this.frameFailures = 0;
        return;
      }
      const worker = this.worker;
      const image = await createImageBitmap(this.video);
      if (this.disposed || !worker || worker !== this.worker) {
        image.close();
        this.busy = false;
        return;
      }
      this.frameTimer = window.setTimeout(
        () => void this.startCompatibility("Worker 处理画面超时"),
        6000,
      );
      worker.postMessage({ type: "frame", image, time: performance.now() }, [
        image,
      ]);
    } catch (err) {
      this.busy = false;
      if (this.disposed) return;
      if (this.engine !== "compatibility")
        void this.startCompatibility(String(err));
      else if (++this.frameFailures >= 3) {
        this.stopFrames();
        this.reportError(`兼容识别读取画面失败：${String(err)}`);
      }
    }
  }
  snapshot(): HTMLCanvasElement {
    if (
      this.disposed ||
      !this.stream ||
      this.video.readyState < 2 ||
      !this.video.videoWidth
    )
      throw new Error("摄像头暂时没有可拍摄的画面");
    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法读取照片画布");
    // Match the mirror shown in the local preview; do not alter pose input.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.video, 0, 0);
    return canvas;
  }
  stop() {
    this.disposed = true;
    clearTimeout(this.startupTimer);
    clearTimeout(this.frameTimer);
    this.stopFrames();
    this.worker?.terminate();
    this.worker = null;
    this.detector?.close();
    this.detector = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
  }
}
