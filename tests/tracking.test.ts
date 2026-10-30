import { describe, it, expect } from "vitest";
import { TrackingHealth } from "../src/tracking";
describe("tracking health", () => {
  it("does not call slow inference a missing face", () => {
    const h = new TrackingHealth();
    h.receive(true, 1000, 700);
    expect(h.state(1700)).toBe("tracking");
    h.receive(true, 1800, 800);
    expect(h.state(2400)).toBe("tracking");
  });
  it("pauses only after actual missing results persist", () => {
    const h = new TrackingHealth();
    h.receive(true, 1000);
    h.receive(false, 1100);
    expect(h.state(1400)).toBe("waiting");
    expect(h.state(1600)).toBe("missing");
  });
  it("recovers immediately when a face returns", () => {
    const h = new TrackingHealth();
    h.receive(false, 100);
    expect(h.state(700)).toBe("missing");
    h.receive(true, 800);
    expect(h.state(800)).toBe("tracking");
    expect(h.missingSince).toBe(null);
  });
  it("distinguishes a stalled worker and resets old state", () => {
    const h = new TrackingHealth();
    h.receive(true, 100, 100);
    expect(h.state(2000)).toBe("stalled");
    h.reset(2000);
    expect(h.state(2050)).toBe("waiting");
  });
});
