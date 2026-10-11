// Match the other IOM demos: return to the originating project card rather
// than browser history, which can lead to an unrelated section or website.
const key='iom:returnCard',gallery='gallery-of-light';
let stored=null;
try {
  const raw=sessionStorage.getItem(key);
  const candidate=raw?.startsWith('{')?JSON.parse(raw):raw?{projectId:raw}:null;
  if(candidate&&[gallery,'case-study-gallery-of-light'].includes(candidate.projectId))stored=candidate;
} catch { /* Return links still work when storage is unavailable. */ }
const origin='https://iobjectm.com',card=stored?.projectId??gallery;
for(const link of document.querySelectorAll('.gallery-return-link')){
  link.href=`${origin}/#${card}`;
  link.addEventListener('click',event=>{
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    try {
      sessionStorage.setItem(key,JSON.stringify(stored??{projectId:gallery,section:'3d',at:Date.now()}));
    } catch { /* A normal anchor is sufficient without storage. */ }
    // A demo opened in its own tab can return to the already-open IOM page.
    if(window.opener&&!window.opener.closed){
      event.preventDefault();window.close();
      setTimeout(()=>{if(!window.closed)location.assign(link.href);},100);
    }
  });
}
