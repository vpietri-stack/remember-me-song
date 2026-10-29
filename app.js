import { SONG } from "./song-data.js?v=20261029-gh1";
import { Assets } from "./asset-cache.js?v=20261029-record1";
import { createPractice, KARAOKE_PATH } from "./practice.js?v=20261029-record1";
import { createListeningPlayer } from "./listen.js?v=20261029-record1";
const $=id=>document.getElementById(id);
const icon=name=>'<svg aria-hidden="true"><use href="#'+name+'"/></svg>';
const audio=$("audio"),cards=new Map(SONG.cards.map(c=>[c.id,c]));
const state={mode:null,line:null,card:null,chinese:false,token:0,active:null,loading:false,intent:false,assetPath:null,originTried:false,recoveringToken:null};
const lineElements=new Map(),pictureElements=[];
function clock(s){s=Number.isFinite(s)?Math.max(0,s):0;return Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");}
function saveSettings(){try{localStorage.setItem("remember-me-student-settings",JSON.stringify({chinese:state.chinese}));}catch{}}
try{const settings=JSON.parse(localStorage.getItem("remember-me-student-settings")||"{}");state.chinese=settings.chinese===true;}catch{}
function buildCards(){
 const container=$("song-lines");
 for(const line of SONG.lines){
  const article=document.createElement("article");
  article.className="lyric-card"+(line.cards.length>1?" wide paired":"")+(line.index===11?" wide long":"");
  article.id="line-"+String(line.index).padStart(2,"0");article.dataset.line=String(line.index);
  const top=document.createElement("div");top.className="line-top";
  const number=document.createElement("span");number.className="line-number";number.textContent=String(line.index);number.setAttribute("aria-label","Song line "+line.index);
  const tag=document.createElement("span");tag.className="line-tag";tag.innerHTML=icon("speaker")+" Hear the words";
  top.append(number,tag);article.append(top);
  const pictures=document.createElement("div");pictures.className="pictures";
  for(const cid of line.cards){
    const card=cards.get(cid),figure=document.createElement("figure");figure.className="picture-part";
    const button=document.createElement("button");button.className="picture-button";button.dataset.card=cid;button.dataset.line=String(line.index);
    button.setAttribute("aria-label","Hear spoken phrase: "+card.text);button.setAttribute("aria-pressed","false");
    const image=document.createElement("img");image.src=Assets.url(card.image);image.alt=card.text;image.width=600;image.height=400;image.loading=line.index<=2?"eager":"lazy";
    image.addEventListener("error",()=>{if(!image.dataset.fallback){image.dataset.fallback="true";image.src=Assets.originUrl(card.image);}});
    Assets.getBlobUrl(card.image).then(url=>{if(url&&image.src!==url)image.src=url;});
    const bubble=document.createElement("span");bubble.className="sound-bubble";bubble.setAttribute("aria-hidden","true");bubble.innerHTML=icon("speaker");
    button.append(image,bubble);button.addEventListener("click",()=>playSource("spoken",line.index,cid));figure.append(button);pictureElements.push(button);
    if(line.cards.length>1){
      const cap=document.createElement("figcaption");cap.className="part-caption";cap.textContent=card.text;figure.append(cap);
      const zh=document.createElement("p");zh.className="part-meaning meaning";zh.lang="zh-CN";zh.textContent=card.zh;figure.append(zh);
    }
    pictures.append(figure);
  }
  article.append(pictures);
  const sing=document.createElement("button");sing.className="sing-line";sing.dataset.line=String(line.index);
  sing.setAttribute("aria-label","Sing line "+line.index+": "+line.text);sing.setAttribute("aria-pressed","false");
  const note=document.createElement("span");note.className="sing-icon";note.setAttribute("aria-hidden","true");note.innerHTML=icon("music");
  const text=document.createElement("span");text.className="lyric-text";text.textContent=line.text;
  sing.append(note,text);sing.addEventListener("click",()=>playSource("line",line.index));article.append(sing);
  const meaning=document.createElement("p");meaning.className="line-meaning meaning";meaning.lang="zh-CN";meaning.textContent=line.zh;article.append(meaning);
  container.append(article);lineElements.set(line.index,article);
 }
}
function updateSettings(){
 document.body.classList.toggle("show-meanings",state.chinese);
 $("chinese").textContent=state.chinese?"隐藏中文":"中文意思";$("chinese").setAttribute("aria-pressed",String(state.chinese));
 $("chinese").classList.toggle("selected",state.chinese);
}
function showError(){
 $("notice").textContent=state.chinese?"暂时无法播放。请检查网络后再点一次。":"This recording couldn't play. Check your connection, then tap it again.";
 $("notice").hidden=false;
}
function refreshHighlights(){
 const isPlaying=!audio.paused&&!audio.ended;
 for(const [index,article]of lineElements){
  const active=index===state.active&&isPlaying;
  article.classList.toggle("is-playing",active&&state.mode!=="spoken");
  article.classList.toggle("is-speaking",active&&state.mode==="spoken");
  article.querySelector(".sing-line").setAttribute("aria-pressed",String(active&&state.mode!=="spoken"));
 }
 for(const button of pictureElements){
  const active=isPlaying&&state.mode==="spoken"&&Number(button.dataset.line)===state.line&&button.dataset.card===state.card;
  button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",String(active));
 }
}
function updatePlayer(){
 const isPlaying=!audio.paused&&!audio.ended;
 $("toggle").innerHTML=icon(isPlaying?"pause":"play");
 $("toggle").setAttribute("aria-label",isPlaying?"Pause playback":state.mode?"Play current recording":"Play whole song");
 $("stop-button").disabled=!state.mode;
 $("full-icon").innerHTML='<use href="#'+(state.mode==="full"&&isPlaying?"pause":"play")+'"/>';
 $("full-label").textContent=state.mode==="full"?(isPlaying?"暂停歌曲":audio.ended?"听完整歌曲":"继续播放歌曲"):"听完整歌曲";
 const currentLine=SONG.lines.find(l=>l.index===(state.mode==="full"?state.active:state.line));
 const currentCard=cards.get(state.card);
 $("player-kind").textContent=state.loading?"LOADING…":state.mode==="spoken"?"HEAR THE WORDS":state.mode==="line"?"SING THIS LINE":state.mode==="full"?"THE WHOLE SONG":"LET'S SING";
 $("player-text").textContent=state.mode==="spoken"?(currentCard?.text||SONG.title):currentLine?.text||SONG.title;
 const duration=Number.isFinite(audio.duration)?audio.duration:state.mode==="full"?SONG.fullSong.duration:0;
 $("elapsed").textContent=clock(audio.currentTime);$("duration").textContent=clock(duration||SONG.fullSong.duration);
 $("seek").disabled=!state.mode||!duration;
 $("seek").value=duration?String(Math.round(audio.currentTime/duration*1000)):"0";
 $("seek").setAttribute("aria-valuetext",clock(audio.currentTime)+" of "+clock(duration));
 refreshHighlights();
}
function activateLine(index,scroll=false){
 if(state.active===index)return;
 state.active=index;updatePlayer();
}
async function playSource(mode,index=null,cid=null){
 const token=++state.token;audio.pause();$("notice").hidden=true;
 const line=index?SONG.lines.find(l=>l.index===index):null;
 const src=mode==="full"?SONG.fullSong.audio:mode==="spoken"?cards.get(cid)?.spoken:line?.audio;
 if(!src)return;
 state.mode=mode;state.line=index;state.card=cid;state.active=mode==="full"?1:index;state.loading=true;state.intent=true;state.assetPath=src;state.originTried=false;
 audio.src=Assets.url(src);audio.currentTime=0;audio.load();updatePlayer();
 // Start play in the original tap event, before awaiting downloads, for iOS/WeChat.
 const playing=audio.play();
 Assets.getBlobUrl(src,{priority:true}).then(url=>{
  if(!url||token!==state.token||!state.intent||audio.src===url||audio.currentTime>.03||(!audio.paused&&audio.readyState>=3))return;
  replaceSource(url,token);
 });
 try{await playing;if(token!==state.token)return;state.loading=false;updatePlayer();}
 catch(error){if(token!==state.token||error.name==="AbortError")return;if(error.name==="NotAllowedError"||state.recoveringToken===token){state.intent=false;state.loading=false;showError();updatePlayer();}else recoverAudio();}
}
async function replaceSource(url,token){
 if(token!==state.token||!state.intent)return;
 audio.src=url;audio.load();
 try{await audio.play();if(token===state.token){state.loading=false;$("notice").hidden=true;updatePlayer();}}
 catch(error){if(token!==state.token||error.name==="AbortError")return;if(error.name==="NotAllowedError"||state.recoveringToken===token){state.intent=false;state.loading=false;showError();updatePlayer();}else recoverAudio();}
}
async function recoverAudio(){
 const token=state.token;
 if(!state.mode||!state.intent||state.recoveringToken===token)return;
 state.recoveringToken=token;
 try{
  const url=await Assets.getBlobUrl(state.assetPath,{priority:true});
  if(token!==state.token||!state.intent)return;
  if(!audio.error&&(audio.currentTime>.03||(url&&audio.src===url)))return;
  if(url&&audio.src!==url){await replaceSource(url,token);return;}
  if(!state.originTried){state.originTried=true;await replaceSource(Assets.originUrl(state.assetPath),token);return;}
  state.intent=false;state.loading=false;showError();updatePlayer();
 }finally{if(state.recoveringToken===token)state.recoveringToken=null;}
}
function fullSong(){
 listening.open();
}
async function resume(){
 if(!state.mode){fullSong();return;}
 if(audio.error){playSource(state.mode,state.line,state.card);return;}
 if(audio.ended)audio.currentTime=0;
 state.intent=true;
 try{await audio.play();}catch{recoverAudio();}
 updatePlayer();
}
function stop(){
 ++state.token;audio.pause();audio.removeAttribute("src");audio.load();
 state.mode=null;state.active=null;state.line=null;state.card=null;state.loading=false;state.intent=false;state.assetPath=null;updatePlayer();
}
$("full-song").addEventListener("click",fullSong);
$("toggle").addEventListener("click",()=>{if(audio.paused)resume();else{state.intent=false;audio.pause();}});
$("stop-button").addEventListener("click",stop);
$("chinese").addEventListener("click",()=>{state.chinese=!state.chinese;updateSettings();saveSettings();});
$("seek").addEventListener("input",()=>{if(Number.isFinite(audio.duration))audio.currentTime=Number($("seek").value)/1000*audio.duration;});
audio.addEventListener("timeupdate",()=>{
 if(state.mode==="full"){
  let active=SONG.lines[0].index;
  for(const line of SONG.lines){if(audio.currentTime>=line.fullSongStart)active=line.index;else break;}
  activateLine(active,true);
 }
 updatePlayer();
});
for(const event of ["play","pause","ended","loadedmetadata","seeked"])audio.addEventListener(event,updatePlayer);
audio.addEventListener("error",()=>{if(state.mode&&audio.error)recoverAudio();});
audio.addEventListener("ended",()=>{state.intent=false;});
audio.addEventListener("waiting",()=>{state.loading=true;updatePlayer();});
audio.addEventListener("playing",()=>{state.loading=false;updatePlayer();});
const listening=createListeningPlayer({SONG,Assets,onOpen:stop,showChinese:()=>state.chinese});
const practice=createPractice({SONG,Assets,onOpen:()=>{stop();listening.stop();}});
buildCards();updateSettings();updatePlayer();
Assets.subscribe(({ready,total,failed,active,queued})=>{
 $("asset-progress").max=total;$("asset-progress").value=ready;
 const finished=ready===total;
 $("asset-prepare").classList.toggle("ready",finished);
 $("asset-status").textContent=finished?"图片和声音已准备好":failed&&!active&&!queued?"部分资源暂未准备好，点图片或歌词可重试":"正在准备图片和声音（"+ready+"/"+total+"）…";
});
Assets.prefetch([
 SONG.cards[0].image,SONG.cards[1].image,SONG.cards[0].spoken,SONG.lines[0].audio,SONG.fullSong.audio,
 ...SONG.cards.flatMap(card=>[card.image,card.spoken]),...SONG.lines.map(line=>line.audio),KARAOKE_PATH
]);
