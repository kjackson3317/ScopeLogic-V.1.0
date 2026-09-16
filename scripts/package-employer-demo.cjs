// Prepare a source-only deployment; never include credentials or customer assets.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const files=[];
function add(file){const b=fs.readFileSync(file);const binary=/\.(png|pdf)$/.test(file);files.push({file,data:b.toString(binary?'base64':'utf8'),encoding:binary?'base64':'utf-8',sha:crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex')})}
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+item.name;if(item.isDirectory())walk(p);else add(p)}}
for(const dir of ['app','lib','public/demo'])walk(dir);
for(const file of ['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','proxy.ts','scripts/copy-pdf-worker.mjs','scripts/verify-recovery-source.mjs','scripts/demo-branding-loader.cjs','scripts/demo-workspace-transform.json'])if(fs.existsSync(file))add(file);
fs.mkdirSync('.verification',{recursive:true});fs.writeFileSync('.verification/source-manifest.json',JSON.stringify(files));
const deployment=files.map(({file,data,encoding})=>({file,data,encoding:encoding==='utf-8'?'utf-8':'base64'}));
deployment.push({file:'.env.production',data:'NEXT_PUBLIC_APP_VARIANT=employer-demo\nNEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\n',encoding:'utf-8'});
deployment.push({file:'vercel.json',data:JSON.stringify({framework:'nextjs',buildCommand:'npm run build'}),encoding:'utf-8'});
fs.writeFileSync('.verification/deploy-manifest.json',JSON.stringify(deployment));
console.log(JSON.stringify({files:files.length,sourceBytes:fs.statSync('.verification/source-manifest.json').size,deployBytes:fs.statSync('.verification/deploy-manifest.json').size}));
