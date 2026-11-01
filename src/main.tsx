import React, { Component, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Scene from "./Scene";
import {
  Game,
  HeadGate,
  Direction,
  directions,
  attackCue,
  ATTACK_TIMING,
} from "./game";
import { HeadCamera, Pose } from "./camera";
import { TrackingHealth } from "./tracking";
import { CameraPreview } from "./CameraPreview";
import { postcard } from "./keepsake";
import { verdict } from "./verdict";
import "./style.css";
import type { UIReview } from "./uiReview";
import {
  directionLabels,
  cueText,
  statusText,
  traditional,
  verdictEnglish,
} from "./uiText";
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
        三維畫布無法顯示 / WEBGL UNAVAILABLE
        <p>
          請使用支援 WebGL 的桌面瀏覽器。 / Use a WebGL-capable desktop browser.
        </p>
        <a href="https://github.com/Kuki-Hill/WingBrone#readme">
          執行說明 / RUN INSTRUCTIONS ↗
        </a>
      </div>
    ) : (
      this.props.children
    );
  }
}
function App({ review }: { review?: UIReview }) {
  const game = useState(() => review?.game ?? new Game())[0];
  const [, redraw] = useState(0);
  const [mode, setMode] = useState<"keyboard" | "camera">(
    review?.tracking === "lost" ? "camera" : "keyboard",
  );
  const [status, setStatus] = useState(
    review?.tracking === "lost" ? "人脸暂时离开画面 · 已暂停" : "方向键已就绪",
  );
  const [calibrated, setCalibrated] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [low, setLow] = useState(false);
  const [calm, setCalm] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [sensitivity, setSensitivity] = useState(1);
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
  }
  function start() {
    resetPhoto();
    game.start();
    gate.current = new HeadGate();
    update();
  }
  function stopCamera() {
    resetPhoto();
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
    poseState.current.yaw += (p.yaw - b.yaw - poseState.current.yaw) * 0.75;
    const targetPitch = p.pitch - b.pitch;
    const pitchFollow =
      targetPitch < 0 && targetPitch < poseState.current.pitch ? 0.85 : 0.75;
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
  async function finish(
    canvas: HTMLCanvasElement | null,
    combo: number,
    run: number,
  ) {
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
  function capturePortrait(): HTMLCanvasElement | null {
    if (
      mode !== "camera" ||
      health.current.state(performance.now()) !== "tracking"
    )
      return null;
    try {
      return camera.current?.snapshot() ?? null;
    } catch {
      return null;
    }
  }
  function retryPhoto() {
    const run = game.run;
    if (bestFrame.current)
      void finish(bestFrame.current.canvas, bestFrame.current.combo, run);
    else {
      const frame = capturePortrait();
      if (frame) bestFrame.current = { canvas: frame, combo: 0 };
      void finish(frame, 0, run);
    }
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
      if (!game.paused && game.last && game.time >= game.last.time + 0.1) {
        const outcome = game.last;
        const key = `${game.run}-${outcome.index}`;
        if (scheduled.current !== key) {
          scheduled.current = key;
          if (!bestFrame.current || outcome.combo >= bestFrame.current.combo) {
            const frame = capturePortrait();
            if (frame)
              bestFrame.current = { canvas: frame, combo: outcome.combo };
          }
        }
      }
      if (game.phase === "results" && finalizing.current !== game.run) {
        finalizing.current = game.run;
        const run = game.run;
        if (bestFrame.current)
          void finish(bestFrame.current.canvas, bestFrame.current.combo, run);
        else {
          const frame = capturePortrait();
          if (frame) bestFrame.current = { canvas: frame, combo: 0 };
          void finish(frame, 0, run);
        }
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
  // Modal keyboard focus is presentation-only; Escape still uses the existing game handler.
  useEffect(() => {
    const modal = document.querySelector<HTMLElement>(
      ".pause-screen, .results",
    );
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const targets = () =>
      [
        ...modal.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], select, input",
        ),
      ].filter((el) => el.getClientRects().length > 0);
    targets()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const all = targets();
      const first = all[0],
        last = all.at(-1);
      if (!first || !last) return;
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !modal.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !modal.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [game.paused, game.phase]);
  const playing = game.phase === "trial" || game.phase === "tutorial";
  const canContinue =
    mode === "keyboard" ||
    (calibrated && health.current.state(performance.now()) === "tracking");
  const direction = game.activeDirection;
  const signal = attackCue(game.cycle);
  const reviewView = game.run === 0 ? review : undefined;
  const cameraPanel = (mode === "camera" ||
    reviewView?.tracking === "found") && (
    <CameraPreview
      camera={camera.current}
      pose={
        reviewView?.tracking === "found"
          ? {
              found: true,
              yaw: 0,
              pitch: 0,
              duration: 24,
              box: { x: 0.3, y: 0.2, width: 0.4, height: 0.6 },
            }
          : latestPose
      }
      relativePose={
        reviewView?.tracking === "found"
          ? { yaw: 3, pitch: -2 }
          : calibrated
            ? poseState.current
            : null
      }
      sensitivity={sensitivity}
      armed={gate.current.armed}
      lastAction={lastHeadAction.current}
      status={
        reviewView?.tracking === "found" ? "识别就绪 · 小幅转头即可" : status
      }
      expanded={game.phase === "home" || game.paused}
      onDevice={(id) => enableCamera(id)}
      onRestart={() => enableCamera()}
    />
  );
  return (
    <main
      className={`state-${game.phase}${game.paused ? " is-paused" : ""}${mode === "camera" || reviewView?.tracking === "found" ? " has-camera" : ""}`}
      data-scene-ready={ready}
    >
      <Boundary>
        <Scene
          game={game}
          low={low}
          calm={calm}
          capture={null}
          onReady={() => setReady(true)}
        />
      </Boundary>
      <div className="vignette" />
      {!(playing && game.paused) && cameraPanel}
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
          WIND//01<span>御風 / PARTICLE INTERCEPTION SYSTEM</span>
        </a>
        <div className="settings">
          <label>
            <input
              type="checkbox"
              checked={low}
              onChange={(e) => setLow(e.target.checked)}
            />
            低畫質 / LOW
          </label>
          <label>
            <input
              type="checkbox"
              checked={calm}
              onChange={(e) => setCalm(e.target.checked)}
            />
            減弱動態 / CALM
          </label>
          {playing && (
            <button
              onClick={() => {
                game.paused = true;
                update();
              }}
            >
              暫停 / PAUSE ↗
            </button>
          )}
        </div>
      </header>
      {game.phase === "home" && (
        <section className="intro">
          <div className="eyebrow">EPISODE 01 / BODY-CONTROLLED EXPERIENCE</div>
          <div className="poster-title" aria-hidden="true">
            WIND<span>//01</span>
          </div>
          <h1>御風。避鋒。</h1>
          <div className="system-title">
            PARTICLE
            <br />
            INTERCEPTION SYSTEM
          </div>
          <p>
            戴上草帽，踏劍入雲。
            <br />
            以輕微頭部動作，穿過十二道劍氣。
            <br />
            <span lang="en">Move your head. Evade twelve strikes.</span>
          </p>
          <div className="mode">
            <button
              className={mode === "camera" ? "selected" : ""}
              aria-pressed={mode === "camera"}
              onClick={() => enableCamera()}
            >
              <span className="control-code">01 / CAMERA</span> 攝影機體感
            </button>
            <button
              className={mode === "keyboard" ? "selected" : ""}
              aria-pressed={mode === "keyboard"}
              onClick={keyboard}
            >
              <span className="control-code">02 / KEYBOARD</span> 方向鍵體驗
            </button>
          </div>
          <div
            className={`status ${mode === "camera" && calibrated ? "tracking-ok" : ""}`}
            role="status"
          >
            {statusText(status)}
          </div>
          {error && (
            <p className="error">
              {traditional(error)}
              <br />
              請重試或使用方向鍵 / Retry or use the keyboard.
            </p>
          )}
          {mode === "camera" && (
            <label className="sensitivity">
              靈敏度 / SENSITIVITY
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
            {ready ? "開始御風 / ENTER →" : "生成竹海 / LOADING…"}
          </button>
          <small>
            四向練習 · 一分鐘試煉 · 自動留影
            <br />4 moves · 60 seconds · A keepsake
            <br />
            體感及留影均在本機處理，不上傳。
            <br />
            Camera tracking & portraits stay on your device.
          </small>
        </section>
      )}
      {playing && (
        <>
          <aside className="score">
            <div className="hud-code">
              FIELD / 01 <span>INTERCEPT</span>
            </div>
            <span>
              {game.phase === "tutorial"
                ? "練習 / DRILL " + (game.tutorialIndex + 1) + " OF 4"
                : "試煉 / TRIAL " +
                  String(Math.max(0, 60 - Math.floor(game.time))).padStart(
                    2,
                    "0",
                  ) +
                  "s"}
            </span>
            <strong>
              {String(game.hits).padStart(2, "0")}
              <i> / 12 避開 / EVADED</i>
            </strong>
            <small>
              CHAIN {String(game.combo).padStart(2, "0")} / BEST{" "}
              {String(game.best).padStart(2, "0")}
            </small>
          </aside>
          {game.phase === "tutorial" && (
            <section className="cue practice">
              <span>TRAINING / 0{game.tutorialIndex + 1} — 04</span>
              <div className="direction-signal">
                <strong aria-hidden="true">
                  {{ left: "←", right: "→", up: "↑", down: "↓" }[direction]}
                </strong>
                <b>{directionLabels[direction]}</b>
              </div>
              <h2>循風習劍 / FOLLOW THE WIND</h2>
              <p>
                {direction === "up" || direction === "down"
                  ? "敵人上移便低頭，下移便抬頭。 / High foe: duck. Low foe: rise."
                  : "刀尖指向哪邊，變紅時往同側躲。 / Follow the tip. Dodge when red."}
              </p>
              <p>
                {mode === "keyboard"
                  ? "方向鍵 / ARROWS ↑ ↓ ← →"
                  : "抬頭・低頭・左轉・右轉 / HEAD MOVEMENTS"}{" "}
                · 回正 / RECENTER
              </p>
              <div
                className="practice-steps"
                aria-label={`练习 ${game.tutorialIndex + 1} / 4`}
              >
                {directions.map((d, i) => (
                  <span
                    key={d}
                    className={
                      i < game.tutorialIndex
                        ? "done"
                        : i === game.tutorialIndex
                          ? "current"
                          : ""
                    }
                  >
                    {i + 1} / {directionLabels[d]}
                  </span>
                ))}
              </div>
            </section>
          )}
          {game.phase === "trial" && (
            <section
              className={`combat-timing ${signal.stage}`}
              aria-label="人物上方的斩击时机提示"
            >
              <div className="strike-code">
                ATK / {String(game.attackIndex + 1).padStart(2, "0")}{" "}
                <span>{signal.stage.toUpperCase()}</span>
              </div>
              <div className="strike-heading">
                <span className="strike-direction">
                  {{ left: "←", right: "→", up: "↑", down: "↓" }[direction]}{" "}
                  {directionLabels[direction]}
                </span>
                <span className="strike-status">{cueText[signal.stage]}</span>
              </div>
              <div className="timing" aria-hidden="true">
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
                蓄力 / WAIT <em>綠框內閃避 / EVADE</em>
              </small>
            </section>
          )}
          {game.last && game.time - game.last.time < 1 && (
            <div
              className={"feedback " + (game.last.success ? "success" : "hit")}
              role="status"
            >
              <span>{game.last.success ? "EVADED" : "IMPACT"}</span>
              <b>{game.last.success ? "避 開" : "命 中"}</b>
              <small>
                {game.last.success
                  ? `${game.last.combo} 連擊 / CHAIN`
                  : "回正，再試一次 / RECENTER & RETRY"}
              </small>
            </div>
          )}
          {game.countdown > 0 && !game.paused && (
            <div className="countdown">{Math.ceil(game.countdown)}</div>
          )}
          <footer>
            <span>小幅動作 / SMALL MOVEMENTS</span>
            <span>ESC 暫停 / PAUSE</span>
          </footer>
        </>
      )}
      {playing && game.paused && (
        <section
          className={`overlay pause-screen ${mode === "camera" && !canContinue ? "tracking-lost" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
        >
          <div className="chapter-word" aria-hidden="true">
            HOLD<span>//01</span>
          </div>
          <div className="panel">
            <div className="eyebrow">
              {mode === "camera" && !canContinue
                ? "SIGNAL / 00 — TRACKING LOST"
                : "INTERMISSION / 01 — STANDBY"}
            </div>
            <h2 id="pause-title">
              風停片刻<span>TAKE A BREATH.</span>
            </h2>
            <p>
              {mode === "camera" ? (
                statusText(status)
              ) : (
                <>
                  試煉已暫停，準備好後繼續。
                  <br />
                  Your trial is on hold. Continue when ready.
                </>
              )}
            </p>
            {error && (
              <p className="error">
                {traditional(error)}
                <br />
                攝影機錯誤 / CAMERA ERROR
              </p>
            )}
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
              倒數繼續 / RESUME →
            </button>
            {mode === "camera" && (
              <>
                <button onClick={recalibrate}>重新校準 / RECALIBRATE</button>
                <button onClick={keyboard}>改用方向鍵 / USE KEYBOARD</button>
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
              結束並返回 / EXIT
            </button>
            <div className="panel-note">
              時間與攻擊已凍結 / CLOCK & ATTACKS ON HOLD
            </div>
          </div>
          {cameraPanel}
        </section>
      )}
      {game.phase === "results" && (
        <section
          className="overlay results"
          aria-label="試煉結果 / TRIAL RESULTS"
        >
          <div className="chapter-word" aria-hidden="true">
            AFTER<span>//01</span>
          </div>
          <div className="result-heading">
            <div className="eyebrow">DEBRIEF / 01 — TRIAL COMPLETE</div>
            <h1>
              江湖黑歷史<span>THE AFTERMATH.</span>
            </h1>
            <h2 className="roast-title">
              {traditional(verdict(game.hits).title)}
            </h2>
            <div className="roast-en">{verdictEnglish(game.hits).title}</div>
            <p>
              {traditional(verdict(game.hits).line)}
              <br />
              <span lang="en">{verdictEnglish(game.hits).line}</span>
            </p>
            <dl className="result-stats">
              <div>
                <dt>避開 / EVADED</dt>
                <dd>
                  {String(game.hits).padStart(2, "0")}
                  <small>/12</small>
                </dd>
              </div>
              <div>
                <dt>成功率 / RATE</dt>
                <dd>
                  {Math.round((game.hits / 12) * 100)}
                  <small>%</small>
                </dd>
              </div>
              <div>
                <dt>最高連擊 / BEST</dt>
                <dd>{String(game.best).padStart(2, "0")}</dd>
              </div>
            </dl>
            <div className="panel-note">
              你的留影只在本機生成。
              <br />
              Your keepsake stays on this device.
            </div>
          </div>
          <div className="postcard">
            {photo ? (
              <img
                src={photo}
                alt="本機人臉抓拍與閃避成績留念卡 / Local portrait and trial score keepsake"
              />
            ) : (
              <p>
                {photoError
                  ? "留影暫未生成，請重試 / CAPTURE FAILED"
                  : "整理黑歷史 / PREPARING KEEPSAKE…"}
              </p>
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
                  下載留念 / SAVE PNG ↓
                </a>
                <a href={photo} target="_blank" rel="noreferrer">
                  開啟圖片 / OPEN IMAGE ↗
                </a>
              </>
            )}
            {photoError && (
              <button onClick={retryPhoto}>重試留影 / RETRY CAPTURE</button>
            )}
            <button onClick={start}>再次試煉 / RETRY →</button>
            <button
              onClick={() => {
                game.phase = "home";
                stopCamera();
                setMode("keyboard");
                update();
              }}
            >
              返回 / HOME
            </button>
          </div>
        </section>
      )}
      <div className="corner" aria-hidden="true">
        W/01 — 竹海無盡 / INTO THE WIND
      </div>
    </main>
  );
}
const root = createRoot(document.getElementById("root")!);
if (import.meta.env.DEV && new URLSearchParams(location.search).has("review")) {
  void import("./uiReview").then(({ createUIReview, ReviewDock }) => {
    const review = createUIReview(location.search);
    root.render(
      <>
        <App review={review} />
        {review && <ReviewDock state={review.state} />}
      </>,
    );
  });
} else root.render(<App />);
