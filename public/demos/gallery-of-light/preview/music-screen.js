import { createMusicVisualizer } from './music-visualizer.js';

/** Connect the cinema artwork to real music, reversible lighting and controls. */
export function createMusicScreen({scene,galleryModel,renderer,getStudies,player,focus,pauseTour,viewport}) {
  const artworks={
    'music-screen':createMusicVisualizer({scene,galleryModel,renderer}),
  };
  const state={requested:0,amount:0,ready:true,screen:'music-screen',analysis:{},artwork:artworks['music-screen'].state,screens:Object.fromEntries(Object.entries(artworks).map(([id,artwork])=>[id,artwork.state]))};
  const listeners=[],buttons=[];
  let disposed=false,lastTime=null;
  function setAmount(value,screen='music-screen'){
    state.requested=Math.min(1,Math.max(0,Number(value)||0));
    if(state.requested>0&&artworks[screen]){state.screen=screen;state.artwork=artworks[screen].state;}
    sync();
  }
  function sync(){for(const button of buttons){const active=state.requested>.001;button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',active?'Show still image on music screen':'Play music screen');button.textContent=active?'Show still image':'Music screen';}}
  function open(){
    if(state.requested>.001){pauseTour();setAmount(0);return;}
    show();
  }
  function show(screen='music-screen'){
    if(!artworks[screen])return;
    pauseTour();focus(screen);setAmount(1,screen);
    // Keep this call within the button gesture; a paused or blocked soundtrack
    // must not be unlocked by an animation-frame callback later in the tour.
    void player.play();
  }
  function button(parent,before,id){
    const element=document.createElement('button');element.id=id;element.type='button';element.dataset.preserveTour='';element.setAttribute('aria-label','Toggle music screen');
    parent.insertBefore(element,before);element.addEventListener('click',open);listeners.push(()=>element.removeEventListener('click',open));buttons.push(element);return element;
  }
  const interior=document.getElementById('interior');
  if(interior)button(interior.parentElement,interior.nextSibling,'music-screen-view');
  const mixer=document.getElementById('soundtrack-mixer-body');
  if(mixer){
    const control=button(mixer,mixer.querySelector('.soundtrack-stems'),'soundtrack-screen');control.className='soundtrack-screen';
  }
  sync();
  return {
    state,get cameraPose(){return artworks[state.screen].cameraPose;},getCameraPose:id=>artworks[id]?.cameraPose,setAmount,open,show,
    capture:()=>({amount:state.requested,screen:state.screen}),restore:value=>typeof value==='object'&&value?setAmount(value.amount,value.screen):setAmount(value),
    update(seconds){
      if(disposed)return;
      const delta=lastTime===null?0:Math.min(.1,Math.max(0,seconds-lastTime));lastTime=seconds;
      state.amount+=(state.requested-state.amount)*(1-Math.exp(-delta*2.5));
      if(Math.abs(state.requested-state.amount)<.0005)state.amount=state.requested;
      const analysis=player.getAnalysis?.()??{bass:0,mid:0,treble:0,energy:0,playing:false};state.analysis=analysis;
      getStudies()?.setCinemaAmount?.(state.amount);
      for(const[id,artwork]of Object.entries(artworks))artwork.update(seconds,analysis,id===state.screen?state.amount:0);
    },
    dispose(){if(disposed)return;disposed=true;getStudies()?.setCinemaAmount?.(0);listeners.forEach(remove=>remove());buttons.forEach(button=>button.remove());Object.values(artworks).forEach(artwork=>artwork.dispose());},
  };
}
