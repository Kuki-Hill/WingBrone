async page => {
 const report=[];
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:width===390?844:900});
  for(const score of [0,25]) {
   await page.goto(`http://127.0.0.1:5175/?review=results&score=${score}&combo=${score}`);
   await page.locator('.postcard img').waitFor();
   const ok=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,stats:document.querySelector('.result-stats')?.textContent}));
   if(ok.overflow) throw Error('Result extremes overflow');
   report.push({width,score,...ok});
   await page.screenshot({path:`captures/ui-review/edge-result-${score}-${width}.png`});
  }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:5174/');
 return report;
}
