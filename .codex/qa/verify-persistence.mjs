import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import serverlessChromium from '/tmp/my-month-browser/node_modules/@sparticuz/chromium/build/index.js'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4188', '--strictPort'])
let browser
try {
 await new Promise((resolve,reject) => { server.stdout.on('data', data => { if(data.toString().includes('4188')) resolve() }); server.once('exit',code=>reject(new Error(`Server exited ${code}`))); setTimeout(()=>reject(new Error('Startup timeout')),10000).unref() })
 browser = await chromium.launch({executablePath:'/tmp/my-month-chromium/chromium',headless:true,args:serverlessChromium.args,env:{...process.env,LD_LIBRARY_PATH:'/tmp/my-month-chromium:/tmp/my-month-chromium/lib',FONTCONFIG_PATH:'/tmp/my-month-chromium/fonts'}})
 const page=await browser.newPage()
 const errors=[],results=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
 const key='budget-lab:workspace',backup='budget-lab:workspace:backup'
 const button=name=>page.getByRole('button',{name,exact:true})
 async function metric(id,text){await page.waitForFunction(({id,text})=>document.querySelector(`[data-testid="${id}"]`)?.textContent===text,{id,text},{timeout:3000})}
 async function savedCash(paise){await page.waitForFunction(({key,paise})=>{const stored=JSON.parse(localStorage.getItem(key));return stored?.workspace?.month?.plan?.expenses?.some(item=>item.amount===paise)},{key,paise},{timeout:3000})}
 async function accessible(){await page.addScriptTag({path:'/tmp/my-month-browser/node_modules/axe-core/axe.min.js'});const violations=await page.evaluate(async()=> (await axe.run(document)).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[],JSON.stringify(violations));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
 const external=[];page.on('request',req=>{if(!req.url().startsWith('http://127.0.0.1:4188/'))external.push(req.url())})
 for(const viewport of [{width:1365,height:1000},{width:390,height:844}]) {
  await page.setViewportSize(viewport)
  await page.goto('http://127.0.0.1:4188/',{waitUntil:'networkidle'})
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle'})
  await page.getByLabel('Name',{exact:true}).fill('Persistent lunch');await page.getByLabel('Amount (₹)',{exact:true}).fill('100.01');await button('Add expense').click()
  await savedCash(10001);await metric('cash-balance','₹9,849.99')
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).workspace,key)
  await page.reload({waitUntil:'networkidle'});await metric('cash-balance','₹9,849.99')
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).workspace,key)
  assert.deepEqual(after,before,'All financial data survives refresh')
  await page.context().setOffline(true)
  await button('What If').click();await page.getByLabel('Scenario name',{exact:true}).fill('Offline purchase');await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('500');await button('Preview decision').click()
  const previewSaved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).workspace,key)
  assert.deepEqual(previewSaved,before,'Preview must not be persisted')
  await page.context().setOffline(false);await page.reload({waitUntil:'networkidle'})
  await button('What If').click();assert.equal(await button('Apply decision').isDisabled(),true)
  await page.getByLabel('Scenario name',{exact:true}).fill('Committed headphones');await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('500');await button('Preview decision').click();await button('Apply decision').dblclick();await metric('whatif-current-cash','₹9,349.99');await savedCash(50000)
  await page.reload({waitUntil:'networkidle'});await metric('cash-balance','₹9,349.99');await button('What If').click();assert.equal(await button('Undo last decision').isEnabled(),true)
  await button('Undo last decision').click();await metric('cash-balance','₹9,849.99')
  await page.reload({waitUntil:'networkidle'});await metric('cash-balance','₹9,849.99')
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).workspace.consumedScenarioIds.length,key),1)
  await page.evaluate(key=>localStorage.setItem(key,'corrupt primary'),key);await page.reload({waitUntil:'networkidle'});await metric('cash-balance','₹9,849.99');await page.getByText(/Recovered the last valid backup/).waitFor();await accessible()
  await button('Reset sample').click();await page.reload({waitUntil:'networkidle'});await metric('cash-balance','₹9,950.00')
  assert.equal(await page.getByText('Persistent lunch',{exact:true}).count(),0)
  await page.getByLabel('New month start',{exact:true}).fill('2026-11-01');await button('Start fresh').click();await page.reload({waitUntil:'networkidle'});await metric('cash-balance','₹10,000.00');await metric('days-remaining','30 days left')
  assert.equal(await page.getByText('Your fresh month',{exact:true}).count(),1)
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).workspace.month.plan.startDate,key),'2026-11-01')
  await page.evaluate(({key,backup})=>{localStorage.setItem(key,'bad json');localStorage.setItem(backup,'bad backup')},{key,backup});await page.reload({waitUntil:'networkidle'})
  await page.getByText(/Saved data is damaged/).waitFor();await metric('cash-balance','₹9,950.00');assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'bad json');await accessible()
  await button('Start fresh').click();await page.reload({waitUntil:'networkidle'});await metric('cash-balance','₹10,000.00')
  await page.evaluate(({key,backup})=>{localStorage.setItem(key,JSON.stringify({version:999,workspace:{}}));localStorage.removeItem(backup)},{key,backup});await page.reload({waitUntil:'networkidle'})
  await page.getByText(/Saved data is damaged/).waitFor();assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).version,key),999)
  await button('Reset sample').click();await page.reload({waitUntil:'networkidle'});await metric('cash-balance','₹9,950.00');await accessible()
  results.push({viewport,refresh:'passed',previewIsolation:'passed',applyUndoRefresh:'passed',resetFreshRefresh:'passed',corruptRecovery:'passed',unsupportedVersion:'passed',offlineControls:'passed',axeViolations:0})
 }
 await page.addInitScript(()=>{if(location.search.includes('blocked'))Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable')}})})
 await page.goto('http://127.0.0.1:4188/?blocked',{waitUntil:'networkidle'})
 await page.getByText(/Could not save on this device/).waitFor();await page.getByLabel('Name',{exact:true}).fill('Still functional');await page.getByLabel('Amount (₹)',{exact:true}).fill('100');await button('Add expense').click();await metric('cash-balance','₹9,850.00');await accessible()
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
 console.log(JSON.stringify({results,blockedStorage:'functional',externalRequests:0,runtimeErrors:errors},null,2))
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
