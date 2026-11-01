async (page) => {
  // Run with update=false for comparison. See docs/ui-review/README.md to approve a new baseline.
  const update = false;
  const report = [];
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [name, query, selector] of [
      ["hud", "trial&stage=dodge", ".combat-timing"],
      ["camera", "home&tracking=found", ".camera-preview"],
      ["paused", "paused", ".panel"],
      ["results", "results&score=9&combo=5", ".results"],
    ]) {
      await page.goto(`http://127.0.0.1:5175/?review=${query}`);
      await page.locator('main[data-scene-ready="true"]').waitFor();
      if (name === "results") await page.locator(".postcard img").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content:
          "main>div:first-child{visibility:hidden!important}.review-dock{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}",
      });
      await page.mouse.move(0, 0);
      await page.waitForTimeout(150);
      const filename = `${name}-${width}.png`;
      const target = page.locator(selector);
      if (update) {
        await target.screenshot({
          path: `docs/ui-review/baselines/${filename}`,
        });
        report.push({ filename, created: true });
      } else {
        const expected = await page.request.get(
          `http://127.0.0.1:5175/docs/ui-review/baselines/${filename}`,
        );
        if (!expected.ok()) throw Error(`Missing baseline ${filename}`);
        const actual = await target.screenshot();
        const match = actual.equals(await expected.body());
        report.push({ filename, match });
        if (!match) {
          await target.screenshot({
            path: `captures/ui-review/diff-${filename}`,
          });
          throw Error(
            `Baseline changed: ${filename}. Inspect captures/ui-review/diff-${filename}`,
          );
        }
      }
    }
  }
  return report;
}
