import type { OfficialRelease } from '../cloud-workspace-legacy';
const key='technology-precon-releases-v1';
const read=():OfficialRelease[]=>JSON.parse(localStorage.getItem(key)||'[]');
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('technology-precon-project-files',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('files'))r.result.createObjectStore('files')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function localReleaseUrl(path:string){const db=await database();const blob=await new Promise<Blob>((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(path);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();if(!blob)throw Error('This local release file is unavailable.');return URL.createObjectURL(blob);}
export async function localSaveRelease(fileName:string,pdf:Blob,revision:string,versionDate:string,notes:string,deliverables:string[],snapshotData:any,documentKey='review'){
 const prior=read();const releaseNumber=prior.length+1,id=crypto.randomUUID(),storagePath='demo-release:'+id;
 const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(pdf,storagePath);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close();
 const digest=await crypto.subtle.digest('SHA-256',await pdf.arrayBuffer());const sha256=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
 const record:OfficialRelease={id,releaseNumber,revision,versionDate,notes,fileName,storagePath,releasedAt:new Date().toISOString(),supersededAt:'',contentSha256:sha256,deliverables,lifecycleStatus:'Current',documentKey,snapshotData};
 localStorage.setItem(key,JSON.stringify([...prior.map(r=>r.documentKey===documentKey?{...r,lifecycleStatus:'Superseded',supersededAt:record.releasedAt}:r),record]));return {releaseNumber,releaseId:id,storagePath,sha256};
}
export const localListReleases=async()=>read();
export const localNextRelease=async()=>read().length+1;
