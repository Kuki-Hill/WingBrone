import { describe, it, expect } from "vitest";
import { verdict } from "../src/verdict";
describe("score-based roast", () => {
  it.each([
    [0, "剑气指定签收人"],
    [6, "剑气指定签收人"],
    [7, "御剑考驾照未遂"],
    [13, "半步宗师，半脸签收"],
    [19, "剑气的已读不回"],
    [25, "闪避外挂疑似成精"],
  ])("score %s produces the correct tier", (score, title) => {
    expect(verdict(Number(score)).title).toBe(title);
  });
  it("uses scores only and is reproducible", () => {
    expect(verdict(8)).toEqual(verdict(8));
    expect(verdict(-1)).toEqual(verdict(0));
    expect(verdict(30)).toEqual(verdict(25));
  });
});
