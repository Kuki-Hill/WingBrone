async (page) => {
  // Run with update=false for comparison. See docs/crt-review/README.md to approve a new baseline.
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
      ["results", "results&score=19&combo=5", ".results"],
    ]) {
      await page.goto(`http://127.0.0.1:5175/?review=${query}&theme=crt&ui-only=1`, {waitUntil:"domcontentloaded"});
      await page.locator('main[data-scene-ready="true"]').waitFor();
      if (name === "results") await page.locator(".postcard img").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content:
          "main>div:first-child{visibility:hidden!important}.review-dock{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}",
      });
      await page.mouse.move(0, 0);
      await page.evaluate(() => { const el = document.activeElement; if(el instanceof HTMLElement) el.blur(); });
      await page.waitForTimeout(150);
      const filename = `${name}-${width}.png`;
      const target = page.locator(selector);
      if (update) {
        await target.screenshot({
          path: `docs/crt-review/baselines/${filename}`,
        });
        report.push({ filename, created: true });
      } else {
        const expected = await page.request.get(
          `http://127.0.0.1:5175/docs/crt-review/baselines/${filename}`,
        );
        if (!expected.ok()) throw Error(`Missing baseline ${filename}`);
        const actual = await target.screenshot();
        const difference = await page.evaluate(async ({actual, expected}) => {
          const read = async (data) => {
            const image = new Image(); image.src = 'data:image/png;base64,'+data; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
            const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0);
            return {width:image.width,height:image.height,pixels:ctx.getImageData(0,0,image.width,image.height).data};
          };
          const a=await read(actual), b=await read(expected);
          if(a.width!==b.width || a.height!==b.height)return -1;
          let changed=0;
          for(let i=0;i<a.pixels.length;i+=4)if(Math.max(Math.abs(a.pixels[i]-b.pixels[i]),Math.abs(a.pixels[i+1]-b.pixels[i+1]),Math.abs(a.pixels[i+2]-b.pixels[i+2]),Math.abs(a.pixels[i+3]-b.pixels[i+3]))>2)changed++;
          return changed;
        }, {actual:actual.toString('base64'),expected:(await expected.body()).toString('base64')});
        const match = difference === 0;
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
