import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {SONG} from "./song-data.js";
import {ASSET_MANIFEST} from "./asset-manifest.js";
assert.equal(SONG.cards.length,11);assert.equal(SONG.lines.length,13);
assert.equal(SONG.lines.filter(l=>l.text==="Remember me").length,5);
assert.equal(SONG.lines.flatMap(l=>l.cards).length,15);
const html=readFileSync("index.html","utf8"),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length);
for(const card of SONG.cards){assert.ok(existsSync(card.image));assert.ok(existsSync(card.spoken));}
for(const line of SONG.lines){assert.ok(existsSync(line.audio));assert.equal(line.text,line.cards.map(id=>SONG.cards.find(c=>c.id===id).text).join(" "));}
assert.ok(existsSync(SONG.fullSong.audio));
assert.equal(Object.keys(ASSET_MANIFEST.assets).length,36);
for(const [path,entry]of Object.entries(ASSET_MANIFEST.assets)){
 const bytes=readFileSync(path);
 assert.equal(bytes.length,entry.bytes);
 assert.equal(createHash("sha256").update(bytes).digest("hex"),entry.sha256);
}
const code=readFileSync("app.js","utf8");
assert.ok(code.includes("Assets.getBlobUrl")&&code.includes("Assets.prefetch"));
assert.ok(!code.includes("getUserMedia")&&!code.includes("MediaRecorder"));
assert.ok(html.includes("听老师读短语")&&html.includes("带音符的歌词")&&html.includes("听完整歌曲"));
assert.ok(!html.includes('class="closing"'));
console.log(JSON.stringify({cards:11,sungLines:13,assets:36,totalMegabytes:(Object.values(ASSET_MANIFEST.assets).reduce((n,e)=>n+e.bytes,0)/1024**2).toFixed(2),allAssetHashesMatch:true,lyricsExact:true,chineseInstructions:true}));
