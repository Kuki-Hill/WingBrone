async (page) => {
  const checks = [];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5175/");
  await page.locator('main[data-scene-ready="true"]').waitFor();
  await page.getByRole("button", { name: "開始御風 / ENTER →" }).click();
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(1050);
  }
  if (!(await page.locator("main.state-trial").isVisible()))
    throw Error("Practice did not reach trial");
  let dodged = 0,
    last = "";
  const end = Date.now() + 14000;
  while (Date.now() < end) {
    const cue = page.locator(".combat-timing.dodge");
    if (await cue.count()) {
      const index = await cue.locator(".strike-code").innerText();
      if (index !== last) {
        last = index;
        const text = await cue.locator(".strike-direction").innerText();
        await page.keyboard.press(
          text.includes("LEFT")
            ? "ArrowLeft"
            : text.includes("RIGHT")
              ? "ArrowRight"
              : text.includes("UP")
                ? "ArrowUp"
                : "ArrowDown",
        );
        dodged++;
      }
    }
    await page.waitForTimeout(65);
  }
  checks.push({
    practice: "four directions completed",
    trialDodges: dodged,
    score: await page.locator(".score").innerText(),
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "倒數繼續 / RESUME →" }).waitFor();
  await page.keyboard.press("Shift+Tab");
  checks.push({
    focusWithinModal: await page.evaluate(
      () =>
        !!document
          .querySelector(".pause-screen")
          ?.contains(document.activeElement),
    ),
  });
  await page.getByRole("button", { name: "倒數繼續 / RESUME →" }).click();
  await page.waitForTimeout(3300);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "結束並返回 / EXIT" }).click();
  await page.getByRole("checkbox", { name: "低畫質 / LOW" }).check();
  await page.getByRole("checkbox", { name: "減弱動態 / CALM" }).check();
  checks.push({
    returnedHome: await page.locator(".intro").isVisible(),
    low: await page.getByRole("checkbox", { name: "低畫質 / LOW" }).isChecked(),
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  checks.push({
    systemReducedMotion: await page
      .getByRole("checkbox", { name: "減弱動態 / CALM" })
      .isChecked(),
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return checks;
}
