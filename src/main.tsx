import React, { Component, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Scene, { CaptureRequest } from "./Scene";
import {
  Game,
  HeadGate,
  Direction,
  labels,
  directions,
  attackCue,
  ATTACK_TIMING,
} from "./game";
import { HeadCamera, Pose } from "./camera";
import { TrackingHealth } from "./tracking";
import { CameraPreview } from "./CameraPreview";
import { postcard } from "./keepsake";
import "./style.css";
class Boundary extends Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="render-error">
        三维画布无法显示。请使用支持 WebGL 的桌面浏览器。
        <a href="./README.md">查看运行说明</a>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const game = useRef(new Game()).current;
  const [, redraw] = useState(0);
  const [mode, setMode] = useState<"keyboard" | "camera">("keyboard");
  const [status, setStatus] = useState("方向键已就绪");
  const [calibrated, setCalibrated] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [low, setLow] = useState(false);
  const [calm, setCalm] = useState(false);
  const [sensitivity, setSensitivity] = useState(1);
  const [capture, setCapture] = useState<CaptureRequest | null>(null);
  const [photo, setPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const camera = useRef<HeadCamera | null>(null);
  const gate = useRef(new HeadGate());
  const lastHeadAction = useRef<{
    direction: Direction;
    accepted: boolean;
    until: number;
  } | null>(null);
  const baseline = useRef<{ yaw: number; pitch: number } | null>(null);
  const samples = useRef<Pose[]>([]);
  const poseState = useRef({ yaw: 0, pitch: 0 });
  const sensitivityRef = useRef(1);
  sensitivityRef.current = sensitivity;
  const bestFrame = useRef<{ canvas: HTMLCanvasElement; combo: number } | null>(
    null,
  );
  const scheduled = useRef("");
  const finalizing = useRef(-1);
  const photoRef = useRef("");
  const health = useRef(new TrackingHealth());
  const [latestPose, setLatestPose] = useState<Pose | null>(null);
  const device = useRef<string | undefined>(undefined);
  const update = () => redraw((n) => n + 1);
  function resetPhoto() {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    photoRef.current = "";
    setPhoto("");
    setPhotoError("");
    bestFrame.current = null;
    scheduled.current = "";
    finalizing.current = -1;
    setCapture(null);
  }
  function start() {
    resetPhoto();
    game.start();
    gate.current = new HeadGate();
    update();
  }
  function stopCamera() {
    lastHeadAction.current = null;
    poseState.current = { yaw: 0, pitch: 0 };
    camera.current?.stop();
    camera.current = null;
    baseline.current = null;
    samples.current = [];
    health.current.reset(performance.now());
    setLatestPose(null);
    setCalibrated(false);
  }
  function keyboard() {
    stopCamera();
    setMode("keyboard");
    setStatus("方向键已就绪");
    setError("");
  }
  function recalibrate() {
    lastHeadAction.current = null;
    poseState.current = { yaw: 0, pitch: 0 };
    gate.current = new HeadGate();
    baseline.current = null;
    samples.current = [];
    setCalibrated(false);
    game.paused = true;
    setStatus("请正视屏幕，保持约两秒");
    update();
  }
  function onPose(p: Pose) {
    health.current.receive(p.found, performance.now(), p.duration);
    setLatestPose(p);
    if (!p.found) {
      if (!baseline.current) {
        samples.current = [];
        setStatus("未看到完整人脸，请检查右上角镜头预览");
      }
      return;
    }
    if (!baseline.current) {
      samples.current.push(p);
      setStatus(
        `正视校准 ${Math.min(100, Math.round((samples.current.length / 30) * 100))}%`,
      );
      if (samples.current.length >= 30) {
        const s = samples.current;
        const y = s.reduce((a, b) => a + b.yaw, 0) / s.length;
        const pitch = s.reduce((a, b) => a + b.pitch, 0) / s.length;
        if (
          s.some(
            (v) => Math.abs(v.yaw - y) > 4 || Math.abs(v.pitch - pitch) > 4,
          )
        ) {
          samples.current = [];
          setStatus("请保持正视，重新采集…");
          return;
        }
        baseline.current = { yaw: y, pitch };
        setCalibrated(true);
        setStatus("识别就绪 · 小幅转头即可");
      }
      return;
    }
    setStatus(
      game.paused ? "已重新识别到人脸 · 可以继续" : "识别就绪 · 小幅转头即可",
    );
    const b = baseline.current;
    poseState.current.yaw += (p.yaw - b.yaw - poseState.current.yaw) * 0.45;
    const targetPitch = p.pitch - b.pitch;
    const pitchFollow =
      targetPitch < 0 && targetPitch < poseState.current.pitch ? 0.65 : 0.45;
    poseState.current.pitch +=
      (targetPitch - poseState.current.pitch) * pitchFollow;
    const d = gate.current.update(
      poseState.current.yaw,
      poseState.current.pitch,
      performance.now(),
      sensitivityRef.current,
    );
    if (d)
      lastHeadAction.current = {
        direction: d,
        accepted: game.trigger(d),
        until: performance.now() + 1000,
      };
  }
  function enableCamera(selectedDevice?: string) {
    if (selectedDevice) device.current = selectedDevice;
    stopCamera();
    setMode("camera");
    setError("");
    const c = new HeadCamera();
    camera.current = c;
    health.current.reset(performance.now());
    void c.start(
      (p) => {
        if (camera.current === c) onPose(p);
      },
      (s) => {
        if (camera.current === c) setStatus(s);
      },
      (e) => {
        if (camera.current !== c) return;
        setError(e);
        setStatus("摄像头不可用");
        game.paused = true;
        update();
      },
      device.current,
    );
  }
  async function finish(canvas: HTMLCanvasElement, combo: number, run: number) {
    try {
      const blob = await postcard(canvas, {
        combo,
        hits: game.hits,
        best: game.best,
      });
      if (game.run !== run || game.phase !== "results") return;
      const url = URL.createObjectURL(blob);
      if (photoRef.current) URL.revokeObjectURL(photoRef.current);
      photoRef.current = url;
      setPhoto(url);
      setPhotoError("");
    } catch {
      if (game.run === run) setPhotoError("留影暂未生成，点击重试。");
    }
  }
  function requestFrame(key: string, done: (c: HTMLCanvasElement) => void) {
    setCapture({
      key,
      done,
      fail: () => setPhotoError("画面捕获失败，可以重试；成绩已保留。"),
    });
  }
  function retryPhoto() {
    const run = game.run;
    if (bestFrame.current)
      void finish(bestFrame.current.canvas, bestFrame.current.combo, run);
    else
      requestFrame(`${run}-retry-${Date.now()}`, (c) => void finish(c, 0, run));
  }
  useEffect(() => {
    let raf = 0;
    let previous = performance.now();
    let ui = 0;
    function loop(now: number) {
      const dt = (now - previous) / 1000;
      previous = now;
      if (
        mode === "camera" &&
        baseline.current &&
        ["missing", "stalled"].includes(health.current.state(now)) &&
        ["trial", "tutorial"].includes(game.phase)
      ) {
        game.paused = true;
        setStatus(
          health.current.state(now) === "stalled"
            ? "识别处理暂时无响应 · 请重启摄像头"
            : "人脸暂时离开画面 · 已暂停",
        );
      }
      game.tick(dt);
      if (game.capture && game.time >= game.capture.time + 0.1) {
        const outcome = game.capture;
        const key = `${game.run}-${outcome.index}`;
        if (scheduled.current !== key) {
          scheduled.current = key;
          const run = game.run;
          requestFrame(key, (c) => {
            if (game.run === run)
              bestFrame.current = { canvas: c, combo: outcome.combo };
          });
        }
      }
      if (game.phase === "results" && finalizing.current !== game.run) {
        finalizing.current = game.run;
        const run = game.run;
        if (bestFrame.current)
          void finish(bestFrame.current.canvas, bestFrame.current.combo, run);
        else
          requestFrame(`${run}-final`, (c) => {
            if (game.run === run) {
              bestFrame.current = { canvas: c, combo: 0 };
              void finish(c, 0, run);
            }
          });
      }
      if (now - ui > 50) {
        update();
        ui = now;
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") {
        if (["trial", "tutorial"].includes(game.phase)) {
          if (
            game.paused &&
            mode === "camera" &&
            (!baseline.current ||
              health.current.state(performance.now()) !== "tracking")
          )
            return;
          game.paused = !game.paused;
          if (!game.paused) game.countdown = 3;
          update();
        }
        return;
      }
      const map: Record<string, Direction> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      if (map[e.key]) {
        e.preventDefault();
        if (mode === "keyboard" && !e.repeat) game.trigger(map[e.key]);
      }
    }
    function pause() {
      if (["trial", "tutorial"].includes(game.phase)) {
        game.paused = true;
        update();
      }
    }
    window.addEventListener("keydown", key);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", pause);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", pause);
    };
  }, [mode]);
  useEffect(
    () => () => {
      camera.current?.stop();
      if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    },
    [],
  );
  const playing = game.phase === "trial" || game.phase === "tutorial";
  const canContinue =
    mode === "keyboard" ||
    (calibrated && health.current.state(performance.now()) === "tracking");
  const direction = game.activeDirection;
  const signal = attackCue(game.cycle);
  const cue =
    game.phase === "tutorial" ? "试着" + labels[direction] : signal.text;
  return (
    <main>
      <Boundary>
        <Scene
          game={game}
          low={low}
          calm={calm}
          capture={capture}
          onReady={() => setReady(true)}
        />
      </Boundary>
      <div className="vignette" />
      {mode === "camera" && (
        <CameraPreview
          camera={camera.current}
          pose={latestPose}
          relativePose={calibrated ? poseState.current : null}
          sensitivity={sensitivity}
          armed={gate.current.armed}
          lastAction={lastHeadAction.current}
          status={status}
          expanded={game.phase === "home" || game.paused}
          onDevice={(id) => enableCamera(id)}
          onRestart={() => enableCamera()}
        />
      )}
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            game.phase = "home";
            stopCamera();
            setMode("keyboard");
            update();
          }}
        >
          御风<span>WINDBORNE / 01</span>
        </a>
        <div className="settings">
          <label>
            <input
              type="checkbox"
              checked={low}
              onChange={(e) => setLow(e.target.checked)}
            />
            低画质
          </label>
          <label>
            <input
              type="checkbox"
              checked={calm}
              onChange={(e) => setCalm(e.target.checked)}
            />
            减弱动态
          </label>
          {playing && (
            <button
              onClick={() => {
                game.paused = true;
                update();
              }}
            >
              暂停 ↗
            </button>
          )}
        </div>
      </header>
      {game.phase === "home" && (
        <section className="intro">
          <div className="eyebrow">A BODY-CONTROLLED PARTICLE EXPERIENCE</div>
          <h1>
            借一缕风，
            <br />
            避一寸锋。
          </h1>
          <p>
            戴上草帽，踏剑入云。
            <br />
            以头部的轻微动作，穿过竹海间的十二道剑气。
          </p>
          <div className="mode">
            <button
              className={mode === "camera" ? "selected" : ""}
              onClick={() => enableCamera()}
            >
              ◉ 摄像头体感
            </button>
            <button
              className={mode === "keyboard" ? "selected" : ""}
              onClick={keyboard}
            >
              ⌨ 方向键体验
            </button>
          </div>
          <div className="status">{status}</div>
          {error && (
            <p className="error">{error}。可重试摄像头或选择方向键。</p>
          )}
          {mode === "camera" && (
            <label className="sensitivity">
              灵敏度
              <input
                type="range"
                min=".6"
                max="1.6"
                step=".1"
                value={sensitivity}
                onChange={(e) => setSensitivity(+e.target.value)}
              />
            </label>
          )}
          <button
            className="primary"
            disabled={!ready || (mode === "camera" && !calibrated)}
            onClick={start}
          >
            {ready ? "开始御风 →" : "正在生成竹海…"}
          </button>
          <small>
            四次练习 · 一分钟试炼 · 自动精彩留影
            <br />
            摄像头仅在本机处理，不录制、不上传。
          </small>
        </section>
      )}
      {playing && (
        <>
          <aside className="score">
            <span>
              {game.phase === "tutorial"
                ? "入门 / " + (game.tutorialIndex + 1) + " OF 4"
                : "试炼 / " +
                  String(Math.max(0, 60 - Math.floor(game.time))).padStart(
                    2,
                    "0",
                  ) +
                  "s"}
            </span>
            <strong>
              {game.hits}
              <i> / 12 避开</i>
            </strong>
            <small>
              连击 {game.combo}　最高 {game.best}
            </small>
          </aside>
          <section
            className={`cue ${game.phase === "trial" ? signal.stage : "practice"}`}
          >
            <span>
              {game.phase === "tutorial"
                ? "循风习剑 / PRACTICE"
                : "山鬼 · 蓄势挥斩"}
            </span>
            <div className="direction-signal">
              <strong>
                {{ left: "←", right: "→", up: "↑", down: "↓" }[direction]}
              </strong>
              <b>{labels[direction]}</b>
            </div>
            <h2>{cue}</h2>
            {game.phase === "trial" && (
              <>
                <div className="beat-count">{signal.count || "·"}</div>
                <div className="timing">
                  <span
                    className="safe-window"
                    style={{
                      left: `${(ATTACK_TIMING.cueStart / ATTACK_TIMING.impact) * 100}%`,
                      width: `${((ATTACK_TIMING.cueEnd - ATTACK_TIMING.cueStart) / ATTACK_TIMING.impact) * 100}%`,
                    }}
                  />
                  <b
                    style={{
                      width: `${Math.min(1, game.cycle / ATTACK_TIMING.impact) * 100}%`,
                    }}
                  />
                </div>
                <small className="timing-legend">
                  蓄力 ── 等待 ── <em>绿色区闪避</em>
                </small>
              </>
            )}
            <p>
              {mode === "keyboard"
                ? "方向键 ↑ ↓ ← →"
                : "抬头 / 低头 / 左转 / 右转"}{" "}
              · 每次动作后回正
            </p>
          </section>
          {game.last && game.time - game.last.time < 1 && (
            <div
              className={"feedback " + (game.last.success ? "success" : "hit")}
            >
              {game.last.success ? "避 开" : "命 中"}
              <small>
                {game.last.success
                  ? `${game.last.combo} 连击 · 留住风的轨迹`
                  : "回到中央，下一次再试"}
              </small>
            </div>
          )}
          {game.countdown > 0 && !game.paused && (
            <div className="countdown">{Math.ceil(game.countdown)}</div>
          )}
          <footer>
            <span>小幅动作即可，无需离开座位</span>
            <span>ESC 暂停 / 继续</span>
          </footer>
        </>
      )}
      {playing && game.paused && (
        <section className="overlay">
          <div className="panel">
            <div className="eyebrow">TAKE A BREATH</div>
            <h2>风停片刻</h2>
            <p>{mode === "camera" ? status : "试炼已暂停，准备好后继续。"}</p>
            {error && <p className="error">{error}</p>}
            <button
              className="primary"
              disabled={!canContinue}
              onClick={() => {
                game.paused = false;
                game.countdown = 3;
                setStatus("识别就绪");
                update();
              }}
            >
              倒数继续 →
            </button>
            {mode === "camera" && (
              <>
                <button onClick={recalibrate}>重新校准</button>
                <button onClick={keyboard}>改用方向键</button>
              </>
            )}
            <button
              onClick={() => {
                game.phase = "home";
                stopCamera();
                setMode("keyboard");
                update();
              }}
            >
              结束并返回
            </button>
          </div>
        </section>
      )}
      {game.phase === "results" && (
        <section className="overlay results">
          <div className="result-heading">
            <div className="eyebrow">YOUR MOMENT IN THE WIND</div>
            <h1>御风留影</h1>
            <p>
              避开 {game.hits} / 12 · 成功率{" "}
              {Math.round((game.hits / 12) * 100)}% · 最高连击 {game.best}
            </p>
          </div>
          <div className="postcard">
            {photo ? (
              <img src={photo} alt="本局游戏画面与成绩组成的御风纪念图" />
            ) : (
              <p>{photoError || "正在将风的轨迹收进画面…"}</p>
            )}
          </div>
          <div className="result-actions">
            {photo && (
              <>
                <a
                  className="primary"
                  href={photo}
                  download="windborne-keepsake.png"
                >
                  下载 PNG 留念 ↓
                </a>
                <a href={photo} target="_blank" rel="noreferrer">
                  打开图片保存 ↗
                </a>
              </>
            )}
            {photoError && <button onClick={retryPhoto}>重试生成留影</button>}
            <button onClick={start}>再御一次风 →</button>
            <button
              onClick={() => {
                game.phase = "home";
                stopCamera();
                setMode("keyboard");
                update();
              }}
            >
              返回
            </button>
          </div>
        </section>
      )}
      <div className="corner">竹海无尽 · 剑意有形</div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
