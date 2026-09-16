const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),assert=require('assert');
(async()=>{
const base=process.env.DEMO_TEST_URL||'http://localhost:3000';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))external.push(r.url())});
const snapshot=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('technology-precon-workspace-v1')));
const close=async()=>{const b=page.getByRole('button',{name:'OK',exact:true});if(await b.isVisible())await b.click()};
const clickPoint=async(x,y)=>{const svg=page.locator('.drawing-overlay');await svg.scrollIntoViewIfNeeded();const b=await svg.boundingBox();await svg.click({position:{x:b.width*x,y:b.height*y}})};
await page.goto(base);await page.waitForSelector('.sidebar');await page.waitForTimeout(500);
assert.equal((await snapshot()).issuesByProject['demo-municipal'].length,28);
await page.getByRole('button',{name:'Drawing Take Off',exact:true}).click();await page.waitForFunction(()=>document.querySelector('canvas')?.width>10);await page.waitForTimeout(800);
assert(!(await page.locator('body').innerText()).includes('PDF could not'));
await page.getByRole('button',{name:'Calibrate',exact:true}).click();await clickPoint(.09,590/700);await clickPoint(.69,590/700);await page.getByRole('button',{name:'Finish',exact:true}).click();await close();
for(const mode of ['Distance','Polyline','Area','Perimeter']){
 await page.getByRole('button',{name:mode,exact:true}).click();await clickPoint(.1,.1);await clickPoint(.7,.1);if(mode!=='Distance')await clickPoint(.7,.3);if(['Area','Perimeter'].includes(mode))await clickPoint(.1,.3);await page.getByRole('button',{name:'Finish',exact:true}).click();await close();
}
await page.waitForTimeout(500);const measured=(await snapshot()).drawingMeasurementsByProject['demo-municipal'];assert.equal(measured.length,4);assert(Math.abs(measured[0].value-60)<.1);assert(Math.abs(measured[2].value-840)<1);
await page.getByRole('button',{name:/^Dual Data Structured Cabling/}).click();await clickPoint(.85,.6);await page.waitForTimeout(300);assert.equal((await snapshot()).drawingTakeoffMarksByProject['demo-municipal'].length,25);
await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(300);assert.equal((await snapshot()).drawingTakeoffMarksByProject['demo-municipal'].length,24);
await page.locator('.drawing-mark').last().click();await page.getByRole('button',{name:'Delete selected mark',exact:true}).first().click();await page.waitForTimeout(200);assert.equal((await snapshot()).drawingTakeoffMarksByProject['demo-municipal'].length,23);await page.getByRole('button',{name:'Undo',exact:true}).click();
await page.getByRole('button',{name:'Sync Counts to Take Off',exact:true}).click();await close();await page.waitForTimeout(300);assert.equal((await snapshot()).takeoffEntriesByProject['demo-municipal'][0].qty,24);
await page.screenshot({path:'.verification/takeoff-final.png',fullPage:true});
await page.reload();await page.waitForSelector('.sidebar');await page.waitForTimeout(300);assert.equal((await snapshot()).drawingMeasurementsByProject['demo-municipal'].length,4);
await page.goto(base+'/demo/review');await page.getByRole('button',{name:'Review Notes',exact:true}).click();await page.getByRole('button',{name:'Add Review Note',exact:true}).click();await page.getByLabel('Topic',{exact:true}).fill('Presentation walkthrough');await page.getByLabel('Observation',{exact:true}).fill('Verify spare conduit responsibility at the service entrance.');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Create SLR from note',exact:true}).last().click();await page.waitForTimeout(300);assert.equal((await snapshot()).issuesByProject['demo-municipal'].length,29);
for(const tab of ['Scope Matrix','Clarification Log™','Contractor Checklist','VE Opportunity Log','Bid Alignment — Internal','Bid Alignment Report','Internal Actions']){await page.getByRole('button',{name:tab,exact:true}).click();assert(!/ScopeLogic|Glynn|Miller Electric/.test(await page.locator('body').innerText()))}
await page.getByRole('button',{name:'Bid Alignment Report',exact:true}).click();await page.pdf({path:'.verification/bid-alignment.pdf',format:'Letter',printBackground:true});await page.screenshot({path:'.verification/review-final.png',fullPage:true});
await page.goto(base);await page.waitForSelector('.sidebar');await page.getByRole('button',{name:'Take Off Rules',exact:true}).click();
await page.locator('select').filter({has:page.locator('option[value="demo-quote"]')}).selectOption('demo-quote');
for(let n=0;n<2;n++){await page.getByRole('button',{name:'Update Quote from Take Off',exact:true}).click();await close();}
await page.waitForTimeout(300);const lines=(await snapshot()).quotesByProject['demo-municipal'][0].lines;console.log('QUOTE QUANTITIES',lines.map(x=>[x.description,x.qty]));
await page.getByRole('button',{name:'Generate Official Release',exact:true}).first().click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Generate Release',exact:true}).click();const file=await download;await file.saveAs('.verification/official-release.pdf');assert(!/ScopeLogic|SLC/i.test(file.suggestedFilename()));await close();
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('technology-precon-releases-v1')).length),1);
await page.getByRole('button',{name:'Quote Builder',exact:true}).click();
await page.locator('.quote-head-fields select').selectOption('Approved');await page.getByRole('button',{name:'Save Quote',exact:true}).first().click();await close();
await page.getByRole('button',{name:'Generate Quote PDF',exact:true}).click();const quoteDownload=page.waitForEvent('download');await page.getByRole('button',{name:/Option 2 — No BOM/}).click();const quoteFile=await quoteDownload;await quoteFile.saveAs('.verification/quote.pdf');await close();
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('technology-precon-releases-v1')).length),2);
await page.getByRole('button',{name:'Reset Demo',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Reset Demo',exact:true}).click();await page.waitForSelector('.sidebar');await page.waitForTimeout(500);assert.equal((await snapshot()).issuesByProject['demo-municipal'].length,28);assert.equal((await snapshot()).drawingMeasurementsByProject['demo-municipal'].length,0);assert.equal(await page.evaluate(()=>localStorage.getItem('technology-precon-releases-v1')),null);
assert.equal((await page.request.get(base+'/api/health')).status(),403);
fs.writeFileSync('.verification/flow-result.json',JSON.stringify({measurements:measured,errors,external},null,2));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS: calibration, four measurements, count, undo, delete, assembly quantity, reload, review-note to SLR, review tabs, printable bid report, network isolation');
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
