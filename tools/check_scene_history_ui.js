async page => {
  await page.setViewportSize({width:1000,height:760});
  await page.addInitScript(()=>sessionStorage.setItem('exhibition-music-choice-v2','off'));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:8873/?qa=scene-history-'+Date.now()+'#station/yudu/model');
  await page.waitForFunction(()=>document.body.dataset.display==='model'&&document.querySelector('#readerName').textContent==='于都');
  await page.evaluate(()=>{location.hash='#station/yudu/exhibit';});
  await page.waitForFunction(()=>document.querySelector('#longmarchMuseum')?.open&&document.querySelector('#longmarchMuseum').dataset.ready==='true');
  await page.locator('.lm-close').click({timeout:30000});
  await page.evaluate(()=>{location.hash='#station/xiangjiang/model';});
  await page.waitForFunction(()=>document.querySelector('#readerName').textContent==='湘江');
  await page.goBack();
  await page.waitForFunction(()=>location.hash==='#station/yudu/exhibit'&&document.querySelector('#longmarchMuseum').open);
  const mode=await page.evaluate(()=>document.body.dataset.display);
  if(mode!=='model')throw new Error('Back to the same exhibit history entry lost model mode: '+mode);
  await page.locator('.lm-scene-return').click({timeout:30000});
  await page.waitForFunction(()=>!document.querySelector('#longmarchMuseum').open);
  const hash=await page.evaluate(()=>location.hash);
  if(hash!=='#station/yudu/model')throw new Error('Museum return lost the historic scene: '+hash);
  return {passed:true,exhibitHistoryRetainsModel:true,museumReturnRetainsModel:true};
}
