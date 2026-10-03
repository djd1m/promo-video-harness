import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startHiDpiRecording} from '../../promo/capture/hidpi-recorder.mjs';
import {pathToFileURL} from 'node:url';
const config=(await import(process.argv[3] ? pathToFileURL(process.argv[3]).href : './config.mjs')).default;
// Pinned global installation from the existing render image; never npx/download.
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const version = require('playwright/package.json').version;
if (version !== '1.60.0') throw Error(`Expected Playwright 1.60.0; got ${version}`);
const out=process.argv[2];
if (!out) throw Error('Output directory required');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const runStart=Date.now(), events=[];
const seconds=()=>Number(((Date.now()-runStart)/1000).toFixed(3));
try {
  for (const [layout,[width,height]] of Object.entries(config.capture.formats)) {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();
    // Only the owned file UI is allowed; no host port or provider/network traffic.
    await page.route('**/*',route=>route.request().url().startsWith('file:') ? route.continue() : route.abort());
    await page.goto(new URL('./index.html',import.meta.url).href);
    const file=`demo-${layout}.webm`, start=seconds();
    const recorder=await startHiDpiRecording(page,path.join(out,file),{width,height,fps:config.capture.fps});
    events.push({event:'video.start',file,layout,t_s:start});
    for (const [target,selector,event] of [[1,'#collect','idea.collected'],[12,'#choose','focus.chosen'],[23,'#finish','progress.completed']]) {
      const delay=target-(seconds()-start);
      if(delay>0) await page.waitForTimeout(delay*1000);
      await page.click(selector);
      const t_s=seconds(); events.push({event,file,t_s,t_file_s:Number((t_s-start).toFixed(3))});
    }
    const delay=config.capture.seconds-(seconds()-start);
    if(delay>0) await page.waitForTimeout(delay*1000);
    const stats=await recorder.stop();
    events.push({event:'video.saved',file,layout,t_s:seconds(),ok:true,stats});
    fs.writeFileSync(path.join(out,'record-log-demo.json'),JSON.stringify({events,api:{demo_sessions:0,commands:0,non_2xx:[]}},null,2));
    await context.close();
  }
} finally { await browser.close(); }
