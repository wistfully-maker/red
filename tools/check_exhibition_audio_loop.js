async page => {
  const check = (value, message) => { if (!value) throw new Error(message); };
  await page.goto('http://127.0.0.1:8873/output/playwright/exhibition-audio-check.html');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  const untouched = await page.evaluate(() => window.audioController.getState());
  check(!untouched.hasSource, 'Music must wait for consent');
  await page.getByRole('button', {name:'允许', exact:true}).click();
  await page.waitForFunction(() => window.audioController.getState().status === 'playing');
  // The preview server has no HTTP Range support. Use the entire original MP3
  // as a local blob so seeking genuinely reaches its tail instead of restarting.
  await page.evaluate(async () => {
    const audio = document.querySelector('audio');
    window.loopTestBlob = URL.createObjectURL(await (await fetch(audio.src)).blob());
    audio.src = window.loopTestBlob;
    await audio.play();
  });
  await page.waitForFunction(() => document.querySelector('audio').readyState === 4);
  const duration = await page.evaluate(() => document.querySelector('audio').duration);
  const seekToTail = async () => {
    const time = await page.evaluate(async () => {
      const audio = document.querySelector('audio');
      const seeked = new Promise(resolve => audio.addEventListener('seeked', resolve, {once:true}));
      audio.currentTime = audio.duration - 1;
      await seeked;
      return audio.currentTime;
    });
    check(time > duration - 2, 'Must actually reach the media tail');
  };
  for (let cycle = 0; cycle < 3; cycle++) {
    await seekToTail();
    await page.waitForFunction(() => {
      const state = window.audioController.getState();
      return state.time < 3 && !state.paused && state.status === 'playing';
    }, null, {timeout:7000});
  }
  // Exercise a real media end, as can happen when native looping is lost.
  await page.evaluate(() => { document.querySelector('audio').loop = false; });
  await seekToTail();
  await page.waitForFunction(() => {
    const audio = document.querySelector('audio');
    const state = window.audioController.getState();
    return audio.loop && state.time < 3 && !state.paused && state.status === 'playing';
  }, null, {timeout:7000});
  await page.getByRole('button', {name:'暂停展馆音乐', exact:true}).click();
  await page.waitForFunction(() => window.audioController.getState().status === 'muted');
  await page.evaluate(() => document.querySelector('audio').dispatchEvent(new Event('ended')));
  const stopped = await page.evaluate(() => window.audioController.getState());
  check(stopped.paused && stopped.choice === 'off', 'Ended must respect an explicit pause');
  await page.getByRole('button', {name:'播放展馆音乐', exact:true}).click();
  await page.waitForFunction(() => window.audioController.getState().status === 'playing');
  await page.evaluate(() => window.audioController.destroy());
  check(await page.locator('audio').count() === 0, 'Destroy must remove the playback element');
  await page.evaluate(() => URL.revokeObjectURL(window.loopTestBlob));
  return {passed:true, duration, nativeLoops:3, endedRecovery:true,
    consent:true, explicitPause:true, destroy:true};
}
