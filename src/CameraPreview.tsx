import { useEffect, useRef, useState } from "react";
import { HeadCamera, Pose } from "./camera";
import { headLevels, directions, labels, type Direction } from "./game";
export function CameraPreview({
  camera,
  pose,
  status,
  expanded,
  onDevice,
  onRestart,
  relativePose,
  sensitivity,
  armed,
  lastAction,
}: {
  camera: HeadCamera | null;
  pose: Pose | null;
  status: string;
  expanded: boolean;
  onDevice: (id: string) => void;
  onRestart: () => void;
  relativePose: { yaw: number; pitch: number } | null;
  sensitivity: number;
  armed: boolean;
  lastAction: { direction: Direction; accepted: boolean; until: number } | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!camera || !host.current) return;
    const video = camera.video;
    host.current.appendChild(video);
    return () => {
      if (video.parentElement === host.current) video.remove();
    };
  }, [camera]);
  const stream = camera?.stream;
  useEffect(() => {
    if (!stream) return;
    let active = true;
    void navigator.mediaDevices
      .enumerateDevices()
      .then((all) => {
        if (active) setDevices(all.filter((d) => d.kind === "videoinput"));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [stream]);
  const visible = expanded || show;
  const box = pose?.found ? pose.box : null;
  const levels =
    relativePose && pose?.found
      ? headLevels(relativePose.yaw, relativePose.pitch, sensitivity)
      : [0, 0, 0, 0];
  const recent =
    lastAction && performance.now() < lastAction.until ? lastAction : null;
  return (
    <aside
      className={`camera-preview ${visible ? "expanded" : "compact"}`}
      aria-label="本地摄像头状态"
    >
      <button className="camera-preview-toggle" onClick={() => setShow(!show)}>
        {pose?.found ? "● 已检测到人脸" : "○ 等待人脸"} ·{" "}
        {visible ? "本地预览" : "查看镜头"}
      </button>
      {relativePose && (
        <div className="head-response" aria-live="polite">
          <strong>
            {!pose?.found
              ? "请让脸部保持入镜"
              : recent
                ? `${labels[recent.direction]}${recent.accepted ? " · 已闪避" : " · 已识别"}`
                : !armed
                  ? "请回正，准备下一次"
                  : "小幅动作即可"}
          </strong>
          <div className="head-meters">
            {directions.map((d, i) => (
              <div key={d}>
                <span>{labels[d]}</span>
                <i>
                  <b style={{ width: `${Math.min(1, levels[i]) * 100}%` }} />
                </i>
                <small>{Math.round(levels[i] * 100)}%</small>
              </div>
            ))}
          </div>
        </div>
      )}
      <div
        className="camera-image"
        ref={host}
        style={{ height: visible ? 138 : 0 }}
      >
        {box && (
          <span
            className="face-box"
            style={{
              left: `${(1 - box.x - box.width) * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
            }}
          />
        )}
      </div>
      {visible && (
        <>
          <p role="status">{status}</p>
          <small>
            {pose?.duration
              ? `最近识别耗时 ${Math.round(pose.duration)} ms · `
              : ""}
            画面只在本机显示
          </small>
          <label>
            摄像头
            <select
              value={stream?.getVideoTracks()[0]?.getSettings().deviceId || ""}
              onChange={(e) => onDevice(e.target.value)}
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `摄像头 ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <button onClick={onRestart}>重启摄像头</button>
          <small>
            若预览黑屏或不是本人，请选择正确镜头；正面光照，脸部完整入镜。
          </small>
        </>
      )}
    </aside>
  );
}
