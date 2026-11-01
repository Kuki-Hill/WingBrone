// Imported only by the DEV bootstrap. Fixtures never request a camera or alter Game.
import { Game, attackSchedule, type Direction } from "./game";
import { TRIAL } from "./trialConfig";

export type UIReview = {
  game: Game;
  state: string;
  tracking: "found" | "lost" | null;
  uiOnly: boolean;
};
class ReviewGame extends Game {
  frozen = false;
  wasPaused = false;
  override start() {
    this.frozen = false;
    super.start();
  }
  override trigger(direction: Direction) {
    if (!this.paused) this.frozen = false;
    return super.trigger(direction);
  }
  override tick(dt: number) {
    if (this.wasPaused && !this.paused) this.frozen = false;
    this.wasPaused = this.paused;
    if (!this.frozen) super.tick(dt);
  }
}
export function createUIReview(search: string): UIReview | undefined {
  const p = new URLSearchParams(search);
  const state = p.get("review") || "";
  if (
    ![
      "home",
      "tutorial",
      "trial",
      "paused",
      "tracking-lost",
      "results",
    ].includes(state)
  )
    return;
  const game = new ReviewGame();
  const direction = (
    ["left", "right", "up", "down"].includes(p.get("direction") || "")
      ? p.get("direction")
      : "left"
  ) as Direction;
  game.attacks = Array.from({ length: TRIAL.attacks }, (_, i) =>
    i === 0
      ? direction
      : (["left", "right", "up", "down"] as Direction[])[i % 4],
  );
  game.schedule = attackSchedule(game.attacks, () => 0.5);
  const phases: Record<string, number> = {
    rest: 0.5,
    prepare: 1.9,
    dodge: 2.75,
    impact: 3.35,
    recover: 3.7,
  };
  const phase = phases[p.get("stage") || "prepare"] ?? 1.9;
  const slot = game.schedule[0];
  // Invert the shared phase mapping for stable, inspectable attack poses.
  const points = [
    [0, slot.start],
    [2.5, slot.impact - 1],
    [3.1, slot.impact - 0.4],
    [3.22, slot.bladeStart],
    [3.5, slot.impact],
    [5, slot.end],
  ];
  const end = points.findIndex(([v]) => v >= phase);
  const a = points[Math.max(0, end - 1)],
    b = points[end];
  game.time = a[1] + ((b[1] - a[1]) * (phase - a[0])) / (b[0] - a[0]);
  game.phase =
    state === "home"
      ? "home"
      : state === "tutorial"
        ? "tutorial"
        : state === "results"
          ? "results"
          : "trial";
  if (state === "tutorial") {
    game.time = 0;
    game.tutorialIndex = ["left", "right", "up", "down"].indexOf(direction);
  }
  if (state === "results") {
    game.time = TRIAL.seconds;
    game.hits = Math.max(
      0,
      Math.min(TRIAL.attacks, Math.floor(Number(p.get("score") ?? 19) || 0)),
    );
    game.best = Math.max(
      0,
      Math.min(game.hits, Math.floor(Number(p.get("combo") ?? 5) || 0)),
    );
  }
  if (p.get("feedback"))
    game.last = {
      index: 0,
      success: p.get("feedback") === "success",
      combo: 3,
      time: game.time - 0.2,
      direction,
    };
  game.paused = state === "paused" || state === "tracking-lost";
  game.wasPaused = game.paused;
  game.frozen = game.phase !== "tutorial";
  return {
    game,
    state,
    uiOnly: p.get("ui-only") === "1",
    tracking:
      state === "tracking-lost"
        ? "lost"
        : p.get("tracking") === "found"
          ? "found"
          : null,
  };
}
export function ReviewDock({ state }: { state: string }) {
  return (
    <nav className="review-dock" aria-label="開發審查 / UI REVIEW">
      <b>DEV / {state}</b>
      <select
        aria-label="審查狀態 / REVIEW STATE"
        value={state}
        onChange={(e) => {
          location.search = `?review=${e.target.value}`;
        }}
      >
        {[
          "home",
          "tutorial",
          "trial",
          "paused",
          "tracking-lost",
          "results",
        ].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <a href="/">退出 / EXIT</a>
    </nav>
  );
}
