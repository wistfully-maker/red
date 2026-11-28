async page => {
  const check=(value,message)=>{if(!value)throw new Error(message);};
  const go=async hash=>{
    await page.evaluate(value=>{location.hash=value;},hash);
    await page.waitForFunction(value=>location.hash===value&&
      document.body.dataset.display===(value.endsWith('/model')?'model':'terrain'),hash);
  };
  await page.setViewportSize({width:1440,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>sessionStorage.setItem('exhibition-music-choice-v2','off'));
  await page.goto('http://127.0.0.1:8873/?qa=scene-navigation-'+Date.now()+'#station/ruijin/model');
  await page.locator('#modelMuseum').waitFor({state:'visible',timeout:30000});
  await page.locator('#brandStage').waitFor({state:'hidden',timeout:60000});
  check(await page.locator('#nextStation').getAttribute('href')==='#station/yudu/model','Model next station lost its view');
  await page.locator('#nextStation').click({timeout:30000});
  await page.waitForFunction(()=>location.hash==='#station/yudu/model');
  await page.locator('#brandStage').waitFor({state:'hidden',timeout:60000});
  await page.locator('#modelMuseum').click({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#longmarchMuseum')?.dataset.ready==='true');
  check(await page.getByLabel('地点直达').inputValue()==='yudu','Museum opened the wrong station');
  await page.getByLabel('地点直达').selectOption('liping');
  await page.locator('.lm-scene-return').click({timeout:30000});
  await page.waitForFunction(()=>location.hash==='#station/liping/model');
  check(await page.locator('#longmarchMuseum').isVisible()===false,'Return did not close the museum');
  await page.getByRole('button',{name:'地形实景',exact:true}).click({timeout:30000});
  await page.waitForFunction(()=>document.body.dataset.display==='terrain');
  check(await page.locator('#terrainGesture').isVisible(),'Missing terrain gesture hint');
  check(await page.locator('#nextStation').getAttribute('href')==='#station/zunyi','Terrain next station changed to model');
  await page.locator('#nextStation').click({timeout:30000});
  await page.waitForFunction(()=>location.hash==='#station/zunyi');
  check(!await page.locator('#shotButton').isVisible(),'Zunyi dive action is still visible');
  await go('#station/luding');
  check(!await page.locator('#shotButton').isVisible(),'Luding bridgehead shortcut is still visible');
  check(!await page.locator('#historyToggle').isVisible(),'Luding history toggle is still visible');
  await page.locator('#toggleReader').click({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#longmarchMuseum')?.dataset.ready==='true');
  await page.locator('.lm-scene-return').click({timeout:30000});
  await page.waitForFunction(()=>location.hash==='#station/luding'&&!document.querySelector('#longmarchMuseum').open);
  const ids=await page.evaluate(()=>stations.map(s=>s.id));
  for(const id of ids){
    await go('#station/'+id);
    check(await page.locator('#terrainGesture').isVisible(),id+': terrain hint missing');
    await go('#station/'+id+'/model');
    check(await page.locator('#modelMuseum').isVisible(),id+': museum entry missing');
    const next=ids[ids.indexOf(id)+1];
    if(next)check(await page.locator('#nextStation').getAttribute('href')==='#station/'+next+'/model',id+': next model route');
  }
  await go('#station/ruijin');
  await page.waitForFunction(()=>document.querySelector('#sceneSub').textContent.includes('场景海拔'),null,{timeout:60000});
  await page.locator('#brandStage').waitFor({state:'hidden',timeout:60000});
  await page.screenshot({path:'output/playwright/scene-nav-terrain-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'output/playwright/scene-nav-terrain-phone.png'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  check(!overflow,'Phone viewport overflows');
  await go('#station/ruijin/model');
  await page.locator('#brandStage').waitFor({state:'hidden',timeout:60000});
  await page.locator('#modelMuseum').click({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#longmarchMuseum')?.dataset.ready==='true');
  await page.screenshot({path:'output/playwright/scene-nav-museum-phone.png'});
  const headerFits=await page.locator('.lm-header').evaluate(e=>e.scrollWidth<=e.clientWidth);
  check(headerFits,'Museum return header overflows on phone');
  await page.locator('.lm-scene-return').click({timeout:30000});
  await page.screenshot({path:'output/playwright/scene-nav-model-phone.png'});
  return {passed:true,stations:ids.length,modeContinuity:true,museumRoundTrip:true,
    allModelEntries:true,allTerrainHints:true,removedActions:true,mobileHeaderFits:headerFits};
}
