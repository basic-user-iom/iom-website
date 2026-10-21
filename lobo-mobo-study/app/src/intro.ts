import './intro.css';

type Choice='tour'|'explore'|'manual';
type Phase='loading'|'ready'|'fallback';
export function createIntro(api:{stage:HTMLElement;automatic:()=>void;explore:()=>void;onDismiss:()=>void}){
  const root=document.createElement('section');
  root.id='intro-screen';root.className='welcome-screen';root.hidden=true;
  root.setAttribute('aria-labelledby','welcome-title');
  root.innerHTML=`<div class="welcome-copy"><p class="welcome-eyebrow">LOBO ATELIER / MOBO</p><h2 id="welcome-title">Form, finish<br>and light.</h2><p class="welcome-description">Discover the collection through a guided journey,<br class="welcome-break"> or take your own look around.</p><div class="welcome-actions"><button id="intro-tour" type="button">Automatic tour</button><button id="intro-explore" type="button">Explore freely</button></div><p class="welcome-note">The automatic tour includes music.</p></div>`;
  api.stage.prepend(root);
  let dismissed=false,choice:Choice|null=null,phase:Phase='loading',timer:ReturnType<typeof setTimeout>|undefined;
  function dismiss(next:Choice){
    if(dismissed)return;
    dismissed=true;choice=next;root.dataset.state='leaving';api.onDismiss();
    // Move focus before hiding the dismissed panel from assistive technology.
    if(root.contains(document.activeElement))api.stage.querySelector<HTMLCanvasElement>('canvas')?.focus({preventScroll:true});
    root.setAttribute('aria-hidden','true');
    root.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.tabIndex=-1);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)root.hidden=true;
    else timer=setTimeout(()=>{root.hidden=true;},350);
  }
  const automatic=()=>{if(phase!=='ready'||dismissed)return;dismiss('tour');api.automatic();};
  const explore=()=>{if(phase!=='ready'||dismissed)return;dismiss('explore');api.explore();};
  root.querySelector('#intro-tour')!.addEventListener('click',automatic);
  root.querySelector('#intro-explore')!.addEventListener('click',explore);
  const existingInteraction=(event:Event)=>{
    if(dismissed||phase!=='ready')return;
    if(event instanceof KeyboardEvent&&['Tab','Shift','Control','Alt','Meta'].includes(event.key))return;
    const target=event.target as HTMLElement;
    if(target.closest('#tour-start'))dismiss('tour');
    else if(target.closest('.controls,#canvas-host,#explore-pad'))dismiss('manual');
  };
  for(const event of ['pointerdown','keydown','click','input'])document.addEventListener(event,existingInteraction,true);
  return{
    setPhase(next:Phase){phase=next;root.hidden=dismissed||phase!=='ready';},
    snapshot:()=>({active:!dismissed&&phase==='ready',dismissed,choice,phase}),
    dispose(){clearTimeout(timer);for(const event of ['pointerdown','keydown','click','input'])document.removeEventListener(event,existingInteraction,true);root.remove();}
  };
}
