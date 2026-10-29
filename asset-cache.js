import { ASSET_MANIFEST } from "./asset-manifest.js?v=20261029-gh1";

export function createAssetStore(options={}) {
  const entries=options.entries||ASSET_MANIFEST.assets;
  const baseURL=options.baseURL||new URL("./",globalThis.location?.href||"http://localhost/").href;
  const useMirror=options.useMirror??new URL(baseURL).hostname.endsWith(".github.io");
  const mirrorBase=options.mirrorBase||"https://gh-proxy.com/https://raw.githubusercontent.com/vpietri-stack/remember-me-song/main/";
  const fetcher=options.fetcher||globalThis.fetch.bind(globalThis);
  const makeURL=options.makeURL||((blob)=>URL.createObjectURL(blob));
  const databaseAPI=options.indexedDB===false?null:(options.indexedDB||globalThis.indexedDB);
  const hedgeMs=options.hedgeMs??1200,timeoutMs=options.timeoutMs??18000;
  const limit=options.concurrency??3;
  const memory=new Map(),pending=new Map(),failed=new Set(),listeners=new Set(),queue=[];
  let active=0;
  const database=new Promise(resolve=>{
    if(!databaseAPI){resolve(null);return;}
    let request,settled=false;
    const finish=db=>{if(settled){db?.close();return;}settled=true;clearTimeout(timer);resolve(db);};
    const timer=setTimeout(()=>finish(null),2000);
    try{request=databaseAPI.open("remember-me-song-assets-v1",1);}catch{finish(null);return;}
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("files"))request.result.createObjectStore("files",{keyPath:"key"});};
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();finish(request.result);};
    request.onerror=request.onblocked=()=>finish(null);
  });
  function entryFor(path){const entry=entries[path];if(!entry)throw new Error("Unknown asset");return entry;}
  function cacheKey(path){return entryFor(path).sha256+"/"+path;}
  function stats(){return {ready:memory.size,total:Object.keys(entries).length,failed:failed.size,active,queued:queue.length};}
  function emit(){const value=stats();for(const listener of listeners)listener(value);}
  const encoded=path=>path.split("/").map(encodeURIComponent).join("/");
  function sourceUrls(path){
    const entry=entryFor(path),query="?v="+entry.sha256.slice(0,16);
    const origin=new URL(encoded(path),baseURL).href+query;
    return useMirror?[mirrorBase+encoded(path)+query,origin]:[origin];
  }
  async function readCache(path){
    const db=await database;if(!db)return null;
    try{
      return await new Promise(resolve=>{
        const tx=db.transaction("files","readonly"),req=tx.objectStore("files").get(cacheKey(path));
        req.onsuccess=()=>{const file=req.result;resolve(file?.blob instanceof Blob&&file.blob.size===entryFor(path).bytes?file.blob:null);};
        req.onerror=()=>resolve(null);tx.onabort=()=>resolve(null);
      });
    }catch{return null;}
  }
  async function writeCache(path,blob){
    const db=await database;if(!db)return;
    try{
      await new Promise(resolve=>{
        const tx=db.transaction("files","readwrite");
        tx.objectStore("files").put({key:cacheKey(path),blob,type:entryFor(path).type,savedAt:Date.now()});
        tx.oncomplete=tx.onerror=tx.onabort=resolve;
      });
    }catch{}
  }
  async function fetchOne(path,url,controller){
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetcher(url,{signal:controller.signal,cache:"default"});
      if(!response.ok)throw new Error("Asset HTTP "+response.status);
      const bytes=await response.arrayBuffer(),entry=entryFor(path);
      if(bytes.byteLength!==entry.bytes)throw new Error("Incomplete asset");
      if(globalThis.crypto?.subtle){
        const digest=await crypto.subtle.digest("SHA-256",bytes);
        const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
        if(hash!==entry.sha256)throw new Error("Asset version mismatch");
      }
      return new Blob([bytes],{type:entry.type});
    }finally{clearTimeout(timer);}
  }
  function download(path){
    const urls=sourceUrls(path),controllers=urls.map(()=>new AbortController()),started=new Set();
    return new Promise((resolve,reject)=>{
      let settled=false,errors=0;
      const fallback=urls.length>1?setTimeout(()=>start(1),hedgeMs):null;
      function start(index){
        if(settled||started.has(index))return;started.add(index);
        fetchOne(path,urls[index],controllers[index]).then(blob=>{
          if(settled)return;settled=true;clearTimeout(fallback);
          controllers.forEach((controller,i)=>{if(i!==index)controller.abort();});
          resolve(blob);
        }).catch(()=>{
          if(settled)return;errors++;
          if(index===0&&urls.length>1)start(1);
          if(errors===urls.length){settled=true;clearTimeout(fallback);reject(new Error("Asset sources unavailable"));}
        });
      }
      start(0);
    });
  }
  async function process(job){
    try{
      const cached=await readCache(job.path);
      const blob=cached||await download(job.path);
      const url=makeURL(blob);memory.set(job.path,{url,blob});failed.delete(job.path);
      if(!cached)await writeCache(job.path,blob);
      job.resolve(url);
    }catch{failed.add(job.path);job.resolve(null);}
    finally{pending.delete(job.path);active--;emit();drain();}
  }
  function drain(){
    while(active<limit&&queue.length){const job=queue.shift();active++;process(job);}
    emit();
  }
  function getBlobUrl(path,{priority=false}={}){
    entryFor(path);
    if(memory.has(path))return Promise.resolve(memory.get(path).url);
    if(pending.has(path)){
      const job=pending.get(path),index=queue.indexOf(job);
      if(priority&&index>0){queue.splice(index,1);queue.unshift(job);}
      return job.promise;
    }
    failed.delete(path);
    const job={path,resolve:null,promise:null};
    job.promise=new Promise(resolve=>{job.resolve=resolve;});pending.set(path,job);
    priority?queue.unshift(job):queue.push(job);drain();
    return job.promise;
  }
  return {
    getBlobUrl,
    url:path=>memory.get(path)?.url||sourceUrls(path)[0],
    originUrl:path=>{const urls=sourceUrls(path);return urls[urls.length-1];},
    getMemory:path=>memory.get(path)?.url||null,
    prefetch:paths=>Promise.all([...new Set(paths)].map(path=>getBlobUrl(path))),
    subscribe(listener){listeners.add(listener);listener(stats());return()=>listeners.delete(listener);},
    stats,
  };
}
export const Assets=createAssetStore();
