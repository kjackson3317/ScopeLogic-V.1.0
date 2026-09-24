/* Isolated browser regression: real SLR components/CSS, mocked cloud boundary.
 * Requires esbuild, playwright and pngjs available to Node (e.g. NODE_PATH).
 * SLR_BASELINE_REF must identify the approved pre-change Git revision.
 * Run: SLR_BASELINE_REF=<approved commit> node scripts/test-slr-ui.cjs
 * Optionally set SLR_BROWSER_CHANNEL=msedge for an installed Edge browser.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const root = process.cwd();
const output = path.join(root, '.verification/slr');
fs.mkdirSync(output, { recursive: true });
const baseline = process.env.SLR_BASELINE_REF;
assert(baseline, 'Set SLR_BASELINE_REF to the approved pre-change commit');
const before = file => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
const read = (file, mode) => mode === 'before' ? before(file) : fs.readFileSync(path.join(root, file), 'utf8');
const cssFiles = [...read('app/layout.tsx', 'after').matchAll(/import '\.\/(.*?\.css)'/g)].map(m => `app/${m[1]}`);
const cloudMock = `
  export const resolveSlrProjectContext = async () => ({projectId:'fixture-project',masterProjectId:'fixture-master'});
  export const loadSlrDraftCloud = async () => null;
  export const saveSlrDraftCloud = async () => { window.stats.saves++; };
  export const deleteSlrDraftCloud = async () => {};
  export const submitSlrCloud = async (issue) => { window.stats.submits++; return {row:{display_number:issue.id}}; };
  export const clearClarificationSuppressionForMasterSlr = () => {};
  export const suppressClarificationForMasterSlr = () => {};
  const client = { from(table) {
    const query = {select(){return this},eq(key,value){if(key==='display_number')this.id=value;return this},in(){return this},order(){return this},
      async maybeSingle(){ window.stats.loads.push(this.id); return {data:null,error:null}; },
      then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)} };
    return query;
  }};
  export const createClient = () => client;
`;
const fixture = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Layout from './app/slr-approved-layout-behavior';
import Deliverables from './app/slr-deliverables-editor-v2';
import Child from './app/slr-child-editor';
import {normalizeLegacyChildren} from './app/slr-model';
window.stats={loads:[],saves:0,submits:0,templates:0,observerCalls:0};
const NativeObserver=window.MutationObserver;
window.MutationObserver=class extends NativeObserver {constructor(callback){super((...args)=>{window.stats.observerCalls++;callback(...args)})}};
const issue = id => normalizeLegacyChildren({uid:id,id,title:'Network pathways',concern:'Verify pathway capacity.',reference:'T-101',systems:['Structured Cabling']});
function Fixture(){
 const [draft,setDraft]=useState(()=>issue('SLR-001'));
 const [visible,setVisible]=useState(true);
 window.setSlr=id=>flushSync(()=>setDraft(issue(id)));
 window.setVisible=value=>flushSync(()=>setVisible(value));
 return <><Layout/><Deliverables/><main className={new URLSearchParams(location.search).get('shell')||'app-shell'}>
 {visible&&<div className='matrix-editor-full'>
 <div className='issue-title'><label className='field'><span>Scope Item / Short Description</span><input value={draft.title} readOnly/></label><label className='field'><span>SLR ID</span><input value={draft.id} readOnly/></label></div>
 <div className='system-selector-block'><div className='system-chip-grid'><label className='selected'><input type='checkbox' checked readOnly/>Structured Cabling</label></div></div>
 <div className='matrix-writing-grid'><label className='field'><span>Concern / Observation</span><textarea value={draft.concern} readOnly/></label></div>
 <div className='matrix-reference-grid'><label className='field'><span>Source Reference</span><input value={draft.reference} readOnly/></label></div><div className='reference-help'>Source Information</div>
 <Child issue={draft} onChange={setDraft}/>
 <div className='submit-bar'><button className='primary'>Submit Entry</button><button className='secondary' onClick={()=>window.stats.templates++}>Save This SLR as Template</button></div>
 </div>}</main></>;
}
const root=createRoot(document.getElementById('root'));
window.unmountFixture=()=>flushSync(()=>root.unmount());
root.render(<Fixture/>);
`;

async function bundle(mode) {
  const result = await build({ stdin: {contents: fixture, loader:'tsx', resolveDir:root}, bundle:true, write:false,
    format:'iife', jsx:'automatic', define:{'process.env.NODE_ENV':'"production"'},
    plugins:[{name:'fixture-cloud-and-baseline',setup(b){
      b.onResolve({filter:/lib\/(supabase\/client|cloud-workspace|slr-draft-cloud)$/},args=>({path:args.path,namespace:'cloud-mock'}));
      b.onLoad({filter:/.*/,namespace:'cloud-mock'},()=>({contents:cloudMock,loader:'js'}));
      if(mode==='before')b.onLoad({filter:/app[\\/]slr-.*\.tsx$/},args=>({contents:before(path.relative(root,args.path).replaceAll('\\','/')),loader:'tsx'}));
    }}] });
  return result.outputFiles[0].text;
}

(async()=>{
  const bundles={before:await bundle('before'),after:await bundle('after')};
  const styles={before:cssFiles.map(f=>read(f,'before')).join('\n'),after:cssFiles.map(f=>read(f,'after')).join('\n')};
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const mode=url.searchParams.get('mode')==='before'?'before':'after';
    res.setHeader('Content-Type','text/html');
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles[mode]}</style></head><body><div id="root"></div><script>${bundles[mode]}</script></body></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  const results=[];
  try {
    browser=await chromium.launch({headless:true,...(process.env.SLR_BROWSER_CHANNEL?{channel:process.env.SLR_BROWSER_CHANNEL}:{})});
    const page=await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const url=`http://127.0.0.1:${server.address().port}`;
    const ready=async()=>{
      await page.waitForSelector('.sl-approved-save');
      await page.waitForSelector('.sl-approved-deliverable-header');
      await page.waitForTimeout(200);
    };
    for(const shell of ['app-shell','workspace-shell'])for(const width of [1440,768,390]){
      await page.setViewportSize({width,height:1100});
      const shots={};
      for(const mode of ['before','after']){
        await page.goto(`${url}?mode=${mode}&shell=${shell}`);await ready();
        const prefix=await page.locator('.slr-checklist-section .recommendation-heading b').evaluate(el=>getComputedStyle(el,'::before').content);
        assert.equal(prefix,mode==='before'?'""':'"8. "');
        // Mask only the requested heading text; every other pixel must match.
        shots[mode]=await page.screenshot({fullPage:true,mask:[page.locator('.slr-checklist-section .recommendation-heading > div:first-child')],path:path.join(output,`${shell}-${width}-${mode}.png`)});
      }
      const a=PNG.sync.read(shots.before),b=PNG.sync.read(shots.after);
      assert.equal(a.width,b.width);assert.equal(a.height,b.height);
      let changed=0;for(let i=0;i<a.data.length;i+=4)if(!a.data.subarray(i,i+4).equals(b.data.subarray(i,i+4)))changed++;
      assert.equal(changed,0,`${shell}/${width}: unexpected appearance difference`);
      results.push(`${shell}/${width}: identical pixels outside checklist heading`);
    }
    await page.setViewportSize({width:1440,height:1100});
    await page.goto(`${url}?mode=after`);await ready();
    assert.equal(await page.evaluate(()=>window.stats.loads.length),1,'one initial GC/VE load');
    const idle=await page.evaluate(()=>window.stats.observerCalls);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>window.stats.observerCalls),idle,'observers must settle');
    for(let i=2;i<=21;i++){
      const id='SLR-'+String(i).padStart(3,'0');
      await page.evaluate(id=>window.setSlr(id),id);
      await page.waitForFunction(id=>window.stats.loads.includes(id),id);
    }
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>window.stats.loads.length),21,'one load per selection');
    assert.equal(await page.locator('.sl-approved-save').count(),1);
    assert.equal(await page.locator('.sl-slr-deliverables-v2-host').count(),1);
    assert(await page.locator('.sl-slr-deliverables-v2-host').evaluate(el=>el.nextElementSibling.classList.contains('slr-checklist-section')));
    results.push('21 selections: one GC/VE load per selection; one host and action bar; observers settle');
    await page.locator('.sl-approved-save').click();
    await page.waitForFunction(()=>window.stats.saves===1);
    await page.locator('.sl-approved-template').click();
    assert.equal(await page.evaluate(()=>window.stats.templates),1);
    await page.locator('.sl-approved-submit').click();
    await page.waitForFunction(()=>window.stats.submits===1);
    await page.waitForTimeout(250);
    await page.getByRole('button',{name:'+ Add RFI',exact:true}).click();
    assert.equal(await page.locator('.slr-rfi-section .slr-child-card').count(),1);
    await page.locator('.slr-checklist-section .recommendation-heading button').last().click();
    assert.equal(await page.locator('.slr-checklist-section .slr-child-card').count(),1);
    const toggle=page.locator('.clarification .sl-approved-deliverable-header button').last();
    await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    await page.getByRole('button',{name:'+ Add GC Clarification',exact:true}).click();
    assert.equal(await page.locator('.sl-slr-deliverable-card.new').count(),1);
    await page.evaluate(()=>window.setSlr('SLR-030'));
    await page.waitForFunction(()=>window.stats.loads.includes('SLR-030'));
    assert.equal(await page.locator('.sl-slr-deliverable-card.new').count(),0,'new selection clears unsaved form');
    results.push('Save/Submit/Template callbacks, add RFI/checklist, GC collapse/expand/new-form reset: passed (mock cloud)');
    await page.evaluate(()=>window.setVisible(false));await page.waitForTimeout(100);
    await page.evaluate(()=>window.setVisible(true));await ready();
    assert.equal(await page.locator('.sl-approved-save').count(),1);
    assert.equal(await page.locator('.sl-slr-deliverables-v2-host').count(),1);
    await page.evaluate(()=>{
      window.dispatchEvent(new Event('scopelogic:slr-draft-saved'));
      window.unmountFixture();
      window.loadsAtUnmount=window.stats.loads.length;
    });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>window.stats.loads.length),await page.evaluate(()=>window.loadsAtUnmount),'pending event reload cancelled on unmount');
    assert.equal(errors.length,0,errors.join('\n'));
    results.push('Editor remount, pending reload cancellation, no browser exceptions: passed');
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
    console.log(results.join('\n'));
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
