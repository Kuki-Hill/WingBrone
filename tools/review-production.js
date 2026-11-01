async page => {
 const report=[];
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:5174/?review=results&score=25');
 await page.locator('main[data-scene-ready="true"]').waitFor();
 if(!await page.locator('main.state-home').isVisible() || await page.locator('.review-dock').count()) throw Error('Production enabled review mode');
 report.push({productionReviewIgnored:true});
 await page.goto('http://127.0.0.1:5174/');
 await page.locator('main[data-scene-ready="true"]').waitFor();
 await page.waitForTimeout(900);
 await page.screenshot({path:'docs/crt-review/home.png'});
 await page.getByRole('button',{name:'開始御風 / ENTER →'}).click();
 for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']) {await page.keyboard.press(key);await page.waitForTimeout(1000);}
 await page.locator('main.state-trial').waitFor();
 await page.waitForTimeout(3000);
 await page.screenshot({path:'docs/crt-review/gameplay.png'});
 report.push({productionKeyboardTrial:true});
 const denied=await page.context().newPage();
 await denied.addInitScript(()=> {navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('UI test: permission denied','NotAllowedError'));});
 await denied.goto('http://127.0.0.1:5174/');
 await denied.getByRole('button',{name:'01 / CAMERA 攝影機體感'}).click();
 await denied.locator('.error').waitFor();
 report.push({deniedPermissionFeedback:await denied.locator('.error').innerText()});
 await denied.getByRole('button',{name:'02 / KEYBOARD 方向鍵體驗'}).click();
 report.push({keyboardAfterDenied:await denied.locator('.error').count()===0});
 await denied.close();
 await page.bringToFront();
 return report;
}
