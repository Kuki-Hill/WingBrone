async (page) => {
  const results = [];
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://127.0.0.1:5175/?review=home");
    await page
      .getByRole("button", { name: "開始御風 / ENTER →" })
      .waitFor({ state: "visible" });
    await page.locator('main[data-scene-ready="true"]').waitFor();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `captures/ui-review/01-home-${width}.png` });
    results.push(
      await page.evaluate(() => ({
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
        button: document
          .querySelector(".intro > .primary")
          ?.getBoundingClientRect()
          .toJSON(),
        canvas: !!document.querySelector("canvas"),
      })),
    );
    await page
      .getByRole("button", { name: "02 / KEYBOARD 方向鍵體驗" })
      .click();
    await page.getByRole("button", { name: "開始御風 / ENTER →" }).click();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(1050);
    results.push({
      width,
      tutorial: await page.locator(".direction-signal").innerText(),
    });
  }
  return results;
}
