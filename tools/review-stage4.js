async (page) => {
  const results = [];
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const state of ["paused", "tracking-lost", "results"]) {
      await page.goto(`http://127.0.0.1:5175/?review=${state}&score=19&combo=5`);
      await page.locator('main[data-scene-ready="true"]').waitFor();
      if (state === "results") await page.locator(".postcard img").waitFor();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `captures/ui-review/04-${state}-${width}.png`,
      });
      results.push({
        width,
        state,
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      });
      if (state === "paused") {
        await page.getByRole("button", { name: "倒數繼續 / RESUME →" }).click();
        await page.keyboard.press("Escape");
      }
      if (state === "tracking-lost") {
        results.push({
          width,
          resumeDisabled: await page
            .getByRole("button", { name: "倒數繼續 / RESUME →" })
            .isDisabled(),
        });
        await page
          .getByRole("button", { name: "改用方向鍵 / USE KEYBOARD" })
          .click();
        await page.getByRole("button", { name: "倒數繼續 / RESUME →" }).click();
        await page.keyboard.press("ArrowDown");
      }
      if (state === "results") {
        const download = page.waitForEvent("download");
        await page.getByRole("link", { name: "下載留念 / SAVE PNG ↓" }).click();
        results.push({ width, download: (await download).suggestedFilename() });
        await page.getByRole("button", { name: "再次試煉 / RETRY →" }).click();
        await page.keyboard.press("ArrowLeft");
      }
    }
  }
  return results;
}
