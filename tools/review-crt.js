async page => {
 const report=[];
 for(const [width,height] of [[1440,900],[1280,720],[390,844]]) {
  await page.setViewportSize({width,height});
  for(const state of ['home','results','paused','trial']) {
   await page.goto(`http://127.0.0.1:5175/?review=${state}&stage=dodge&score=19&combo=8&theme=crt`);
   await page.locator('main[data-scene-ready="true"]').waitFor();
   if(state==='results')await page.locator('.postcard img').waitFor();
   await page.waitForTimeout(700);
   await page.addStyleTag({content:'.review-dock{visibility:hidden!important}'});
   await page.screenshot({path:`captures/crt-review/${state}-${width}.png`});
   report.push(await page.evaluate(({width,state})=>({width,state,overflow:document.documentElement.scrollWidth>innerWidth,primary:document.querySelector('.intro>.primary')?.getBoundingClientRect().toJSON()}),{width,state}));
   if(state==='home') {
    await page.getByRole('combobox',{name:'顯示風格 / DISPLAY STYLE'}).selectOption('classic');
    if(!await page.locator('.theme-classic').count())throw Error('Classic rollback failed');
    await page.waitForTimeout(200);
    await page.screenshot({path:`captures/crt-review/classic-home-${width}.png`});
    await page.getByRole('combobox',{name:'顯示風格 / DISPLAY STYLE'}).selectOption('crt');
   }
   if(state==='results') {
    const before=await page.locator('.postcard img').getAttribute('src');
    await page.getByRole('button',{name:'切回原版 / CLASSIC'}).click();
    await page.waitForFunction(old=>document.querySelector('.postcard img')?.getAttribute('src')!==old,before);
    await page.waitForTimeout(200);
    await page.screenshot({path:`captures/crt-review/classic-results-${width}.png`});
    await page.getByRole('button',{name:'CRT 樣式 / CRT',exact:true}).click();
    const download=page.waitForEvent('download');
    await page.getByRole('link',{name:'下載留念 / SAVE PNG ↓'}).click();
    report.push({width,download:(await download).suggestedFilename()});
   }
  }
 }
 return report;
}
