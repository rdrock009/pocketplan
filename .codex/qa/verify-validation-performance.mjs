import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import serverlessChromium from '/tmp/my-month-browser/node_modules/@sparticuz/chromium/build/index.js'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4191', '--strictPort'])
let browser
try {
 await new Promise((resolve,reject) => { server.stdout.on('data', data => { if(data.toString().includes('4191')) resolve() }); server.once('exit',code=>reject(new Error(`Server exited ${code}`))); setTimeout(()=>reject(new Error('Startup timeout')),10000).unref() })
 browser = await chromium.launch({executablePath:'/tmp/my-month-chromium/chromium',headless:true,args:serverlessChromium.args,env:{...process.env,LD_LIBRARY_PATH:'/tmp/my-month-chromium:/tmp/my-month-chromium/lib',FONTCONFIG_PATH:'/tmp/my-month-chromium/fonts'}})
 const page=await browser.newPage()
 const errors=[],results=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
 const cdp=await page.context().newCDPSession(page)
 await cdp.send('Network.enable')
 await cdp.send('Network.setCacheDisabled',{cacheDisabled:true})
 let requests=new Map()
 cdp.on('Network.responseReceived',e=>requests.set(e.requestId,{name:e.response.url.split('/').at(-1),diskCache:e.response.fromDiskCache??false,serviceWorker:e.response.fromServiceWorker??false,encoding:e.response.headers['Content-Encoding']??null}))
 cdp.on('Network.loadingFinished',e=>{if(requests.has(e.requestId))requests.get(e.requestId).wireBytes=e.encodedDataLength})
 await page.addInitScript(()=>{
  window.labMetrics={lcp:0,cls:0,longTasks:[],events:[],frames:[]}
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.labMetrics.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})
  let sessionStart=0,lastShift=0,sessionValue=0
  new PerformanceObserver(list=>{for(const e of list.getEntries()){if(e.hadRecentInput)continue;if(e.startTime-lastShift>1000||e.startTime-sessionStart>5000){sessionStart=e.startTime;sessionValue=0}sessionValue+=e.value;lastShift=e.startTime;window.labMetrics.cls=Math.max(window.labMetrics.cls,sessionValue)}}).observe({type:'layout-shift',buffered:true})
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.labMetrics.longTasks.push({start:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true})
  new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.interactionId)window.labMetrics.events.push({name:e.name,duration:e.duration,interactionId:e.interactionId})}).observe({type:'event',buffered:true,durationThreshold:16})
  document.addEventListener('click',()=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>window.labMetrics.frames.push(performance.now()-start)))},true)
 })
 const perf=[]
 for(const profile of [{name:'desktop',viewport:{width:1365,height:1000},cpu:1,latency:0,download:-1,upload:-1},{name:'mobile',viewport:{width:390,height:844},cpu:4,latency:150,download:200000,upload:93750}]){
  await page.setViewportSize(profile.viewport)
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu})
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:profile.latency,downloadThroughput:profile.download,uploadThroughput:profile.upload})
  for(let run=1;run<=3;run++){
   if(page.url().startsWith('http://127.0.0.1:4191'))await page.evaluate(()=>localStorage.clear())
   await page.goto('about:blank');await cdp.send('Network.clearBrowserCache');requests=new Map()
   await page.goto('http://127.0.0.1:4191/',{waitUntil:'networkidle'})
   await page.waitForTimeout(250)
   const load=await page.evaluate(()=>({fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,lcp:window.labMetrics.lcp,cls:window.labMetrics.cls,longTasks:window.labMetrics.longTasks,resources:performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').at(-1),transfer:e.transferSize,decoded:e.decodedBodySize})),nav:performance.getEntriesByType('navigation')[0].toJSON()}))
   await page.getByRole('button',{name:'What If',exact:true}).click()
   await page.getByLabel('Scenario name',{exact:true}).fill('Performance check');await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('500');await page.getByRole('button',{name:'Preview decision',exact:true}).click();await page.getByRole('button',{name:'Apply decision',exact:true}).click();await page.getByRole('button',{name:'Undo last decision',exact:true}).click();await page.waitForTimeout(100)
   const interactions=await page.evaluate(()=>({maxEventDuration:Math.max(0,...window.labMetrics.events.map(e=>e.duration)),maxClickToSecondFrame:Math.max(0,...window.labMetrics.frames),cls:window.labMetrics.cls,longTasks:window.labMetrics.longTasks}))
   perf.push({profile:profile.name,run,settings:profile,load,network:[...requests.values()],interactions})
  }
 }
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4191/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Reset sample',exact:true}).click()
 const key='budget-lab:workspace'
 const baseline=await page.evaluate(key=>localStorage.getItem(key),key)
 async function unchanged(){assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),baseline);assert.equal(await page.getByTestId('cash-balance').textContent(),'₹9,950.00')}
 const name=page.getByLabel('Name',{exact:true}),amount=page.getByLabel('Amount (₹)',{exact:true}),date=page.getByLabel('Transaction date',{exact:true})
 await page.getByRole('button',{name:'Add expense',exact:true}).click();assert.equal(await name.evaluate(n=>document.activeElement===n),true);await unchanged()
 await name.fill('Validation check');await amount.fill('1.001');await page.getByRole('button',{name:'Add expense',exact:true}).click();assert.equal(await amount.evaluate(n=>n.validity.patternMismatch),true);assert.equal(await amount.evaluate(n=>n===document.activeElement),true);await unchanged()
 await amount.fill('abc');await page.getByRole('button',{name:'Add expense',exact:true}).click();await unchanged()
 await amount.fill('100');await date.fill('2026-10-31');await page.getByRole('button',{name:'Add expense',exact:true}).click();assert.equal(await date.evaluate(n=>n.validity.rangeOverflow),true);await unchanged()
 await date.fill('2026-09-30');await page.getByRole('button',{name:'Add expense',exact:true}).click();assert.equal(await date.evaluate(n=>n.validity.rangeUnderflow),true);await unchanged()
 await date.fill('2026-10-07');await amount.fill('0');await page.getByRole('button',{name:'Add expense',exact:true}).click();await page.getByRole('alert').waitFor();await unchanged()
 await amount.fill('999999999999999999');await page.getByRole('button',{name:'Add expense',exact:true}).click();await page.getByRole('alert').waitFor();await unchanged()
 await name.fill('   ');await amount.fill('100');await page.getByRole('button',{name:'Add expense',exact:true}).click();await page.getByRole('alert').waitFor();await unchanged()
 assert.equal(await page.locator('dialog,[role="dialog"],[aria-modal="true"]').count(),0)
 await page.getByRole('button',{name:'What If',exact:true}).click();await page.getByLabel('Scenario name',{exact:true}).fill('Invalid decision');await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('0');await page.getByRole('button',{name:'Preview decision',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'Apply decision',exact:true}).isDisabled(),true);await unchanged()
 const focus=await page.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.textContent,visible:document.activeElement?.getBoundingClientRect().width>0}))
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({browser:browser.version(),performance:perf,validation:'passed: required, decimal, text, zero, whitespace, unsafe integer, min/max date',validationErrorFocus:focus,dialogs:'none; focus trapping and restoration not applicable',runtimeErrors:errors},null,2))
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
