async (page) => {
  const results = [];
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const state of ["home", "trial"]) {
      await page.goto(
        `http://127.0.0.1:5175/?review=${state}&tracking=found&stage=dodge`,
      );
      await page.locator('main[data-scene-ready="true"]').waitFor();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `captures/ui-review/03-camera-${state}-${width}.png`,
      });
      const toggle = page.getByRole("button", { name: "● 識別成功 / LOCKED" });
      await toggle.click();
      results.push({
        width,
        state,
        expanded: await toggle.getAttribute("aria-expanded"),
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      });
      await toggle.click();
    }
    await page.keyboard.press("ArrowLeft");
  }
  return results;
}
