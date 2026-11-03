// Non-modal help: no storage, tracking, backdrop or focus trap.
export function createGuide({document, onOpen = () => {}}) {
 const panel=document.getElementById('guide'), button=document.getElementById('guide-button');
 const title=document.getElementById('guide-title'), settings=document.getElementById('settings');
 const settingsButton=document.getElementById('settings-button'), listeners=[];
 const listen=(node,type,fn,capture=false)=>{node.addEventListener(type,fn,capture);listeners.push(()=>node.removeEventListener(type,fn,capture));};
 function close({restoreFocus=false}={}) {
  if(panel.hidden)return;
  const focused=panel.contains(document.activeElement);
  panel.hidden=true;button.setAttribute('aria-expanded','false');
  if(restoreFocus||focused)button.focus({preventScroll:true});
 }
 function open() {
  settings.hidden=true;settingsButton.setAttribute('aria-expanded','false');
  panel.hidden=false;button.setAttribute('aria-expanded','true');onOpen();
  title.focus({preventScroll:true});
 }
 listen(button,'click',()=>panel.hidden?open():close({restoreFocus:true}));
 for(const id of ['close-guide','guide-done'])listen(document.getElementById(id),'click',()=>close({restoreFocus:true}));
 listen(settingsButton,'click',()=>close());
 for(const node of document.querySelectorAll('[data-view],#walk-shortcut,#walk-button'))listen(node,'click',()=>close());
 // Registered before walking controls: Escape closes help first; reading the
 // panel with arrow keys must scroll the panel rather than move the camera.
 listen(document.defaultView,'keydown',event=>{
  if(panel.hidden)return;
  if(event.key==='Escape'){
   event.preventDefault();event.stopImmediatePropagation();close({restoreFocus:true});
  }else if(panel.contains(event.target)&&/^(Arrow(Up|Down|Left|Right)|Key[WASD])$/.test(event.code)){
   event.stopImmediatePropagation();
  }
 },true);
 // The HTML is initially visible, without moving focus away from the page.
 button.setAttribute('aria-expanded',String(!panel.hidden));
 return {open,close,dispose(){for(const remove of listeners)remove();}};
}
