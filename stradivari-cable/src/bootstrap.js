window.__loadMetrics={models:[],lighting:[],events:[]};
document.querySelector('#retry').onclick=()=>location.reload();
import('./viewer.js').catch(error=>{document.querySelector('#status').textContent='The 3D preview is unavailable in this browser. The render is shown above.';document.querySelector('#retry').hidden=false;console.warn('3D preview unavailable:',error.message);});
