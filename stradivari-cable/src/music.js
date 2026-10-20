export function createMusic(){
 const audio=document.createElement('audio');audio.preload='none';audio.dataset.cableMusic='true';audio.hidden=true;document.body.append(audio);
 const panel=document.createElement('section');panel.className='cable-music';panel.setAttribute('aria-label','Music');
 panel.innerHTML='<p>Gymnopédie No. 1</p><div class="music-actions"><button type="button" data-music="toggle" aria-pressed="false">Music: Off · Turn on</button><button type="button" data-music="mute" aria-pressed="false" disabled>Mute</button></div><p role="status" aria-live="polite">Music starts only when you choose.</p>';
 document.querySelector('aside h2').after(panel);
 const toggle=panel.querySelector('[data-music=toggle]'),mute=panel.querySelector('[data-music=mute]'),status=panel.querySelector('[role=status]');
 let wanted=false,failed=false,generation=0;
 function update(message){
  toggle.textContent=failed?'Retry music':wanted?'Music: On · Turn off':'Music: Off · Turn on';toggle.setAttribute('aria-pressed',String(wanted));
  mute.textContent=audio.muted?'Unmute':'Mute';mute.setAttribute('aria-pressed',String(audio.muted));mute.disabled=!wanted;
  if(message)status.textContent=message;
 }
 function fail(id){if(id!==generation||!wanted)return;wanted=false;failed=true;audio.pause();update('Music unavailable. You can continue the tour or retry music.');}
 function off(){generation++;wanted=false;failed=false;audio.pause();update('Music off.');}
 function play(){
  const id=++generation;wanted=true;failed=false;
  if(!audio.getAttribute('src'))audio.src='/_assets/a54488a8b9d5aaa8e2462023e58c0ea301dd3c39947a84220f478d5c03ecf526/gymnopedie-no-1.mp3';
  update('Loading music…');
  try{const result=audio.play();Promise.resolve(result).then(()=>{if(id!==generation){if(!wanted)audio.pause();return;}update(audio.muted?'Music on, muted.':'Music on.');}).catch(()=>fail(id));}catch{fail(id);}
 }
 audio.addEventListener('error',()=>fail(generation));audio.addEventListener('ended',()=>{wanted=false;update('Music finished. Turn on to listen again.');});
 toggle.onclick=()=>wanted?off():play();mute.onclick=()=>{audio.muted=!audio.muted;update(audio.muted?'Music on, muted.':'Music on.');};
 window.__cableMusic={inspect:()=>({wanted,failed,paused:audio.paused,muted:audio.muted,currentTime:audio.currentTime,readyState:audio.readyState,src:audio.getAttribute('src')}),play,off};
 return {play,off};
}
