/** First-paint cover. It is present in HTML before the application starts. */
export function createLoading(){
 const root=document.getElementById('scene-loading')!;let timer:ReturnType<typeof setTimeout>|undefined;
 const hide=()=>{clearTimeout(timer);root.hidden=true;root.dataset.state='hidden';};
 return{
  start(){clearTimeout(timer);root.hidden=false;root.dataset.state='loading';},
  reveal(){clearTimeout(timer);if(matchMedia('(prefers-reduced-motion: reduce)').matches){hide();return;}root.dataset.state='leaving';timer=setTimeout(hide,620);},
  fail:hide,
  snapshot:()=>({visible:!root.hidden,state:root.dataset.state}),
  dispose(){clearTimeout(timer);}
 };
}
