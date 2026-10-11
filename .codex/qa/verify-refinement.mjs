import { chromium } from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import serverlessChromium from '/tmp/my-month-browser/node_modules/@sparticuz/chromium/build/index.js'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4190', '--strictPort'])
let browser
try {
 await new Promise((resolve,reject) => { server.stdout.on('data', data => { if(data.toString().includes('4190')) resolve() }); server.once('exit',code=>reject(new Error(`Server exited ${code}`))); setTimeout(()=>reject(new Error('Startup timeout')),10000).unref() })
 browser = await chromium.launch({executablePath:'/tmp/my-month-chromium/chromium',headless:true,args:serverlessChromium.args,env:{...process.env,LD_LIBRARY_PATH:'/tmp/my-month-chromium:/tmp/my-month-chromium/lib',FONTCONFIG_PATH:'/tmp/my-month-chromium/fonts'}})
 const page=await browser.newPage()
 const errors=[],results=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
 async function inspect(name){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow: ${name}`)
  await page.addScriptTag({path:'/tmp/my-month-browser/node_modules/axe-core/axe.min.js'})
  const violations=await page.evaluate(async()=> (await axe.run(document)).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))
  assert.deepEqual(violations,[],JSON.stringify({name,violations}))
  const controls=await page.evaluate(()=>[...document.querySelectorAll('button,input,select,summary')].filter(n=>n.getBoundingClientRect().width>0).map(n=>({name:n.textContent?.slice(0,40),height:n.getBoundingClientRect().height,font:getComputedStyle(n).fontSize})))
  assert.equal(controls.every(n=>n.height>=43.9),true,JSON.stringify(controls.filter(n=>n.height<43.9)))
 }
 for(const viewport of [{width:1365,height:1000},{width:768,height:1024},{width:390,height:844},{width:320,height:800}]){
  await page.setViewportSize(viewport);await page.goto('http://127.0.0.1:4190/',{waitUntil:'networkidle'});await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle'})
  await inspect(`${viewport.width} month`)
  await page.keyboard.press('Tab');assert.equal(await page.getByRole('link',{name:'Skip to main content'}).evaluate(n=>n===document.activeElement),true)
  await page.keyboard.press('Enter');assert.equal(await page.locator('main').evaluate(n=>n===document.activeElement),true)
  await page.locator('main').evaluate(n=>n.blur());await page.evaluate(()=>scrollTo(0,0))
  if(viewport.width===1365||viewport.width===390)await page.screenshot({path:`.codex/qa/refined-${viewport.width>700?'desktop':'mobile'}-month.png`,fullPage:true})
  await page.getByRole('button',{name:'What If',exact:true}).click()
  assert.equal(await page.getByRole('button',{name:'Apply decision',exact:true}).isDisabled(),true)
  await page.getByLabel('Scenario name',{exact:true}).fill('New headphones');await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('500');await page.getByRole('button',{name:'Preview decision',exact:true}).click()
  await inspect(`${viewport.width} scenario`)
  assert.equal(await page.getByRole('table',{name:'Main scenario impacts',exact:true}).isVisible(),true)
  assert.equal(await page.getByRole('table',{name:'Supporting scenario impacts',exact:true}).isVisible(),false)
  if(viewport.width===1365||viewport.width===390)await page.screenshot({path:`.codex/qa/refined-${viewport.width>700?'desktop':'mobile'}-scenario.png`,fullPage:true})
  await page.getByText('More comparison details',{exact:true}).focus();await page.keyboard.press('Enter')
  assert.equal(await page.getByRole('table',{name:'Supporting scenario impacts',exact:true}).isVisible(),true)
  await inspect(`${viewport.width} expanded comparison`)
  await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('0');await page.getByRole('button',{name:'Preview decision',exact:true}).click();await page.getByRole('alert').waitFor();await inspect(`${viewport.width} error`)
  await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('12000');await page.getByRole('button',{name:'Preview decision',exact:true}).click();await page.getByRole('heading',{name:'Proposed health'}).waitFor();await inspect(`${viewport.width} critical`)
  await page.getByRole('button',{name:'Discard preview',exact:true}).click()
  await page.getByLabel('Scenario name',{exact:true}).fill('Long name '.repeat(10).trim());await page.getByLabel('Scenario amount (₹)',{exact:true}).fill('500');await page.getByRole('button',{name:'Preview decision',exact:true}).click();await inspect(`${viewport.width} long name`)
  await page.getByRole('button',{name:'Start fresh',exact:true}).click();await page.getByLabel('Scenario type').selectOption('cancel-subscription');await inspect(`${viewport.width} empty`)
  results.push({viewport,monthAndScenario:'passed',keyboardSkipAndDisclosure:'passed',errorEmptyCriticalLongName:'passed',targets:'at least 44px',axeViolations:0,horizontalOverflow:false})
 }
 // 683 CSS px models the reflow viewport of a 1366px display at 200% page zoom.
 await page.setViewportSize({width:683,height:1000});await page.goto('http://127.0.0.1:4190/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Reset sample',exact:true}).click();await inspect('200% reflow')
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='20px');await inspect('125% enlarged text')
 await page.getByRole('button',{name:'What If',exact:true}).click();await inspect('125% enlarged scenario text')
 await page.evaluate(()=>document.documentElement.style.fontSize='16px')
 await page.emulateMedia({reducedMotion:'reduce'})
 assert.equal(await page.getByRole('button',{name:'Preview decision',exact:true}).evaluate(n=>getComputedStyle(n).transitionDuration),'0s')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({results,reflow200Percent:'passed',enlargedText125Percent:'passed',reducedMotion:'passed',runtimeErrors:errors},null,2))
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
