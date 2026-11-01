import { describe, it, expect } from "vitest";
import { createUIReview } from "../src/uiReview";
import { Game } from "../src/game";

describe("isolated UI review fixtures", () => {
  it("ignores missing and unknown review routes", () => {
    expect(createUIReview("")).toBeUndefined();
    expect(createUIReview("?review=unknown")).toBeUndefined();
  });
  it("fixes a pose without advancing time, then accepts a real dodge", () => {
    const game = createUIReview(
      "?review=trial&stage=dodge&direction=right",
    )!.game;
    const time = game.time;
    expect(game.cycle).toBeCloseTo(2.75);
    game.tick(2);
    expect(game.time).toBe(time);
    expect(game.trigger("right")).toBe(true);
    game.tick(0.15);
    expect(game.position[0]).toBeGreaterThan(0);
    expect(new Game().phase).toBe("home");
  });
  it("clamps result samples and never creates a portrait", () => {
    const game = createUIReview("?review=results&score=15&combo=99")!.game;
    expect(game.hits).toBe(12);
    expect(game.best).toBe(12);
    expect(game.capture).toBeNull();
    expect(createUIReview("?review=results&score=-3")!.game.hits).toBe(0);
  });
  it("holds the loss fixture, and normal start clears fixture scores", () => {
    const review = createUIReview("?review=tracking-lost")!;
    const time = review.game.time;
    review.game.tick(30);
    expect(review.game.time).toBe(time);
    expect(review.tracking).toBe("lost");
    review.game.start();
    expect(review.game.phase).toBe("tutorial");
    expect(review.game.paused).toBe(false);
    expect(review.game.hits).toBe(0);
    expect(review.game.run).toBe(1);
  });
});
