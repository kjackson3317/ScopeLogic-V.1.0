import { DEMO_PROJECT_ID, DEMO_TABLES_KEY, DEMO_WORKSPACE_KEY } from './config';
import { makeDemoSeed, makeDemoTables } from './seed';

export function readDemoWorkspace(): any {
 if (typeof window === 'undefined') return makeDemoSeed();
 const raw=localStorage.getItem(DEMO_WORKSPACE_KEY);
 if(raw) return JSON.parse(raw);
 const seed=makeDemoSeed();localStorage.setItem(DEMO_WORKSPACE_KEY,JSON.stringify(seed));return seed;
}
export function resetDemo() {
 localStorage.removeItem(DEMO_WORKSPACE_KEY);localStorage.removeItem(DEMO_TABLES_KEY);
 for(const key of Object.keys(localStorage)) if(key.startsWith('technology-precon-'))localStorage.removeItem(key);
 indexedDB.deleteDatabase('technology-precon-project-files');
 window.location.assign('/');
}
function readTables():Record<string,any[]> {
 const tables=JSON.parse(localStorage.getItem(DEMO_TABLES_KEY)||'null')||makeDemoTables();
 // SLRs remain owned by the existing workspace; the review screens reference them.
 const workspace=readDemoWorkspace();
 tables.master_project_findings=(workspace.issuesByProject[DEMO_PROJECT_ID]||[]).map((s:any,i:number)=>({id:s.uid,master_project_id:'demo-master',display_number:s.id,scope_item:s.title,systems:s.systems,status:s.status,sequence_number:i+1}));
 return tables;
}
class LocalQuery implements PromiseLike<any> {
 private filters:((row:any)=>boolean)[]=[];private operation='select';private payload:any;private one=false;private conflict='id';private sorts:{key:string;ascending:boolean}[]=[];
 constructor(private table:string){}
 select(_columns?:string){return this;}
 eq(key:string,value:any){this.filters.push(r=>r[key]===value);return this;}
 order(key:string,options?:{ascending?:boolean}){this.sorts.push({key,ascending:options?.ascending!==false});return this;}
 maybeSingle(){this.one=true;return this;}
 single(){this.one=true;return this;}
 insert(data:any){this.operation='insert';this.payload=data;return this;}
 update(data:any){this.operation='update';this.payload=data;return this;}
 upsert(data:any,options?:{onConflict?:string}){this.operation='upsert';this.payload=data;this.conflict=options?.onConflict||'id';return this;}
 delete(){this.operation='delete';return this;}
 private run(){
  try {
   const tables=readTables();if(!tables[this.table])throw new Error(`This table is not part of the local presentation: ${this.table}`);
   let rows=tables[this.table];const match=(r:any)=>this.filters.every(f=>f(r));let result=rows.filter(match);
   if(this.operation==='delete')tables[this.table]=rows.filter(r=>!match(r));
   if(this.operation==='update'){result=rows.filter(match).map(r=>Object.assign(r,this.payload));}
   if(this.operation==='insert'||this.operation==='upsert'){
    result=(Array.isArray(this.payload)?this.payload:[this.payload]).map((p:any)=>{const existing=this.operation==='upsert'?rows.find(r=>this.conflict.split(',').every(k=>r[k]===p[k])):undefined;if(existing)return Object.assign(existing,p);const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...p};rows.push(row);return row;});
   }
   if(this.operation!=='select')localStorage.setItem(DEMO_TABLES_KEY,JSON.stringify(tables));
   result=[...result];for(const sort of [...this.sorts].reverse())result.sort((a,b)=>String(a[sort.key]??'').localeCompare(String(b[sort.key]??''),undefined,{numeric:true})*(sort.ascending?1:-1));
   return {data:this.one?(result[0]||null):result,error:null};
  }catch(error){return {data:null,error:{message:error instanceof Error?error.message:'Local save failed'}};}
 }
 then<TResult1=any,TResult2=never>(onfulfilled?:((value:any)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2>{return Promise.resolve(this.run()).then(onfulfilled,onrejected);}
}
export function createDemoClient(){return {from:(table:string)=>new LocalQuery(table),auth:{getUser:async()=>({data:{user:{id:'demo-presenter',email:'Demo Presenter'}},error:null})}};}
