// Local prototype: microphone audio never leaves this browser. No analytics or upload.
const DB_NAME='remember-me-student-overdub-v1';
const fmt=n=>Math.floor(Math.max(0,n)/60)+':'+String(Math.floor(Math.max(0,n)%60)).padStart(2,'0');
export const KARAOKE_PATH='assets/video/remember-me-karaoke.mp4';
const busyModes=new Set(['preparing','countdown','recording','processing','exporting']);
export function createPractice({SONG,Assets,onOpen}){
 const target={id:'full',text:SONG.title,audio:SONG.fullSong.audio,duration:SONG.fullSong.duration};
 const takes=new Map(),buffers=new Map();
 let db=null,context=null,compressor=null,mode='idle',take=null,draft=null,voiceBuffer=null,videoNode=null,videoReady=null;
 let run=0,stream=null,recorder=null,voiceSource=null,musicGain=null,voiceGain=null,analyser=null,micNode=null;
 let recStart=0,lead=0,recordedSpan=0,frame=null;
 let mixOffset=0,mixDuration=0,shift=0,previousFocus=null,storageWarning='',recordStarted=false;
 let voiceAnchorTime=0,voiceAnchorContext=0,videoWaiting=false,ignoredPauseEvents=0;
 let originalLevel=.35,voiceLevel=1,monitorLevel=.35;
 const dialog=document.createElement('dialog');dialog.className='practice-dialog';dialog.lang='zh-CN';dialog.setAttribute('aria-labelledby','practice-title');
 dialog.innerHTML=`<div class="practice-head"><div><small>整首歌录唱</small><h2 id="practice-title">和原唱一起唱</h2></div><button id="pr-close" aria-label="关闭录唱窗口">关闭</button></div>
 <div class="practice-body"><p class="practice-guide">① 戴上耳机　② 点「开始录音」，等 3、2、1 后看着小骷髅跟唱　③ 点「听合唱」听自己的声音和原唱一起唱。<br>请允许使用麦克风。没有耳机时，原唱可能会被麦克风重复录进去。</p>
 <div class="karaoke-stage"><video id="pr-video" playsinline webkit-playsinline preload="auto" aria-label="Remember me 卡拉 OK 视频"></video><div id="pr-countdown" class="video-countdown" hidden></div></div>
 <p id="pr-status" class="practice-status" role="status" aria-live="polite"></p>
 <div class="practice-clock-row"><span id="pr-clock">0:00</span><progress id="pr-progress" value="0" max="1" aria-label="录唱进度"></progress><span id="pr-total">0:00</span></div>
 <div id="pr-meter-box" class="mic-meter" hidden><span>麦克风</span><meter id="pr-meter" min="0" max="1" value="0" aria-label="麦克风音量"></meter></div>
 <div class="practice-actions"><button id="pr-record" class="primary">● 开始录音</button><button id="pr-stop" hidden>■ 停止录音</button><button id="pr-cancel" hidden>取消</button><button id="pr-play" class="green" hidden>▶ 听合唱</button><button id="pr-save" class="primary" hidden>保留这次录音</button><button id="pr-discard" hidden>放弃这次</button></div>
 <div id="pr-take-info" class="take-info" hidden></div>
 <input id="pr-seek" class="mix-seek" type="range" min="0" max="1000" value="0" aria-label="合唱播放位置" hidden>
 <div class="mix-controls"><label for="pr-monitor">录音时原唱<input id="pr-monitor" type="range" min="0" max="100" value="35"><output id="pr-monitor-value">35%</output></label>
 <div id="pr-review-controls" hidden><label for="pr-original">回放原唱<input id="pr-original" type="range" min="0" max="100" value="35"><output id="pr-original-value">35%</output></label><label for="pr-voice" style="margin-top:14px">我的声音<input id="pr-voice" type="range" min="0" max="200" value="100"><output id="pr-voice-value">100%</output></label>
 <details class="timing-help"><summary>声音对不上？调整时间</summary><p>耳机或设备可能带来延迟。如果你的声音听起来晚了，点「提前」。只移动你的声音，不改变原唱。</p><div class="timing-actions"><button id="pr-earlier">提前 0.05 秒</button><output id="pr-shift">0.00 秒</output><button id="pr-later">延后 0.05 秒</button><button id="pr-reset">重置</button></div></details>
 <div class="practice-actions"><button id="pr-download">下载合唱 WAV</button><button id="pr-delete">删除已保留的录音</button></div></div></div>
 <p class="practice-footer">只录整首歌。录音只保存在当前设备、当前浏览器中。换设备、清理浏览器数据或更换本地网址后可能无法找回，请下载想保留的合唱。重录后可先试听，再决定是否替换之前保留的录音。</p></div>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#pr-'+id);
 const video=$('video');
 const status=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
 const current=()=>draft||take;
 function setMode(value){mode=value;render();}
 function render(){
  const busy=busyModes.has(mode),review=!!current()&&!!voiceBuffer;
  dialog.classList.toggle('recording',mode==='recording');
  $('record').hidden=busy||!!draft;$('record').textContent=take?'● 重新录音':'● 开始录音';
  $('stop').hidden=mode!=='recording';$('cancel').hidden=!['preparing','countdown'].includes(mode);
  $('play').hidden=!review||busy;$('play').textContent=mode==='playing'?'Ⅱ 暂停合唱':'▶ 听合唱';
  $('save').hidden=!draft||busy;$('discard').hidden=!draft||busy;
  $('meter-box').hidden=!['countdown','recording'].includes(mode);
  $('review-controls').hidden=!review||busy;$('review-controls').inert=busy;
  $('seek').hidden=!review||busy;
  $('delete').hidden=!take||!!draft;
  $('close').disabled=['processing','exporting'].includes(mode);
  $('take-info').hidden=!current()||busy;
  if(current()){
   const c=current(),partial=c.span<target.duration-.7;
   $('take-info').textContent=(draft?'这次录音尚未保留':'已保留在此浏览器')+' · '+(partial?'录到 '+fmt(c.span)+' / '+fmt(target.duration):'已录完整')+(storageWarning?' · '+storageWarning:'');
  }
 }
 function progress(seconds,total){$('clock').textContent=fmt(seconds);$('total').textContent=fmt(total);$('progress').max=total||1;$('progress').value=Math.min(seconds,total);$('seek').value=String(total?Math.round(seconds/total*1000):0);}
 function initAudio(){
  if(!context){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('这个浏览器不支持录唱，请使用新版 Chrome 或 Safari。');context=new AC();compressor=context.createDynamicsCompressor();compressor.threshold.value=-6;compressor.knee.value=6;compressor.ratio.value=12;compressor.attack.value=.003;compressor.release.value=.2;compressor.connect(context.destination);context.addEventListener('statechange',()=>{if(context.state!=='running'&&mode==='recording')finishRecording('播放被设备暂停，已结束这次录音。');});}
  if(!videoNode){videoNode=context.createMediaElementSource(video);musicGain=context.createGain();musicGain.gain.value=0;videoNode.connect(musicGain);musicGain.connect(compressor);}
  return context.resume();
 }
 async function loadVideo(){
  if(!videoReady)videoReady=(async()=>{const url=await Assets.getBlobUrl(KARAOKE_PATH,{priority:true})||Assets.originUrl(KARAOKE_PATH);await new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',loaded);video.removeEventListener('error',failed);};const loaded=()=>{done();resolve();};const failed=()=>{done();reject(new Error('卡拉 OK 视频暂时无法加载，请关闭窗口后重试。'));};const timer=setTimeout(failed,25000);video.addEventListener('loadeddata',loaded);video.addEventListener('error',failed);video.src=url;video.load();});})();
  try{await videoReady;}catch(e){videoReady=null;throw e;}
 }
 async function loadMusic(t=target){if(buffers.has(t.id))return buffers.get(t.id);const url=await Assets.getBlobUrl(t.audio,{priority:true})||Assets.url(t.audio);const res=await fetch(url);if(!res.ok)throw new Error('原唱暂时无法加载，请重试。');const b=await context.decodeAudioData(await res.arrayBuffer());buffers.set(t.id,b);return b;}
 const dbReady=new Promise(resolve=>{
  try{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore('takes',{keyPath:'id'});req.onsuccess=()=>{db=req.result;db.onversionchange=()=>db.close();const r=db.transaction('takes').objectStore('takes').getAll();r.onsuccess=()=>{for(const t of r.result)takes.set(t.id,t);resolve();updateBadges();};r.onerror=()=>{storageWarning='暂时无法读取本地录音';resolve();};};req.onerror=()=>{storageWarning='浏览器不允许保存，关闭页面前请下载';resolve();};}catch{storageWarning='浏览器不允许保存，关闭页面前请下载';resolve();}
 });
 async function writeTake(value){if(!db)throw new Error('本地保存不可用');await new Promise((resolve,reject)=>{const tx=db.transaction('takes','readwrite');tx.objectStore('takes').put(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
 async function deleteTake(id){if(db)await new Promise((resolve,reject)=>{const tx=db.transaction('takes','readwrite');tx.objectStore('takes').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});takes.delete(id);updateBadges();}
 function updateBadges(){const b=document.getElementById('record-full');b?.classList.toggle('has-take',takes.has('full'));if(b)b.textContent=takes.has('full')?'● 听 / 重录整首歌':'● 录整首歌';}
 async function prepare(){
  const token=++run;stopMix();take=null;draft=null;voiceBuffer=null;shift=0;mixOffset=0;setShift(0,false);progress(0,target.duration);setMode('preparing');status('正在准备卡拉 OK 视频…');
  try{await Promise.all([dbReady,loadVideo()]);}catch(e){if(token!==run)return;setMode('idle');$('record').disabled=true;status(e.message,true);return;}if(token!==run)return;
  video.currentTime=0;$('record').disabled=false;
  take=takes.get(target.id)||null;
  if(take){try{await initAudio();const b=await context.decodeAudioData(await take.blob.arrayBuffer());if(token!==run)return;voiceBuffer=b;shift=take.shift||0;setShift(shift,false);}catch{status('这段录音无法读取。可以重新录音。',true);setMode('idle');return;}}
  if(token!==run)return;setMode(take?'review':'idle');status(take?'上次的录音还在。点「听合唱」，或重新录一次。':'准备好后，点「开始录音」。'+storageWarning);updateBadges();
 }
 function stopVoice(){if(voiceSource){try{voiceSource.stop();}catch{}voiceSource.disconnect();voiceSource=null;}voiceGain?.disconnect();voiceGain=null;}
 function pauseVideo(){if(!video.paused){ignoredPauseEvents++;video.pause();}}
 function stopSources(){stopVoice();pauseVideo();if(musicGain)musicGain.gain.value=0;}
 function stopFrame(){cancelAnimationFrame(frame);frame=null;}
 function stopMix(){if(mode==='playing'){mixOffset=Math.min(mixDuration,video.currentTime);setMode('review');}stopSources();stopFrame();}
 function releaseMic(){stream?.getTracks().forEach(t=>t.stop());stream=null;micNode?.disconnect();micNode=null;analyser?.disconnect();analyser=null;$('meter').value=0;}
 function meterTick(){if(!analyser)return;const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);let sum=0;for(const v of data)sum+=v*v;$('meter').value=Math.min(1,Math.sqrt(sum/data.length)*5);}
 function recordingTick(){meterTick();if(mode==='recording'){progress(video.currentTime,target.duration);if(video.currentTime>=target.duration)finishRecording();}if(['countdown','recording'].includes(mode))frame=requestAnimationFrame(recordingTick);}
 async function startRecording(){
  if(busyModes.has(mode)||draft)return;const token=++run;stopMix();mixOffset=0;recordedSpan=0;recordStarted=false;setMode('preparing');status('正在打开麦克风、准备原唱…');
  try{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('录音需要安全网址。请使用 HTTPS 网页打开。');
   if(!window.MediaRecorder)throw new Error('此浏览器不支持录音。请用新版 Chrome 或 Safari 打开。');
   // Audio unlock happens in the tap, before requesting microphone permission.
   const resumed=initAudio();
   // Prime the already-loaded video in the original tap for mobile browsers.
   musicGain.gain.value=0;const unlocked=video.play().then(()=>{if(token===run&&mode==='preparing'){pauseVideo();video.currentTime=0;}});
   unlocked.catch(()=>{});resumed.catch(()=>{}); // Permission can stay pending after a playback rejection.
   const incoming=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false,channelCount:1},video:false});
   if(token!==run){incoming.getTracks().forEach(t=>t.stop());return;}stream=incoming;await Promise.all([resumed,unlocked]);if(token!==run)return;
   micNode=context.createMediaStreamSource(stream);analyser=context.createAnalyser();analyser.fftSize=512;micNode.connect(analyser); // No microphone-to-speaker connection.
   for(const track of stream.getAudioTracks())track.addEventListener('ended',()=>{if(mode==='recording')finishRecording('麦克风已断开，保留已录部分。');});
   setMode('countdown');recordingTick();
   for(let n=3;n>0;n--){status(n+' … 准备唱');$('countdown').textContent=n;$('countdown').hidden=false;await new Promise(resolve=>setTimeout(resolve,1000));if(token!==run)return;}
   $('countdown').hidden=true;
   const types=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'];const mimeType=types.find(t=>MediaRecorder.isTypeSupported(t));
   recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);const chunks=[];
   recorder.addEventListener('dataavailable',e=>{if(e.data.size)chunks.push(e.data);});
   recorder.addEventListener('error',e=>{status('录音中断：'+(e.error?.message||'请重新试一次。'),true);finishRecording();});
   recorder.addEventListener('stop',()=>processRecording(chunks,recorder.mimeType,token),{once:true});
   recorder.start(200);recStart=context.currentTime;lead=0;
   video.currentTime=0;musicGain.gain.value=monitorLevel;setMode('recording');status('正在录音 · 看着小骷髅跟唱吧！');await video.play();
  }catch(e){if(token!==run)return;if(mode==='recording'){finishRecording('视频播放中断，请试听已录部分。');return;}releaseMic();stopSources();stopFrame();$('countdown').hidden=true;setMode(current()?'review':'idle');status(e.name==='NotAllowedError'?'麦克风或播放未获允许。请允许麦克风，再点一次「开始录音」。':e.name==='NotFoundError'?'没有找到麦克风，请连接麦克风后重试。':e.message||'无法录音，请重试。',true);}
 }
 function finishRecording(message){
  if(mode!=='recording')return;
  recordedSpan=Math.min(target.duration,video.currentTime);
  setMode('processing');stopSources();stopFrame();status(message||'正在整理你的录音…');
  if(recorder?.state!=='inactive')recorder.stop();releaseMic();
 }
 async function processRecording(chunks,mimeType,token){
  releaseMic();
  try{const blob=new Blob(chunks,{type:mimeType});if(!blob.size||recordedSpan<.3)throw new Error('录音太短，请等原唱开始后再唱一次。');const decoded=await context.decodeAudioData(await blob.arrayBuffer());if(token!==run)return;
   draft={id:target.id,blob,lead,span:recordedSpan,shift:0,created:new Date().toISOString(),mimeType};voiceBuffer=decoded;mixOffset=0;setShift(0,false);mixDuration=durationFor(draft);progress(0,mixDuration);setMode('review');status('录好了！点「听合唱」，满意后点「保留这次录音」。');
  }catch(e){if(token!==run)return;voiceBuffer=null;if(take)try{voiceBuffer=await context.decodeAudioData(await take.blob.arrayBuffer());}catch{}setMode(take?'review':'idle');status(e.message||'无法读取录音，请重新试一次。',true);}
 }
 function cancelPreparation(){if(!['preparing','countdown'].includes(mode))return;++run;releaseMic();stopSources();stopFrame();$('countdown').hidden=true;setMode(current()?'review':'idle');status('已取消，麦克风已关闭。');}
 function durationFor(c){return c.span;}
 function syncVoice(){
  if(mode!=='playing'||!current())return;stopVoice();const c=current(),offset=video.currentTime+c.lead-shift;
  voiceAnchorTime=video.currentTime;voiceAnchorContext=context.currentTime;
  if(Math.max(0,offset)>=voiceBuffer.duration)return;
  voiceGain=context.createGain();voiceGain.gain.value=voiceLevel;voiceGain.connect(compressor);voiceSource=context.createBufferSource();voiceSource.buffer=voiceBuffer;voiceSource.connect(voiceGain);
  voiceSource.start(context.currentTime+Math.max(0,-offset),Math.max(0,offset));
 }
 async function playMix(position=mixOffset){
  if(busyModes.has(mode)||!current()||!voiceBuffer)return;const token=++run;stopMix();
  try{await initAudio();if(token!==run)return;const c=current();mixDuration=durationFor(c);mixOffset=position>=mixDuration-.05?0:Math.max(0,position);video.currentTime=mixOffset;musicGain.gain.value=originalLevel;
   setMode('playing');status(draft?'正在听合唱 · 试听后可以保留这次录音。':'正在听你和原唱一起唱。');await video.play();if(token!==run)return;
   const tick=()=>{if(mode!=='playing')return;const p=video.currentTime;progress(p,mixDuration);if(p>=mixDuration){endReplay();return;}if(!videoWaiting&&!video.paused&&!video.seeking&&Math.abs(p-(voiceAnchorTime+context.currentTime-voiceAnchorContext))>.12)syncVoice();frame=requestAnimationFrame(tick);};tick();
  }catch(e){if(token!==run||mode!=='playing')return;setMode('review');stopSources();status('暂时无法回放，请再点一次「听合唱」。',true);}
 }
 async function saveDraft(){if(!draft)return;stopMix();setMode('processing');status('正在保留…');const value={...draft,shift};try{await writeTake(value);storageWarning='';takes.set(value.id,value);take=value;draft=null;updateBadges();setMode('review');status('已保留！下次用这个浏览器打开，还能听到。');}catch{setMode('review');status('未能保存在浏览器中。录音还在本页，请先下载合唱，避免丢失。',true);}}
 async function discardDraft(){if(!draft)return;stopMix();draft=null;voiceBuffer=null;mixOffset=0;if(take){setMode('processing');try{voiceBuffer=await context.decodeAudioData(await take.blob.arrayBuffer());}catch{}setShift(take.shift||0,false);}setMode(take?'review':'idle');progress(0,target.duration);status(take?'已放弃这次，之前保留的录音还在。':'已放弃这次录音，可以重新唱。');}
 function setShift(value,persist=true){shift=Math.max(-.75,Math.min(.75,Math.round(value*100)/100));$('shift').textContent=(shift>0?'+':'')+shift.toFixed(2)+' 秒';if(draft)draft.shift=shift;else if(take){take.shift=shift;if(persist)writeTake(take).catch(()=>status('时间调整暂未保存，请下载合唱保留效果。',true));}if(mode==='playing')syncVoice();}
 async function downloadMix(){
  if(!current()||!voiceBuffer||busyModes.has(mode))return;stopMix();setMode('exporting');status('正在生成合唱文件…');
  try{const original=await loadMusic(),c=current(),length=durationFor(c),off=new OfflineAudioContext(2,Math.ceil(length*44100),44100),lim=off.createDynamicsCompressor();lim.threshold.value=-6;lim.knee.value=6;lim.ratio.value=12;lim.attack.value=.003;lim.release.value=.2;lim.connect(off.destination);
   const add=(b,gain,when,offset,duration)=>{const s=off.createBufferSource(),g=off.createGain();s.buffer=b;g.gain.value=gain;s.connect(g);g.connect(lim);s.start(when,offset,duration);};
   add(original,originalLevel,0,0,Math.min(c.span,original.duration));const voiceOffset=c.lead-shift;add(voiceBuffer,voiceLevel,Math.max(0,-voiceOffset),Math.max(0,voiceOffset));
   const rendered=await off.startRendering(),blob=wav(rendered),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='remember-me-'+target.id+'-my-duet.wav';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);setMode('review');status('合唱文件已生成，包含你的声音和当前音量、时间调整。');
  }catch(e){setMode('review');status('下载失败：'+e.message,true);}
 }
 function wav(buffer){const channels=buffer.numberOfChannels,length=buffer.length,ab=new ArrayBuffer(44+length*channels*2),v=new DataView(ab);const str=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,ab.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,length*channels*2,true);const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let p=44;for(let i=0;i<length;i++)for(let c=0;c<channels;c++,p+=2){const n=Math.max(-1,Math.min(1,data[c][i]));v.setInt16(p,n<0?n*32768:n*32767,true);}return new Blob([ab],{type:'audio/wav'});}
 function close(){if(mode==='recording'){finishRecording('已停止录音，试听后再关闭。');return;}if(['preparing','countdown'].includes(mode))cancelPreparation();if(['processing','exporting'].includes(mode))return;if(draft){status('这次录音还没有保留。请先选「保留这次录音」或「放弃这次」。',true);return;}++run;stopMix();releaseMic();dialog.close();previousFocus?.focus();}
 $('record').addEventListener('click',startRecording);$('stop').addEventListener('click',()=>finishRecording());$('cancel').addEventListener('click',cancelPreparation);$('close').addEventListener('click',close);
 $('play').addEventListener('click',()=>{if(mode==='playing'){stopMix();status('已暂停合唱。');}else playMix();});
 $('save').addEventListener('click',saveDraft);$('discard').addEventListener('click',discardDraft);$('download').addEventListener('click',downloadMix);
 $('seek').addEventListener('input',()=>{const playing=mode==='playing';stopMix();mixOffset=Number($('seek').value)/1000*durationFor(current());progress(mixOffset,durationFor(current()));if(playing)playMix(mixOffset);});
 for(const [id,setter]of [['original',v=>{originalLevel=v;if(musicGain&&mode==='playing')musicGain.gain.setTargetAtTime(v,context.currentTime,.02);}],['voice',v=>{voiceLevel=v;if(voiceGain)voiceGain.gain.setTargetAtTime(v,context.currentTime,.02);}],['monitor',v=>{monitorLevel=v;if(musicGain&&mode==='recording')musicGain.gain.setTargetAtTime(v,context.currentTime,.02);}]])$(id).addEventListener('input',()=>{const val=Number($(id).value);$(id+'-value').textContent=val+'%';setter(val/100);});
 $('earlier').addEventListener('click',()=>setShift(shift-.05));$('later').addEventListener('click',()=>setShift(shift+.05));$('reset').addEventListener('click',()=>setShift(0));
 $('delete').addEventListener('click',async()=>{if(!take||draft)return;if(!confirm('删除这一段在此浏览器中保留的录音？'))return;try{await deleteTake(target.id);stopMix();take=null;voiceBuffer=null;mixOffset=0;setMode('idle');progress(0,target.duration);status('已删除这段录音。');}catch{status('删除失败，请重试。',true);}});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(mode==='recording')finishRecording('页面转到后台，已停止并保留已录部分，请试听。');else if(['preparing','countdown'].includes(mode))cancelPreparation();else if(mode==='playing')stopMix();}});
 window.addEventListener('pagehide',()=>{releaseMic();stopSources();});
 window.addEventListener('beforeunload',e=>{if(draft||busyModes.has(mode)){e.preventDefault();e.returnValue='';}});
 function endReplay(){if(mode!=='playing')return;setMode('review');stopSources();stopFrame();mixOffset=0;status('听完了！可以再听一次，或重新录音。');}
 video.addEventListener('playing',()=>{videoWaiting=false;if(mode==='recording'&&!recordStarted){lead=Math.max(0,context.currentTime-recStart-video.currentTime);recordStarted=true;}else if(mode==='playing')syncVoice();});
 video.addEventListener('waiting',()=>{videoWaiting=true;if(mode==='recording'&&recordStarted)finishRecording('视频被暂停，已保留录下的部分。');else if(mode==='playing')stopVoice();});
 video.addEventListener('pause',()=>{if(ignoredPauseEvents){ignoredPauseEvents--;return;}if(!video.paused)return;if(mode==='recording'&&recordStarted)finishRecording();else if(mode==='playing'){if(video.ended)endReplay();else stopMix();}});
 video.addEventListener('ended',()=>{if(mode==='recording')finishRecording();else endReplay();});
 video.addEventListener('error',()=>{if(mode==='recording')finishRecording('视频中断，已保留录下的部分。');else if(mode==='playing'){stopMix();status('视频暂时无法播放，请重试。',true);}});
 document.getElementById('record-full').addEventListener('click',open);
 function open(){onOpen();previousFocus=document.activeElement;if(!dialog.open)dialog.showModal();prepare();}
 return {open};
}
