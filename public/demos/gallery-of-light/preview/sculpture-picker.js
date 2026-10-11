const details={
  A:'Refraction',B001:'Wireframe',B002:'Subsurface scattering',
  C001:'Deformation',C002:'Original marble',D:'Spotlight',E:'Material lab',
  F001:'Glass and caustics',F002:'Original marble',Venus:'Aphrodite of Melos · About the artwork',Discobolus:'The Discus Thrower · About the artwork',Apollo:'Apollo Belvedere · About the artwork',Doryphoros:'The Spear Bearer · About the artwork','music-screen':'Interactive light and music','website-screen':'Interactive Object Media · Experiments',
};

/** Enhance the native navigation select without replacing its change contract. */
export function createSculpturePicker({select,viewport=null,walkButton=null}) {
  if(!select)throw new Error('A gallery view selector is required');
  const original={hidden:select.hidden,tabIndex:select.getAttribute('tabindex')};
  const label=document.querySelector(`label[for="${select.id}"]`),oldFor=label?.htmlFor;
  const wrapper=document.createElement('div');wrapper.className='sculpture-picker';
  const trigger=document.createElement('button');trigger.type='button';trigger.id='sculpture-picker-trigger';trigger.className='sculpture-picker-trigger';
  trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','sculpture-picker-list');
  const currentImage=document.createElement('img');currentImage.className='sculpture-picker-thumbnail';currentImage.alt='';currentImage.width=currentImage.height=44;currentImage.decoding='async';
  const currentCopy=document.createElement('span');currentCopy.className='sculpture-picker-copy';
  const currentLabel=document.createElement('span'),currentDetail=document.createElement('small');currentCopy.append(currentLabel,currentDetail);
  const chevron=document.createElement('span');chevron.className='sculpture-picker-chevron';chevron.textContent='⌄';chevron.setAttribute('aria-hidden','true');
  trigger.append(currentImage,currentCopy,chevron);
  const popup=document.createElement('div');popup.className='sculpture-picker-popup';popup.hidden=true;
  const heading=document.createElement('p');heading.className='sculpture-picker-heading';heading.id='sculpture-picker-heading';heading.textContent='Choose a view';
  const list=document.createElement('div');list.id='sculpture-picker-list';list.className='sculpture-picker-list';list.tabIndex=-1;list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',heading.id);
  popup.append(heading,list);wrapper.append(trigger,popup);select.after(wrapper);
  // Keep the original controls and their listeners; anchors restore their exact
  // toolbar positions after either native or in-page fullscreen.
  const pickerAnchor=document.createComment('gallery picker toolbar position');
  wrapper.before(pickerAnchor);
  const walkAnchor=walkButton?document.createComment('gallery walk toolbar position'):null;
  if(walkAnchor)walkButton.before(walkAnchor);
  const fullscreenHost=viewport?document.createElement('div'):null;
  if(fullscreenHost){fullscreenHost.id='fullscreen-navigation';fullscreenHost.hidden=true;fullscreenHost.setAttribute('role','group');fullscreenHost.setAttribute('aria-label','Gallery navigation');fullscreenHost.dataset.preserveTour='';viewport.append(fullscreenHost);}
  let options=[],activeIndex=0,fingerprint='',open=false,query='',queryTime=0,disposed=false;
  const imageURL=id=>(id==='website-screen'?'../assets/navigation/iom-website.webp':id?`../assets/navigation/${id}.webp`:'../assets/intro/gallery-interior.webp');
  const help=id=>id?details[id]??'Sculpture study':'Explore sculpture, sound and light';
  const visibleLabel=option=>option?.value?option.textContent:'Gallery overview';
  function updateActive(scroll=true){
    const active=options[activeIndex];
    options.forEach((option,index)=>option.element.classList.toggle('is-active',index===activeIndex));
    if(active){list.setAttribute('aria-activedescendant',active.element.id);if(scroll&&open)active.element.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  function positionPopup(){
    if(!open)return;
    const box=trigger.getBoundingClientRect(),visualViewport=window.visualViewport;
    const viewportTop=visualViewport?.offsetTop??0,viewportHeight=visualViewport?.height??window.innerHeight;
    const below=viewportTop+viewportHeight-box.bottom-12,above=box.top-viewportTop-12;
    const upwards=below<200&&above>below;
    popup.classList.toggle('opens-up',upwards);
    popup.style.maxHeight=`${Math.max(40,Math.min(450,upwards?above:below))}px`;
  }
  function close({focus=false}={}){
    open=false;popup.hidden=true;trigger.setAttribute('aria-expanded','false');wrapper.classList.remove('is-open');query='';
    if(focus&&!trigger.disabled)trigger.focus({preventScroll:true});
  }
  function positionFullscreen(){
    if(!fullscreenHost||fullscreenHost.hidden)return;
    const bounds=viewport.getBoundingClientRect();
    const context=viewport.querySelector('#focus-label'),exit=viewport.querySelector('#viewport-fullscreen');
    const bottoms=[context,exit].filter(element=>element&&element.getClientRects().length>0).map(element=>element.getBoundingClientRect().bottom-bounds.top);
    fullscreenHost.style.top=`${Math.max(44,...bottoms)+8}px`;
    viewport.style.setProperty('--fullscreen-navigation-bottom',`${Math.ceil(fullscreenHost.getBoundingClientRect().bottom-bounds.top)}px`);
    positionPopup();
  }
  function moveFullscreen(active){
    if(!fullscreenHost||disposed)return;
    const focused=popup.contains(document.activeElement)?trigger:document.activeElement;
    const preserveFocus=wrapper.contains(focused)||walkButton===focused;
    close();
    if(active){
      fullscreenHost.hidden=false;
      if(wrapper.parentElement!==fullscreenHost)fullscreenHost.append(wrapper);
      if(walkButton&&walkButton.parentElement!==fullscreenHost)fullscreenHost.append(walkButton);
      positionFullscreen();
    }else{
      if(wrapper.parentElement===fullscreenHost)pickerAnchor.after(wrapper);
      if(walkButton&&walkButton.parentElement===fullscreenHost)walkAnchor.after(walkButton);
      fullscreenHost.hidden=true;
      viewport.style.removeProperty('--fullscreen-navigation-bottom');
    }
    if(preserveFocus&&focused.isConnected&&!focused.closest('[inert]'))focused.focus({preventScroll:true});
  }
  const fullscreenChange=event=>moveFullscreen(Boolean(event.detail?.active));
  const fullscreenKeydown=event=>{
    if(!open)return;
    if(event.detail?.key==='Escape'){close({focus:true});event.preventDefault();}
    // Move focus back to the trigger before fullscreen calculates its tab loop.
    else if(event.detail?.key==='Tab')close({focus:true});
  };
  function show(index){
    if(trigger.disabled||!options.length)return;
    open=true;popup.hidden=false;trigger.setAttribute('aria-expanded','true');wrapper.classList.add('is-open');
    activeIndex=index??Math.max(0,options.findIndex(option=>option.value===select.value));positionPopup();list.focus({preventScroll:true});updateActive();
  }
  function choose(index){
    const option=options[index];if(!option||option.disabled)return;
    select.value=option.value;close({focus:true});sync();
    // This synchronous dispatch retains the originating click/key gesture for
    // the music screen's explicit audio activation.
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function sync(){
    if(disposed)return;
    const native=Array.from(select.options),next=JSON.stringify(native.map(option=>[option.value,option.textContent,option.disabled]));
    if(next!==fingerprint){
      fingerprint=next;list.replaceChildren();
      options=native.map((option,index)=>{
        const row=document.createElement('div');row.className='sculpture-picker-option';row.id=`sculpture-picker-option-${index}`;row.setAttribute('role','option');row.dataset.index=String(index);row.setAttribute('aria-disabled',String(option.disabled));
        const thumbnail=document.createElement('img');thumbnail.src=imageURL(option.value);thumbnail.alt='';thumbnail.className='sculpture-picker-thumbnail';thumbnail.width=thumbnail.height=44;thumbnail.loading='lazy';thumbnail.decoding='async';
        const copy=document.createElement('span');copy.className='sculpture-picker-copy';const name=document.createElement('span'),detail=document.createElement('small');name.textContent=visibleLabel(option);detail.textContent=help(option.value);copy.append(name,detail);row.append(thumbnail,copy);list.append(row);
        return{value:option.value,label:visibleLabel(option),disabled:option.disabled,element:row};
      });
    }
    trigger.disabled=select.disabled;
    if(trigger.disabled&&open)close();
    const selected=native.find(option=>option.value===select.value)??native[0];
    currentLabel.textContent=selected?.value?visibleLabel(selected):select.dataset.viewLabel||visibleLabel(selected);currentDetail.textContent=help(selected?.value??'');
    const src=imageURL(selected?.value??'');if(currentImage.getAttribute('src')!==src)currentImage.src=src;
    trigger.setAttribute('aria-label',`Choose a view: ${currentLabel.textContent}`);
    options.forEach(option=>option.element.setAttribute('aria-selected',String(option.value===select.value)));
    if(!open)activeIndex=Math.max(0,options.findIndex(option=>option.value===select.value));
    updateActive(false);
  }
  function move(direction){
    if(!options.length)return;
    for(let i=0;i<options.length;i++){
      activeIndex=(activeIndex+direction+options.length)%options.length;
      if(!options[activeIndex].disabled)break;
    }
    updateActive();
  }
  function search(key){
    const now=performance.now();query=now-queryTime>700?'':query;queryTime=now;query+=key.toLowerCase();
    if(query.length>1&&[...query].every(letter=>letter===query[0]))query=query[0];
    const matches=option=>!option.disabled&&[option.label.toLowerCase(),option.value.toLowerCase(),option.label.toLowerCase().replace(/^(sculpture|relief) /,'')].some(name=>name.startsWith(query));
    const match=options.findIndex((option,index)=>index>activeIndex&&matches(option));
    const fallback=options.findIndex(matches);
    if(match>=0||fallback>=0){activeIndex=match>=0?match:fallback;updateActive();}
  }
  function keydown(event){
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='Tab'){if(open)close();return;}
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close({focus:true});return;}
    if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();
      const wasOpen=open;if(!open)show();
      if(event.key==='Home'){activeIndex=0;updateActive();}
      else if(event.key==='End'){activeIndex=options.length-1;updateActive();}
      else if(wasOpen)move(event.key==='ArrowUp'||event.key==='ArrowLeft'?-1:1);
      return;
    }
    if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)choose(activeIndex);else show();return;}
    if(event.key.length===1){event.preventDefault();if(!open)show();search(event.key);}
  }
  const toggle=()=>open?close({focus:true}):show();
  const clickOption=event=>{const row=event.target.closest('[role="option"]');if(row&&list.contains(row))choose(Number(row.dataset.index));};
  const outside=event=>{if(open&&!wrapper.contains(event.target))close();};
  const lostFocus=event=>{if(open&&event.relatedTarget&&!wrapper.contains(event.relatedTarget))close();};
  const resize=()=>{positionFullscreen();positionPopup();};
  trigger.addEventListener('click',toggle);wrapper.addEventListener('keydown',keydown);list.addEventListener('click',clickOption);wrapper.addEventListener('focusout',lostFocus);
  document.addEventListener('pointerdown',outside);window.addEventListener('resize',resize);window.addEventListener('scroll',resize,true);window.visualViewport?.addEventListener('resize',resize);
  select.addEventListener('change',sync);
  viewport?.addEventListener('gallery:fullscreenchange',fullscreenChange);
  viewport?.addEventListener('gallery:fullscreen-keydown',fullscreenKeydown);
  const fullscreenResize=viewport&&typeof ResizeObserver==='function'?new ResizeObserver(positionFullscreen):null;
  for(const element of [fullscreenHost,viewport?.querySelector('#focus-label'),viewport?.querySelector('#viewport-fullscreen')])if(element)fullscreenResize?.observe(element);
  const observer=new MutationObserver(sync);observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled'],characterData:true});
  sync();select.hidden=true;select.tabIndex=-1;if(label)label.htmlFor=trigger.id;
  moveFullscreen(document.fullscreenElement===viewport||Boolean(viewport?.classList.contains('is-expanded')));
  return{sync,close,element:wrapper,get value(){return select.value;},dispose(){if(disposed)return;moveFullscreen(false);disposed=true;observer.disconnect();fullscreenResize?.disconnect();trigger.removeEventListener('click',toggle);wrapper.removeEventListener('keydown',keydown);list.removeEventListener('click',clickOption);wrapper.removeEventListener('focusout',lostFocus);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize);window.removeEventListener('scroll',resize,true);window.visualViewport?.removeEventListener('resize',resize);select.removeEventListener('change',sync);viewport?.removeEventListener('gallery:fullscreenchange',fullscreenChange);viewport?.removeEventListener('gallery:fullscreen-keydown',fullscreenKeydown);wrapper.remove();pickerAnchor.remove();walkAnchor?.remove();fullscreenHost?.remove();select.hidden=original.hidden;if(original.tabIndex===null)select.removeAttribute('tabindex');else select.setAttribute('tabindex',original.tabIndex);if(label)label.htmlFor=oldFor;}};
}
