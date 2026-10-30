// A slow inference is not evidence of an absent face. Track actual negative
// results separately from a pipeline that stopped responding.
export class TrackingHealth {
  lastResult = 0;
  missingSince: number | null = null;
  found = false;
  inferenceMs = 100;
  reset(now: number) {
    this.lastResult = now;
    this.missingSince = null;
    this.found = false;
  }
  receive(found: boolean, now: number, duration = 100) {
    this.lastResult = now;
    this.found = found;
    this.inferenceMs = Math.max(10, duration);
    if (found) this.missingSince = null;
    else if (this.missingSince === null) this.missingSince = now;
  }
  state(now: number): "tracking" | "missing" | "waiting" | "stalled" {
    if (now - this.lastResult > Math.max(1800, this.inferenceMs * 3))
      return "stalled";
    if (this.found) return "tracking";
    if (this.missingSince !== null && now - this.missingSince >= 500)
      return "missing";
    return "waiting";
  }
}
