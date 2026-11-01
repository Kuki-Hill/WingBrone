async page => {
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:5175/?review=results&score=19&combo=8&theme=crt&ui-only=1');
 await page.locator('.postcard img').waitFor();
 const png=page.waitForEvent('download');await page.getByRole('link',{name:'下載留念 / SAVE PNG ↓'}).click();
 await (await png).saveAs('docs/crt-review/share-card.png');
 await page.screenshot({path:'docs/crt-review/results.png'});
 const imageTest=await page.evaluate(async()=>{
  const {postcard}=await import('/src/keepsake.ts');
  const source=document.createElement('canvas');source.width=400;source.height=300;
  const s=source.getContext('2d');s.fillStyle='#D04020';s.fillRect(0,0,400,300);s.fillStyle='#208040';s.fillRect(0,150,400,150);
  const blob=await postcard(source,{combo:3,hits:19,best:8},'crt');const image=await createImageBitmap(blob);
  const out=document.createElement('canvas');out.width=image.width;out.height=image.height;const c=out.getContext('2d');c.drawImage(image,0,0);
  const top=[...c.getImageData(640,200,1,1).data],bottom=[...c.getImageData(640,600,1,1).data],margin=[...c.getImageData(100,400,1,1).data];
  image.close();if(out.width!==1280||out.height!==1000||top[0]<180||bottom[1]<100||margin[0]>10)throw Error('Portrait geometry or output failed');
  return {width:out.width,height:out.height,syntheticPortraitContained:true,top,bottom,margin};
 });
 await page.goto('http://127.0.0.1:5174/?theme=crt');await page.locator('main[data-scene-ready="true"]').waitFor();await page.waitForTimeout(700);await page.screenshot({path:'docs/crt-review/home.png'});
 return imageTest;
}
