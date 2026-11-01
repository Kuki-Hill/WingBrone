async (page) => {
  const report = [];
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const state of [
      "home",
      "tutorial",
      "trial",
      "paused",
      "tracking-lost",
      "results",
    ]) {
      await page.goto(
        `http://127.0.0.1:5175/?review=${state}&stage=dodge&score=9&combo=5`,
      );
      await page.locator('main[data-scene-ready="true"]').waitFor();
      if (state === "results") await page.locator(".postcard img").waitFor();
      await page.waitForTimeout(900);
      await page.addStyleTag({
        content: ".review-dock{visibility:hidden!important}",
      });
      await page.screenshot({
        path: `captures/ui-review/06-${state}-${width}.png`,
      });
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        canvas: !!document.querySelector("canvas"),
        error: !!document.querySelector(".render-error"),
        safeText: document.querySelector(".strike-status")?.textContent,
      }));
      if (metrics.overflow || metrics.error)
        throw Error(`${state} ${width} failed layout checks`);
      report.push({ width, state, ...metrics });
    }
  }
  return report;
}
