async (page) => {
  const results = [];
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [direction, stage] of [
      ["left", "dodge"],
      ["up", "prepare"],
      ["down", "impact"],
    ]) {
      await page.goto(
        `http://127.0.0.1:5175/?review=trial&direction=${direction}&stage=${stage}`,
      );
      await page.locator('main[data-scene-ready="true"]').waitFor();
      await page.waitForTimeout(900);
      await page.screenshot({
        path: `captures/ui-review/05-${direction}-${stage}-${width}.png`,
      });
      results.push({
        width,
        direction,
        stage,
        canvas: await page.locator("canvas").count(),
      });
      await page.keyboard.press(
        direction === "left"
          ? "ArrowLeft"
          : direction === "up"
            ? "ArrowUp"
            : "ArrowDown",
      );
    }
  }
  return results;
}
