import { useEffect, useRef, useState } from "react";
import { HeadCamera, Pose } from "./camera";
import { headLevels, directions, type Direction } from "./game";
import { directionLabels, statusText } from "./uiText";
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
  const [show, setShow] = useState<boolean | null>(null);
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
  const visible = show ?? expanded;
  const box = pose?.found ? pose.box : null;
  const levels =
    relativePose && pose?.found
      ? headLevels(relativePose.yaw, relativePose.pitch, sensitivity)
      : [0, 0, 0, 0];
  const recent =
    lastAction && performance.now() < lastAction.until ? lastAction : null;
  return (
    <aside
      className={`camera-preview ${visible ? "expanded" : "compact"} ${pose?.found ? "tracking-found" : "tracking-waiting"}`}
      aria-label="攝影機追蹤 / CAMERA TRACKING"
    >
      <div className="sensor-code">
        SENSOR / 01 <span>LOCAL ONLY</span>
      </div>
      <button
        className="camera-preview-toggle"
        aria-expanded={visible}
        onClick={() => setShow(!visible)}
      >
        <span>
          {pose?.found ? "● 識別成功 / LOCKED" : "○ 等待人臉 / SEARCH"}
        </span>
        <b aria-hidden="true">{visible ? "−" : "+"}</b>
      </button>
      {relativePose && (
        <div className="head-response">
          <strong role="status">
            {!pose?.found
              ? "請保持入鏡 / FACE THE CAMERA"
              : recent
                ? `${directionLabels[recent.direction]}${recent.accepted ? " · 已閃避 / EVADED" : " · 已識別 / DETECTED"}`
                : !armed
                  ? "請回正 / RECENTER TO REARM"
                  : "小幅動作即可 / SMALL MOVEMENTS"}
          </strong>
          <div className="head-meters">
            {directions.map((d, i) => (
              <div key={d}>
                <span>{directionLabels[d]}</span>
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
        {!camera && (
          <span className="camera-placeholder">
            NO LIVE FEED
            <br />
            本機預覽 / LOCAL PREVIEW
          </span>
        )}
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
          <p role="status">{statusText(status)}</p>
          <small>
            {pose?.duration
              ? `INFERENCE ${Math.round(pose.duration)} ms / `
              : ""}
            本機處理 / ON DEVICE
          </small>
          <label>
            輸入裝置 / VIDEO SOURCE
            <select
              value={stream?.getVideoTracks()[0]?.getSettings().deviceId || ""}
              onChange={(e) => onDevice(e.target.value)}
            >
              {devices.length === 0 && (
                <option value="">等待裝置 / WAITING</option>
              )}
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `攝影機 / CAMERA ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <button onClick={onRestart}>重啟攝影機 / RESTART ↗</button>
          <small>
            正面光照，整張臉入鏡。
            <br />
            Face the light. Keep your whole face in frame.
          </small>
        </>
      )}
    </aside>
  );
}
