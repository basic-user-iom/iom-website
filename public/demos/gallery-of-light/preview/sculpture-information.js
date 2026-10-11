import {CLASSICAL_ARTWORKS} from './classical-artworks.js';

const artworks=new Map(CLASSICAL_ARTWORKS.map(item=>[item.id,item]));
artworks.set('Doryphoros',{
  title:'Doryphoros',subtitle:'The Spear Bearer',period:'Polykleitos · Original design, c. 450 BCE',record:'KAS11',
  description:'A standing figure poised between rest and movement. The weight rests on one leg, while the shoulders and hips tilt in opposing directions.',
  look:'Follow the line from the shoulders to the hips, then compare the supporting leg with the relaxed leg. This balanced shift in the body is called contrapposto.',
  version:'You are viewing a digital scan of a plaster cast in SMK’s Royal Cast Collection, Copenhagen, based on a Roman marble version in Naples. The cast is 2.13 metres tall.',
});

/** Museum labels follow the selected sculpture, including inside fullscreen. */
export function createSculptureInformation({viewport}) {
  const button=document.createElement('button');
  button.type='button';button.id='sculpture-information';button.className='sculpture-information-button';
  button.textContent='About this sculpture';button.hidden=true;button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-controls','sculpture-information-dialog');
  const dialog=document.createElement('dialog');dialog.id='sculpture-information-dialog';dialog.className='sculpture-information-dialog';
  dialog.setAttribute('aria-labelledby','sculpture-information-title');
  dialog.innerHTML=`<div class="sculpture-information-top"><span>THE SECOND GALLERY</span><button type="button" aria-label="Close sculpture information">Close ×</button></div>
    <p class="sculpture-information-kicker" data-info="period"></p>
    <h2 id="sculpture-information-title" data-info="title"></h2><p class="sculpture-information-subtitle" data-info="subtitle"></p>
    <p data-info="description"></p>
    <details open><summary>What should I look for?</summary><p data-info="look"></p></details>
    <details><summary>About this version</summary><p data-info="version"></p></details>
    <footer><p>Scan: SMK — National Gallery of Denmark<br><span data-info="credit"></span></p><a target="_blank" rel="noopener noreferrer">Explore the museum record ↗</a></footer>`;
  const fields=Object.fromEntries([...dialog.querySelectorAll('[data-info]')].map(node=>[node.dataset.info,node]));
  const link=dialog.querySelector('a');let selected=null;
  viewport.append(button,dialog);
  function open(){if(!button.hidden&&!dialog.open)dialog.showModal();}
  function close(){if(dialog.open)dialog.close();}
  const closeButton=dialog.querySelector('button');
  button.addEventListener('click',open);closeButton.addEventListener('click',close);
  const backdrop=event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)close();}};
  dialog.addEventListener('click',backdrop);
  return{
    select(id){
      const data=artworks.get(id);button.hidden=!data;
      if(selected===id)return;close();selected=id;if(!data)return;
      for(const key of ['period','title','subtitle','description','look','version'])fields[key].textContent=data[key];
      fields.version.textContent+=' This web version has been simplified for smooth viewing.';
      fields.credit.textContent=`Royal Cast Collection · ${data.record} · Public domain`;
      link.href=`https://open.smk.dk/en/artwork/image/${encodeURIComponent(data.record)}`;
      dialog.querySelectorAll('details').forEach((node,index)=>node.open=index===0);dialog.scrollTop=0;
    },open,close,
    dispose(){close();button.removeEventListener('click',open);closeButton.removeEventListener('click',close);dialog.removeEventListener('click',backdrop);button.remove();dialog.remove();},
  };
}
