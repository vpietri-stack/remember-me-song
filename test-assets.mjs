import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createAssetStore} from "./asset-cache.js";
const payload=new TextEncoder().encode("example classroom audio");
const entry={bytes:payload.byteLength,sha256:createHash("sha256").update(payload).digest("hex"),type:"audio/mpeg"};
const options={entries:{"assets/example.mp3":entry},baseURL:"https://vpietri-stack.github.io/remember-me-song/",useMirror:true,indexedDB:false,hedgeMs:8,timeoutMs:100,makeURL:()=>"blob:test"};
const response=()=>new Response(payload,{status:200});
const checks=[];
{
 const calls=[];const store=createAssetStore({...options,hedgeMs:200,fetcher:async url=>{calls.push(url);return response();}});
 const [a,b]=await Promise.all([store.getBlobUrl("assets/example.mp3"),store.getBlobUrl("assets/example.mp3")]);
 assert.equal(a,"blob:test");assert.equal(b,a);assert.equal(calls.length,1);assert.ok(calls[0].startsWith("https://gh-proxy.com/"));
 await new Promise(r=>setTimeout(r,15));assert.equal(calls.length,1);
 await store.getBlobUrl("assets/example.mp3");assert.equal(calls.length,1);
 checks.push("mirror first; concurrent requests deduplicated; memory cache avoids downloads");
}
{
 const calls=[];const store=createAssetStore({...options,fetcher:async url=>{calls.push(url);if(url.includes("gh-proxy"))throw new Error("mirror down");return response();}});
 assert.equal(await store.getBlobUrl("assets/example.mp3"),"blob:test");assert.equal(calls.length,2);
 assert.ok(calls[1].startsWith("https://vpietri-stack.github.io/"));
 checks.push("failed mirror immediately falls back to GitHub Pages");
}
{
 let aborted=false;const calls=[];
 const store=createAssetStore({...options,fetcher:(url,{signal})=>{calls.push(url);if(!url.includes("gh-proxy"))return Promise.resolve(response());return new Promise((resolve,reject)=>signal.addEventListener("abort",()=>{aborted=true;reject(new Error("aborted"));}));}});
 assert.equal(await store.getBlobUrl("assets/example.mp3"),"blob:test");assert.equal(calls.length,2);assert.ok(aborted);
 checks.push("stalled mirror triggers early fallback and cancels the losing request");
}
{
 const calls=[];const wrong=new Uint8Array(payload.length).fill(7);
 const store=createAssetStore({...options,fetcher:async url=>{calls.push(url);return url.includes("gh-proxy")?new Response(wrong):response();}});
 assert.equal(await store.getBlobUrl("assets/example.mp3"),"blob:test");assert.equal(calls.length,2);
 checks.push("incorrect asset content cannot enter the cache");
}
{
 let available=false;
 const store=createAssetStore({...options,fetcher:async()=>available?response():new Response("not found",{status:404})});
 assert.equal(await store.getBlobUrl("assets/example.mp3"),null);assert.equal(store.stats().failed,1);
 available=true;assert.equal(await store.getBlobUrl("assets/example.mp3",{priority:true}),"blob:test");assert.equal(store.stats().failed,0);
 checks.push("all-source failure is recoverable on the next tap");
}
{
 const entries={};for(let i=0;i<8;i++)entries["assets/"+i+".mp3"]=entry;
 let active=0,max=0;
 const store=createAssetStore({...options,entries,useMirror:false,fetcher:async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return response();}});
 await store.prefetch(Object.keys(entries));assert.ok(max<=3);assert.equal(store.stats().ready,8);
 checks.push("background downloads are bounded to three jobs");
}
console.log(JSON.stringify({passed:checks.length,checks}));
