import * as THREE from 'three';

const WEBSITE='https://iobjectm.com/#experiments';

/** A real website preview on the second projection screen, with an explicit
 * browsing action. IOM currently permits framing only on its own origin. */
export function createWebsiteScreen({scene,galleryModel,camera,canvas,viewport,pauseTour,getOccluders}){
  const source=galleryModel.getObjectByName('runtime_second_wing_screen');
  if(!source)throw new Error('The second gallery screen is unavailable');
  galleryModel.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const width=size.z-.24,height=size.y-.28,x=bounds.min.x-.014,y=bounds.min.y+.08+height/2;
  const canEmbed=location.origin===new URL(WEBSITE).origin;
  const state={ready:false,selected:false,url:WEBSITE,mode:canEmbed?'embedded':'external',dialogOpen:false,disposed:false,
    preview:'../assets/website/iom-website.webp',source:source.name,position:[x,y,center.z],width,height,
    iframeLoaded:false,extraTriangles:2,extraLights:0};

  // The preview is a normal depth-tested surface: walls and sculptures occlude
  // it, including in reflections. No DOM layer is drawn through the building.
  const imageCanvas=document.createElement('canvas');imageCanvas.width=1600;imageCanvas.height=Math.round(1600*height/width);
  const ctx=imageCanvas.getContext('2d');
  ctx.fillStyle='#0c1011';ctx.fillRect(0,0,imageCanvas.width,imageCanvas.height);
  ctx.fillStyle='#edece7';ctx.font='54px Georgia';ctx.fillText('IOM',74,125);
  ctx.font='28px Arial';ctx.fillText('Experiments',74,178);
  ctx.font='20px Arial';ctx.fillText('iobjectm.com',74,imageCanvas.height-64);
  const texture=new THREE.CanvasTexture(imageCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
  const geometry=new THREE.PlaneGeometry(width,height),plane=new THREE.Mesh(geometry,material);
  plane.name='runtime_iom_website_screen';plane.rotation.y=-Math.PI/2;plane.position.set(x,y,center.z);
  plane.castShadow=false;plane.receiveShadow=false;scene.add(plane);
  const image=new Image();
  image.onload=()=>{
    if(state.disposed)return;
    ctx.fillStyle='#0c1011';ctx.fillRect(0,0,imageCanvas.width,imageCanvas.height);
    const scale=Math.min(imageCanvas.width/image.naturalWidth,imageCanvas.height/image.naturalHeight);
    const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    ctx.drawImage(image,(imageCanvas.width-w)/2,(imageCanvas.height-h)/2,w,h);
    texture.needsUpdate=true;state.ready=true;
  };
  image.onerror=()=>{state.ready=true;state.previewFallback=true;};image.src=state.preview;

  const action=document.createElement('a');action.id='website-screen-open';action.className='website-screen-action';
  action.href=WEBSITE;action.target='_blank';action.rel='noopener noreferrer';action.hidden=true;
  action.textContent=canEmbed?'Browse IOM Experiments':'Open IOM Experiments ↗';
  if(canEmbed){action.setAttribute('aria-haspopup','dialog');action.setAttribute('aria-controls','website-screen-dialog');}
  viewport.append(action);
  const dialog=document.createElement('dialog');dialog.id='website-screen-dialog';dialog.className='website-screen-dialog';
  dialog.setAttribute('aria-labelledby','website-screen-title');
  dialog.innerHTML='<header class="website-screen-header"><h2 id="website-screen-title">IOM Experiments</h2><a href="https://iobjectm.com/#experiments" target="_blank" rel="noopener noreferrer">Open in new tab ↗</a><button type="button">Back to gallery</button></header><div class="website-screen-content"></div>';
  viewport.append(dialog);
  const content=dialog.querySelector('.website-screen-content'),closeButton=dialog.querySelector('button');
  let iframe=null,frameDocument=null;
  function close(){if(dialog.open)dialog.close();}
  const frameKeydown=event=>{
    if(event.key!=='Escape'||frameDocument?.fullscreenElement||frameDocument?.querySelector('dialog[open]'))return;
    event.preventDefault();event.stopPropagation();close();
  };
  // IOM's card handler normally navigates its own window. Inside this dialog,
  // intercept only an explicit gallery-entry click before that React handler so
  // a visitor cannot accidentally load a second WebGL gallery inside the first.
  const frameGalleryClick=event=>{
    if(!event.isTrusted||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target?.closest?.('a[href]');if(!link)return;
    let destination;try{destination=new URL(link.getAttribute('href'),frameDocument.baseURI);}catch{return;}
    const path=destination.pathname.replace(/\/+$/,'');
    if(destination.origin!==location.origin||!['/demos/gallery-of-light','/demos/gallery-of-light/index.html'].includes(path))return;
    event.preventDefault();event.stopImmediatePropagation();
    window.open(destination.href,'_blank','noopener,noreferrer');
  };
  function releaseFrameKeys(){frameDocument?.removeEventListener('keydown',frameKeydown,true);frameDocument?.removeEventListener('click',frameGalleryClick,true);frameDocument=null;}
  function cleanupFrame(){releaseFrameKeys();iframe?.remove();iframe=null;state.dialogOpen=false;state.iframeLoaded=false;}
  function openEmbedded(){
    if(!canEmbed||state.disposed)return;
    pauseTour();
    if(dialog.open)return;
    iframe=document.createElement('iframe');iframe.title='IOM — Experiments';
    iframe.referrerPolicy='strict-origin-when-cross-origin';
    iframe.addEventListener('load',()=>{
      state.iframeLoaded=true;
      // Initial hash scrolling can precede the site's hero/font layout. On our
      // shared origin, align the requested section once the page has settled.
      const frame=iframe;
      releaseFrameKeys();
      try{
        const doc=frame.contentDocument;
        frameDocument=doc;frameDocument?.addEventListener('keydown',frameKeydown,true);frameDocument?.addEventListener('click',frameGalleryClick,true);
        if(frame.contentWindow.location.hash!=='#experiments')return;
        Promise.resolve(doc?.fonts?.ready).then(()=>{
          if(iframe!==frame||!dialog.open)return;
          doc?.getElementById('experiments')?.scrollIntoView({block:'start',behavior:'instant'});
        }).catch(()=>{});
      }catch{/* A later navigation may be cross-origin; keep the close control. */}
    });
    iframe.src=WEBSITE;content.append(iframe);dialog.showModal();state.dialogOpen=true;
  }
  function activate(event){
    pauseTour();
    if(canEmbed){event?.preventDefault();openEmbedded();}
  }
  action.addEventListener('click',activate);closeButton.addEventListener('click',close);dialog.addEventListener('close',cleanupFrame);
  const backdrop=event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}};
  dialog.addEventListener('click',backdrop);

  // A click on the physical screen is also an action; an orbit drag is not.
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pressed=null;
  const down=event=>{pressed=event.button===0?{x:event.clientX,y:event.clientY,time:performance.now(),id:event.pointerId}:null;};
  const cancel=()=>{pressed=null;};
  const up=event=>{
    const start=pressed;pressed=null;
    if(!start||start.id!==event.pointerId||Math.hypot(event.clientX-start.x,event.clientY-start.y)>6||performance.now()-start.time>650)return;
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObject(plane,false)[0];if(!hit)return;
    const obstruction=raycaster.intersectObjects(getOccluders(),true).find(h=>{
      let object=h.object;while(object){if(!object.visible)return false;object=object.parent;}
      const mat=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;
      return mat?.visible!==false&&!(mat?.transparent&&mat.opacity<.1);
    });
    if(obstruction&&obstruction.distance<hit.distance-.025)return;
    pauseTour();if(canEmbed)openEmbedded();else window.open(WEBSITE,'_blank','noopener,noreferrer');
  };
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);
  return{state,cameraPose:{position:[x-10.3857,1.7,center.z],target:[x,2.91,center.z],fov:54,aspect:1.1},
    select(id){state.selected=id==='website-screen';action.hidden=!state.selected;if(!state.selected)close();},
    open:openEmbedded,close,
    dispose(){if(state.disposed)return;state.disposed=true;close();cleanupFrame();image.onload=image.onerror=null;
      canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);
      action.remove();dialog.remove();scene.remove(plane);texture.dispose();material.dispose();geometry.dispose();}
  };
}
