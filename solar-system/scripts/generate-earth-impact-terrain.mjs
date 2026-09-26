import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
// Input: NOAA etopo180.dods?altitude[0:5:10800][0:5:21600]
// Run from solar-system: node scripts/generate-earth-impact-terrain.mjs <download.dods>
const b=fs.readFileSync(process.argv[2] ?? 'tmp/earth-surface/etopo.dods'),w=4321,h=2161,n=w*h,start=b.indexOf(Buffer.from('\nData:\n'))+7;
if(b.readUInt32BE(start)!==n||b.readUInt32BE(start+4)!==n)throw Error('Grid shape mismatch');
const out=Buffer.alloc(8+n*3);out.writeUInt32LE(w);out.writeUInt32LE(h,4);
const alt=new Int16Array(n);for(let i=0;i<n;i++){alt[i]=b.readInt32BE(start+8+i*4);if(alt[i]===32767)throw Error('Missing elevation');out.writeInt16LE(alt[i],8+i*2);}
const ocean=new Uint8Array(n),queue=new Uint32Array(n);let head=0,tail=0;
function add(i){if(!ocean[i]&&alt[i]<0){ocean[i]=1;queue[tail++]=i;}}
add(1080*w+360);while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);add(y*w+(x+w-1)%w);add(y*w+(x+1)%w);if(y>0)add(i-w);if(y<h-1)add(i+w);}
Buffer.from(ocean).copy(out,8+n*2);
fs.mkdirSync('public/assets/impact',{recursive:true});
const gz=zlib.gzipSync(out,{level:9});fs.writeFileSync('public/assets/impact/earth-etopo1-5min.bin.gz',gz);
fs.writeFileSync('public/assets/impact/earth-etopo1-5min.json',JSON.stringify({source:'NOAA NGDC ETOPO1 ice surface',url:'https://oceanwatch.aoml.noaa.gov/erddap/griddap/etopo180.html',query:'altitude[0:5:10800][0:5:21600]',width:w,height:h,origin:{latitude:-90,longitude:-180},spacingDegrees:1/12,verticalUnits:'metres relative to mean sea level',format:'gzip: uint32le width,height; int16le heights; uint8 connected-ocean mask (row-major south to north)',oceanMask:'Flood fill of below-sea-level cells connected to the Pacific; enclosed depressions remain land. Five arcminute coastlines are approximate.',sha256:crypto.createHash('sha256').update(gz).digest('hex'),bytes:gz.length},null,2)+'\n');
console.log({bytes:gz.length,oceanCells:tail,width:w,height:h});
