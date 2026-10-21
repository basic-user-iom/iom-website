import './guidance.css';

/** Optional help and a finite hint for the existing room/detail switch. */
export function createGuidance(stage:HTMLElement,viewToggle:HTMLButtonElement){
  const toggle=document.createElement('button');toggle.id='study-help-toggle';toggle.type='button';
  toggle.innerHTML='<span class="study-help-icon" aria-hidden="true">?</span><span>Help</span>';
  toggle.setAttribute('aria-label','Help');toggle.setAttribute('aria-controls','study-help-panel');toggle.setAttribute('aria-expanded','false');
  const panel=document.createElement('section');panel.id='study-help-panel';panel.className='study-help-panel';panel.hidden=true;
  panel.setAttribute('aria-labelledby','study-help-title');
  panel.innerHTML=`<div class="study-help-heading"><h2 id="study-help-title">Make it your own</h2><button id="study-help-close" type="button" aria-label="Close help">Close</button></div><ul><li>Choose a glaze. Adjust the pendant and under-cabinet lights independently.</li><li>In <strong>View lamp</strong>, drag to rotate; scroll or pinch to zoom. Select <strong>Back to room</strong> to return.</li><li>In <strong>Free fly</strong>, drag to look. WASD or arrows move; Q and E move down and up. On touch screens, use the move buttons and pinch to zoom.</li><li><strong>Reset</strong> restores the camera. Manual changes pause the tour; Resume continues it.</li></ul>`;
  const utility=document.createElement('div');utility.className='study-utilities';utility.append(toggle);
  const bar=document.querySelector('.stage-bottom')!;bar.after(utility);stage.append(panel);
  const close=panel.querySelector<HTMLButtonElement>('#study-help-close')!;
  let layoutFrame=0;
  function visibleArea(){
    const bounds=stage.getBoundingClientRect(),margin=innerWidth<=720?12:18,viewport=window.visualViewport;
    const top=Math.max(bounds.top+margin,(viewport?.offsetTop??0)+margin);
    const bottom=Math.min(bounds.bottom-margin,(viewport?.offsetTop??0)+(viewport?.height??innerHeight)-margin);
    return{bounds,top,bottom,height:Math.max(0,bottom-top)};
  }
  function layoutPanel(){
    if(panel.hidden)return;
    const area=visibleArea();panel.style.maxHeight=`${area.height}px`;
    panel.style.top=`${Math.max(area.top,area.bottom-panel.offsetHeight)-area.bounds.top}px`;
  }
  function queueLayout(){if(panel.hidden)return;cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(layoutPanel);}
  function setOpen(open:boolean){
    panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
    if(open){
      // The trigger sits below the canvas; reveal enough canvas for the overlay on short screens.
      if(visibleArea().height<Math.min(300,stage.clientHeight-36))stage.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      layoutPanel();close.focus({preventScroll:true});
    }else{cancelAnimationFrame(layoutFrame);toggle.focus();}
  }
  const toggleHelp=()=>setOpen(panel.hidden),closeHelp=()=>setOpen(false);
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();setOpen(false);}};
  toggle.addEventListener('click',toggleHelp);close.addEventListener('click',closeHelp);document.addEventListener('keydown',key,true);
  window.addEventListener('resize',queueLayout);window.addEventListener('scroll',queueLayout,{passive:true});
  window.visualViewport?.addEventListener('resize',queueLayout);window.visualViewport?.addEventListener('scroll',queueLayout);
  let previous='',pulseFrame=0;
  const stop=()=>{cancelAnimationFrame(pulseFrame);viewToggle.classList.remove('view-discovery-pulse');};
  for(const event of ['pointerdown','focus','animationend'])viewToggle.addEventListener(event,stop);
  return{
    setView(mode:'room'|'lamp',enabled:boolean){
      const key=`${enabled?'manual':'off'}:${mode}`;if(key===previous)return;previous=key;stop();
      if(enabled&&!matchMedia('(prefers-reduced-motion: reduce)').matches)pulseFrame=requestAnimationFrame(()=>viewToggle.classList.add('view-discovery-pulse'));
    },
    snapshot:()=>({open:!panel.hidden,pulsing:viewToggle.classList.contains('view-discovery-pulse')}),
    dispose(){stop();cancelAnimationFrame(layoutFrame);for(const event of ['pointerdown','focus','animationend'])viewToggle.removeEventListener(event,stop);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',queueLayout);window.removeEventListener('scroll',queueLayout);window.visualViewport?.removeEventListener('resize',queueLayout);window.visualViewport?.removeEventListener('scroll',queueLayout);utility.remove();panel.remove();}
  };
}
