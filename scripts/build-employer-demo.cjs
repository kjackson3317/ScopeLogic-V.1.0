// Dedicated demo deployment entry point. Removes production assets only from
// the disposable build checkout; the main branch and production are untouched.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
process.env.NEXT_PUBLIC_APP_VARIANT='employer-demo';
process.env.NEXT_PUBLIC_SUPABASE_URL='';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='';
for(const relative of ['public/brand','public/samples','public/templates']){
 const target=path.resolve(relative),root=path.resolve('public')+path.sep;
 if(!target.startsWith(root))throw Error('Invalid demo asset path');
 fs.rmSync(target,{recursive:true,force:true});
}
const checked=spawnSync(process.execPath,['scripts/verify-recovery-source.mjs'],{stdio:'inherit'});
if(checked.status!==0)process.exit(checked.status||1);
const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:process.env});
process.exit(result.status||0);
