async (page) => {
  const results = [];
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const state of ["tutorial", "trial"]) {
      await page.goto(
        `http://127.0.0.1:5175/?review=${state}&stage=dodge&direction=left`,
      );
      await page
        .locator(state === "trial" ? ".combat-timing" : ".practice")
        .waitFor();
      await page.locator('main[data-scene-ready="true"]').waitFor();
      await page.waitForTimeout(900);
      await page.screenshot({
        path: `captures/ui-review/02-${state}-${width}.png`,
      });
      results.push({
        width,
        state,
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      });
    }
    await page.getByRole("button", { name: "暫停 / PAUSE ↗" }).click();
    await page.getByRole("button", { name: "倒數繼續 / RESUME →" }).click();
    await page.keyboard.press("Escape");
    results.push({ width, paused: await page.locator(".panel").isVisible() });
  }
  return results;
}
