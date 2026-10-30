import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeadCamera } from "../src/camera";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  close: vi.fn(),
  detect: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mocks.resolve },
  FaceLandmarker: { createFromOptions: mocks.create },
}));
class FakeWorker {
  static current: FakeWorker;
  onerror: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    FakeWorker.current = this;
  }
}
describe("camera compatibility recovery", () => {
  let stop: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    stop = vi.fn();
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("location", { href: "http://127.0.0.1:5174/" });
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("document", {
      createElement: () => ({
        play: vi.fn().mockResolvedValue(undefined),
        readyState: 4,
      }),
    });
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop }] }),
      },
    });
    mocks.resolve.mockResolvedValue({});
    mocks.create.mockResolvedValue({
      close: mocks.close,
      detectForVideo: mocks.detect,
    });
    mocks.detect.mockReturnValue({
      faceLandmarks: [],
      facialTransformationMatrixes: [],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("automatically switches after a Worker error and continues returning face results", async () => {
    const c = new HeadCamera(),
      pose = vi.fn(),
      status = vi.fn(),
      error = vi.fn();
    await c.start(pose, status, error);
    const w = FakeWorker.current;
    w.onerror!({ preventDefault() {}, message: "Worker failed" });
    await vi.advanceTimersByTimeAsync(150);
    expect(w.terminate).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(pose).toHaveBeenCalledWith(
      expect.objectContaining({ found: false }),
    );
    expect(error).not.toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    c.stop();
    expect(stop).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("falls back when Worker initialization never answers", async () => {
    const c = new HeadCamera();
    await c.start(vi.fn(), vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(15100);
    expect(mocks.create).toHaveBeenCalledOnce();
    c.stop();
  });
  it("closes a detector which finishes loading after the user exits", async () => {
    let complete!: (value: unknown) => void;
    mocks.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const c = new HeadCamera();
    await c.start(vi.fn(), vi.fn(), vi.fn());
    FakeWorker.current.onerror!({ preventDefault() {}, message: "fail" });
    await vi.advanceTimersByTimeAsync(0);
    c.stop();
    complete({ close: mocks.close });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.detect).not.toHaveBeenCalled();
  });
  it("reports both failure causes if compatibility initialization also fails", async () => {
    mocks.create.mockRejectedValue(new Error("model missing"));
    const error = vi.fn();
    const c = new HeadCamera();
    await c.start(vi.fn(), vi.fn(), error);
    FakeWorker.current.onerror!({
      preventDefault() {},
      message: "worker blocked",
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("model missing"),
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("worker blocked"),
    );
    c.stop();
  });
});
