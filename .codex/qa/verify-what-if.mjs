import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import serverlessChromium from '/tmp/my-month-browser/node_modules/@sparticuz/chromium/build/index.js'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4187', '--strictPort'])
let browser
try {
 await new Promise((resolve,reject) => { server.stdout.on('data', data => { if(data.toString().includes('4187')) resolve() }); server.once('exit',code=>reject(new Error(`Server exited ${code}`))); setTimeout(()=>reject(new Error('Startup timeout')),10000).unref() })
 browser = await chromium.launch({executablePath:'/tmp/my-month-chromium/chromium',headless:true,args:serverlessChromium.args,env:{...process.env,LD_LIBRARY_PATH:'/tmp/my-month-chromium:/tmp/my-month-chromium/lib',FONTCONFIG_PATH:'/tmp/my-month-chromium/fonts'}})
 const page=await browser.newPage()
 const errors=[],results=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
 for(const viewport of [{width:1365,height:1000},{width:390,height:844}]) {
  await page.setViewportSize(viewport)
  const response=await page.goto('http://127.0.0.1:4187/',{waitUntil:'networkidle'})
  assert.equal(response.status(),200)
  const button=name=>page.getByRole('button',{name,exact:true})
  async function metric(id,text){await page.waitForFunction(({id,text})=>document.querySelector(`[data-testid="${id}"]`)?.textContent===text,{id,text},{timeout:3000})}
  await button('What If').click()
  await page.getByLabel('Scenario name',{exact:true}).fill('Headphones')
  await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('500')
  await button('Preview decision').click()
  await metric('whatif-current-cash','₹9,950.00');await metric('whatif-proposed-cash','₹9,450.00');await metric('whatif-proposed-closing','₹3,301.00')
  await page.screenshot({path:`.codex/qa/what-if-${viewport.width>700?'desktop':'mobile'}.png`,fullPage:true})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Page overflow')
  await page.addScriptTag({path:'/tmp/my-month-browser/node_modules/axe-core/axe.min.js'})
  async function axeCheck(){const violations=await page.evaluate(async()=> (await axe.run(document)).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[],JSON.stringify(violations))}
  await axeCheck()
  await button('Apply decision').dblclick()
  await metric('whatif-current-cash','₹9,450.00');assert.equal(await button('Apply decision').isDisabled(),true)
  await button('My Month').click();assert.equal(await page.getByText('Headphones',{exact:true}).count(),1)
  await metric('cash-balance','₹9,450.00')
  await button('What If').click();await button('Undo last decision').click();await metric('cash-balance','₹9,950.00')
  await page.getByLabel('Scenario type').selectOption('emergency')
  await page.getByLabel('Scenario name',{exact:true}).fill('Urgent repair');await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('12000')
  await button('Preview decision').click();await metric('whatif-proposed-cash','−₹2,050.00');await axeCheck()
  await button('Discard preview').click();await metric('cash-balance','₹9,950.00')
  await page.getByLabel('Scenario type').selectOption('income')
  await page.getByLabel('Scenario name',{exact:true}).fill('Extra work');await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('1000')
  await button('Preview decision').click();await metric('whatif-proposed-cash','₹10,950.00');await button('Apply decision').click();await button('Undo last decision').click()
  await page.getByLabel('Scenario income status').selectOption('planned');await page.getByLabel('Scenario date',{exact:true}).fill('2026-10-20')
  await button('Preview decision').click();await metric('whatif-proposed-income','₹3,000.00');await metric('whatif-proposed-cash','₹9,950.00')
  await button('Apply decision').click();await button('Undo last decision').click()
  await page.getByLabel('Scenario type').selectOption('cancel-subscription');await button('Preview decision').click();await metric('whatif-proposed-bills','₹3,500.00');await axeCheck();await button('Apply decision').click();await button('Undo last decision').click()
  await page.getByLabel('Scenario type').selectOption('savings-target');await page.getByLabel('Proposed target (₹)',{exact:true}).fill('2000');await button('Preview decision').click();await metric('whatif-proposed-savings','₹1,500.00');await axeCheck();await button('Apply decision').click();await button('Undo last decision').click()
  await page.getByLabel('Proposed target (₹)',{exact:true}).fill('0');await button('Preview decision').click();await metric('whatif-proposed-saved','₹500.00');await button('Apply decision').click();await button('Undo last decision').click()
  await page.getByLabel('Scenario type').selectOption('purchase');await page.getByLabel('Scenario name',{exact:true}).fill('Draft');await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('100');await button('Preview decision').click();await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('200');assert.equal(await button('Apply decision').isDisabled(),true)
  await button('Preview decision').click();await button('Start fresh').click();await metric('whatif-current-cash','₹10,000.00');assert.equal(await button('Apply decision').isDisabled(),true);assert.equal(await button('Undo last decision').isDisabled(),true)
  await button('Reset sample').click();await metric('whatif-current-cash','₹9,950.00')
  results.push({viewport,http:response.status(),allScenarios:'passed',applyDiscardUndo:'passed',duplicateApply:'passed',axeViolations:0,horizontalOverflow:false})
 }
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({results,runtimeErrors:errors},null,2))
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
