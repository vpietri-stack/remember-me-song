const clock=n=>Math.floor(Math.max(0,n)/60)+':'+String(Math.floor(Math.max(0,n)%60)).padStart(2,'0');
export function createListeningPlayer({SONG,Assets,onOpen,showChinese}){
 const dialog=document.createElement('dialog');dialog.className='practice-dialog listen-dialog';dialog.id='listen-dialog';dialog.lang='zh-CN';dialog.setAttribute('aria-labelledby','li-title');
 dialog.innerHTML=`<div class="practice-head"><div><small>看图 · 听歌 · 一起唱</small><h2 id="li-title">听完整歌曲</h2></div><button id="li-close">关闭</button></div><div class="practice-body"><p class="practice-guide">图片和歌词会跟着歌曲自动切换。</p><div class="practice-cue"><span id="li-count" class="practice-cue-counter"></span><div id="li-pictures" class="practice-pictures"></div><p id="li-words" class="practice-cue-words"></p><p id="li-meaning" class="listening-meaning" hidden></p></div><p id="li-status" class="practice-status" role="status" aria-live="polite"></p><div class="practice-clock-row"><span id="li-clock">0:00</span><input id="li-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="歌曲播放位置"><span id="li-total">${clock(SONG.fullSong.duration)}</span></div><div class="practice-actions"><button id="li-play" class="primary">Ⅱ 暂停</button><button id="li-restart">从头听</button></div></div>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#li-'+id),audio=new Audio();audio.preload='auto';
 const cards=new Map(SONG.cards.map(c=>[c.id,c]));let previousFocus=null,cue=null,frame=null,token=0;
 function update(){
  const t=audio.currentTime||0,d=Number.isFinite(audio.duration)?audio.duration:SONG.fullSong.duration;
  $('clock').textContent=clock(t);$('seek').value=Math.round(t/d*1000);$('total').textContent=clock(d);$('play').textContent=audio.paused?'▶ 继续听':'Ⅱ 暂停';
  let line=SONG.lines[0];for(const l of SONG.lines){if(t>=l.fullSongStart)line=l;else break;}
  if(cue!==line.id){cue=line.id;$('count').textContent='第 '+line.index+' / 13 句';$('words').textContent=line.text;$('meaning').textContent=line.zh;$('pictures').replaceChildren(...line.cards.map(id=>{const card=cards.get(id),im=document.createElement('img');im.src=Assets.url(card.image);im.alt=card.text;Assets.getBlobUrl(card.image).then(url=>{if(url)im.src=url;});return im;}));}
 }
 function tick(){update();if(dialog.open&&!audio.paused)frame=requestAnimationFrame(tick);}
 function stop(){++token;audio.pause();cancelAnimationFrame(frame);}
 function close(){stop();dialog.close();previousFocus?.focus();}
 async function play(){
  const thisToken=++token;cancelAnimationFrame(frame);try{await audio.play();if(thisToken!==token)return;$('status').textContent='跟着图片，一起唱吧！';tick();}catch(e){if(thisToken!==token||e.name==='AbortError')return;$('status').textContent='点「继续听」开始播放。';update();}
 }
 function open(){
  onOpen();stop();previousFocus=document.activeElement;cue=null;
  if(!dialog.open)dialog.showModal();$('meaning').hidden=!showChinese();audio.src=Assets.url(SONG.fullSong.audio);audio.currentTime=0;update();$('status').textContent='正在准备歌曲…';play();
  // Do not replace a playing source: that would jump back to the beginning.
  Assets.getBlobUrl(SONG.fullSong.audio,{priority:true}).catch(()=>{});
 }
 $('close').addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('play').addEventListener('click',()=>{if(audio.paused){if(audio.ended)audio.currentTime=0;play();}else{audio.pause();$('status').textContent='已暂停。';}});
 $('restart').addEventListener('click',()=>{audio.currentTime=0;play();});$('seek').addEventListener('input',()=>{audio.currentTime=Number($('seek').value)/1000*(audio.duration||SONG.fullSong.duration);update();});
 for(const event of ['loadedmetadata','timeupdate','pause','seeked'])audio.addEventListener(event,update);
 audio.addEventListener('ended',()=>{$('status').textContent='听完了！可以从头再听一次。';update();cancelAnimationFrame(frame);});
 audio.addEventListener('error',()=>{$('status').textContent='暂时无法播放，请关闭窗口后重试。';update();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&!audio.paused){audio.pause();$('status').textContent='已暂停，回来后点「继续听」。';}});
 return {open,stop};
}
