import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve('../..'), dir='evidence/external-v6/';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const describe=p=>({path:p,bytes:fs.statSync(path.join(root,p)).size,sha256:hash(p)});
const base=read('candidate-manifest-v5.json');
const unchangedAssets=base.assets.map(a=>({...describe(a.path),expected:a.sha256,unchanged:hash(a.path)===a.sha256}));
for(const a of base.baseAssets)unchangedAssets.push({...describe(a.path),expected:a.current,unchanged:hash(a.path)===a.current});
if(unchangedAssets.some(a=>!a.unchanged))throw Error('Previous candidate asset changed');
const changed=['site/building-viewer/src/main.ts','site/building-viewer/src/ReviewLocations.ts'];
const sourceComparison=base.files.map(f=>({path:f.path,unchanged:hash(f.path)===f.sha256,expectedChange:changed.includes(f.path)}));
if(sourceComparison.some(f=>!f.unchanged&&!f.expectedChange))throw Error('Unexpected v5 source change');
const terrain=read(dir+'large-stair-terrain-all.json'),short=read(dir+'restored-walk-routes-v6.json'),glass=read(dir+'glass-browser-final-v6.json'),cad=read(dir+'cad-source-transform-comparison.json');
if(terrain.passed!==108||short.passed!==48||terrain.errors.length||glass.errors.length)throw Error('Final QA failed');
const files=[...changed,...fs.readdirSync('scripts').filter(n=>/v6\.mjs$/.test(n)).map(n=>'site/building-viewer/scripts/'+n)].map(describe);
const evidenceNames=['large-stair-terrain-all.json','large-stair-terrain-routes.json','route-regeneration-v6.json','restored-walk-routes-v6.json','default-layers-v6.json','glass-browser-final-v6.json','cad-source-transform-comparison.json','dual-layer-grounding.log','typescript.log','vite-build.log'];
const manifest={schema:6,date:new Date().toISOString(),status:'isolated review candidate; exterior approach unit complete; production gates unresolved',preview:'http://127.0.0.1:5204/',baseManifest:'candidate-manifest-v5.json',reviewManifest:describe('site/public/models/manifest-review-v6.json'),initialLayers:['icm-ext','icm-anim-2025'],reason:'Exterior GLB contains the real ground around the restored stairs. Load both layers initially so the existing cross-layer support fallback can reach it.',unchangedAssets,sourceComparison,files,evidence:evidenceNames.map(n=>describe(dir+n)),terrainWalk:{assemblies:9,branches:18,passed:terrain.passed,total:terrain.total,speeds:[.35,1.6,3.2],directions:['ascent','descent'],maxAirborneFrames:Math.max(...terrain.results.map(r=>r.airborne)),maximumEndpointHeightError:Math.max(...terrain.results.map(r=>r.heightError)),maximumControllerHeightChangePerFrame:Math.max(...terrain.results.map(r=>r.maxStep)),scope:'From existing exterior terrain to authored upper landing and back; follows one sampled path per branch at 60 Hz. No certification of all lateral positions, railings or foot animation.'},shortStairRegression:{flights:8,passed:short.passed,total:short.total,maxAirborneFrames:Math.max(...short.results.map(r=>r.airborne))},glass:{opaquePaintParts:glass.changedPaintParts,actualGlassUnchanged:glass.actualGlassUnchanged,rows:glass.rows,screenshotCorrespondenceConfirmedByUser:false},cad:{objects:cad.length,maximumMatrixError:Math.max(...cad.map(r=>r.matrixError)),finding:'Known obstructing floor slabs and related stairs already match original Blender transforms. Architectural clearance issues need CAD decisions; another placement restoration will not resolve them.'},verification:{defaultVisibleLayers:read(dir+'default-layers-v6.json'),dualLayerGrounding:'PASS',typescript:'PASS',viteBundle:'PASS; existing chunk-size warning',browserErrors:[],fullNpmBuild:'Not rerun; prior collision coverage and activation gates remain unresolved'},limits:base.limits,geometryChanged:false,controllerChanged:false,animationChanged:false,originalProjectModified:false,originalBlendModified:false,deployed:false,committed:false};
fs.writeFileSync(path.join(root,'candidate-manifest-v6.json'),JSON.stringify(manifest,null,2)+'\n');
const report=`ICM BUILDING VIEWER — DOPUNA v6, 4. 10. 2026.

Pregled radi na http://127.0.0.1:5204/ u izdvojenoj radnoj kopiji.
Ova cjelina provjerava vanjske prilaze i svih 18 grana devet velikih vraćenih FluchtWeg sklopova. Popravci položaja, stvarni trokuti oslonca i materijali iz v5 ostaju isti.

PROMJENA
Početni manifest v5 učitavao je samo ICM 2025 Animated. Stvarno okolno tlo nalazi se u ICM Exterior, pa nakon silaska nije bilo tog oslonca ako korisnik sam ne uključi vanjski sloj.
Novi manifest-review-v6.json učitava oba sloja od početka. Postojeća kolizija već podržava oslonac iz drugog sloja kada ga nema u vlastitom. Geometrija, fizika kontrolera i animacijski isječci nisu mijenjani.
U traci Mjesto dodani su Vanjski prilaz: zapad i Vanjski prilaz: istok. Oba modela trebaju biti uključena za navedene rute.
Praktični trošak: oba modela učitavaju se odmah; u ovoj dopuni nije mjeren učinak na brzinu prvog učitavanja niti je potvrđeno poboljšanje FPS-a.

REZULTATI
- 108/108 prolazaka: 18 grana, brzine 0,35 / 1,6 / 3,2 m/s, gore i dolje. Početak je na postojećem vanjskom terenu, kraj na gornjem podestu. Bez gubitka oslonca na testiranim rutama.
- 48/48 ponovljenih prolazaka osam kraćih TR_Stufen letova uz oba sloja, također bez gubitka oslonca.
- Najveće odstupanje završne visine od nominalne točke je 0,01999 m: istočni teren je izvorno oko -0,02 m. Dopušteno odstupanje testa je 0,09 m.
- Najveća promjena visine kontrolera u jednom koraku simulacije je 0,330003 m. To ne potvrđuje prirodnu animaciju stopala. Kontakt stopala i izgled penjanja ostaju zasebna dorada.
- Čisto početno učitavanje automatski uključuje oba modela; provjereno bez pomoćnog ensureLayer poziva.
- Tri prethodno popravljena neprozirna panela ostaju neprozirna; četiri uspoređena staklena dijela imaju iste postavke. Browser nema JavaScript iznimki.
- Prolaze regresija oslonca između slojeva, TypeScript i Vite bundle. Ostaje ranije upozorenje o veličini paketa.
- Svih devet spremljenih resursa v4/v5 iz provjere ostalo je identično. Od ranijih v5 izvora mijenjaju se samo main.ts i ReviewLocations.ts. Novi testovi i manifest dodani su zasebno.

OPSEG TESTOVA I DIJAGNOSTIKE
Konačni rezultati su large-stair-terrain-all.json i restored-walk-routes-v6.json u evidence/external-v6.
Rute su izvedene iz stvarnih horizontalnih trokuta kolizije, u rasteru 0,16 m, i produžene do tla 0,8 m ispred vanjske granice sklopa. Raster usmjerava X/Z; visinu i prohodnost određuje stvarni kontroler cijele scene. Ponovno generiranje daje identične testirane rute. Test ne certificira svaku bočnu putanju, ogradu ili cijelu zgradu.
Početni dijagnostički raster hvatao je i podkonstrukciju ispod prvih stuba. Silazak je završavao u ispravnom X/Z, ali na gazištu iznad nominalnog rastera. Te rezultate (54/108) ne treba čitati kao završni rezultat v6. Sačuvani su kao large-stair-walk-understructure-diagnostic.json; large-stair-walk-all.json također je stara dijagnostika. Prva pilot-provjera imala je i pregrub prag dopuštenog silaska koji je naknadno ispravljen.
Pokusni geometrijski headroom filter rastera sa 10 ruta nije konačni skup; sačuvan je u datotekama *-headroom-diagnostic.json. Konačni skup ima 18 ruta: large-stair-terrain-routes.json. Mjerodavna je provjera stvarnim kontrolerom, ne sam raster.

ORIGINALNI BLENDER I PREOSTALE STVARI
Usporedba devet ranije spornih objekata s već spremljenim podacima originalnog ICM_pack.blend pokazuje istovjetne transformacije (najveća razlika ${manifest.cad.maximumMatrixError}). Ploče bt2_technik_boden_1OG i zusatz_fb_bt2_og2 nisu još jedna skupina izgubljenih položaja. Za niske prolaze E262/E7676/E276/E277 i spoj TR004/TR005 i dalje trebaju arhitektonske odluke iz BLENDER-CAD-UPUTE-v4.txt; ploče nisu izrezane.
Izvorni Blender, aktivni projekt F:\\iom_website i online verzija nisu pisani. Nema novog Blender izvoza, commita ni deploya.
Puni npm run build nije ponovno pokretan niti proglašen prolaznim: ranije prepreke pokrivenosti kolizije i aktivacije ostaju. Foot IK nije uveden. Detalj stakala/otvorenih vrata sa korisničke snimke još treba korisnikovu vizualnu potvrdu.

SLIKE I NASTAVAK
Dokazi su u evidence/external-v6. Slike glass-stairs-west-final-v6.png i glass-stairs-east-final-v6.png pokazuju vraćene sklopove; glass-former-origin-final-v6.png pokazuje nekadašnje mjesto grupiranja bez te hrpe. Ostale slike prikazuju početni pogled i staklena pročelja.
Za nastavak pročitati NASTAVAK-v6.txt, ovaj izvještaj i candidate-manifest-v6.json. Raniji v5 izvještaj i checkpoint ostaju sačuvani.
`;
fs.writeFileSync(path.join(root,'IZVJESTAJ-v6.txt'),report);
fs.writeFileSync(path.join(root,'NASTAVAK-v6.txt'),`NASTAVAK ICM VIEWERA — v6, 4. 10. 2026.

Radna kopija: ${path.resolve('.')}
Pregled: http://127.0.0.1:5204/
Pokretanje u radnoj kopiji: npm run dev -- --host 127.0.0.1 --port 5204 --strictPort
Koristiti skriven prozor za pozadinski server. U ovoj sesiji server je pokrenut (PID 14852); taj broj nije jamstvo za iduću sesiju.

Prvo čitati IZVJESTAJ-v6.txt i candidate-manifest-v6.json. v5 dokumenti ostaju relevantni za vraćanje 18 položaja i staklo. v4 dokumenti čuvaju ranije CAD i aktivacijske prepreke.
Završena cjelina: stvarni vanjski teren učitava se od početka uz unutarnji model. Svih 18 grana devet većih sklopova prolazi 108/108 ruta od tla do podesta i natrag. Kraće stube 48/48 uz oba sloja. Bez promjene GLB-ova, fizike ili animacije.
Manifest pregleda je site/public/models/manifest-review-v6.json; src/main.ts koristi njega. Originalni projekt je F:\\iom_website\\building-viewer. Ne prepisivati originalne GLB-ove, Blender datoteke ili prethodne kandidate.

Sljedeće:
1. Korisnik još nije potvrdio stakla/otvorena vrata sa stare snimke u ovom lokalnom prikazu. Ne tvrditi da je taj detalj potpuno riješen.
2. CAD: devet ranije spornih objekata transformacijom odgovara originalnom ICM_pack.blend. Za niske ploče E262/E7676/E276/E277 i spoj TR004/TR005 koristiti BLENDER-CAD-UPUTE-v4.txt. Ne tretirati to kao nove izgubljene položaje; treba odluka o arhitekturi.
3. Dorada animacije i kontakta stopala ostaje. Foot IK nije uveden; test fizike ne dokazuje prirodan korak. Najveća promjena visine kontrolera po 1/60 s bila je oko 0,33 m.
4. Zasebno riješiti ranije coverage i activation prepreke prije produkcije. Nije napravljen deploy ni commit i nema potvrde punog npm run build.

Konačni dokazi: evidence/external-v6/large-stair-terrain-all.json, restored-walk-routes-v6.json, default-layers-v6.json i glass-browser-final-v6.json. Stari large-stair-walk-all.json je dijagnostika podkonstrukcije (54/108), a ne finalni rezultat; konačno je terrain-all (108/108).
Regeneriranje ruta: node scripts/derive-large-stair-routes-v6.mjs (provjerava identičnost s testiranim rutama).
Browser provjere: node scripts/qa-large-stair-terrain-v6.mjs --all; node scripts/qa-restored-walk-v6.mjs; node scripts/qa-default-browser-v6.mjs. Koristiti Edge/Playwright channel msedge, generički Chromium je spor.
Arhiva checkpoint-20261004-v6-source.zip čuva kod i konfiguraciju, ne modele/dependencies. Kopija ovisi o postojećim junctionima prema originalnim dependency/resurs mapama. Hashovi su u manifestu v6.
Originalni izvor: D:\\IOM\\ICM\\ICM_pack.blend; potvrđeni hash iz v5 je ${base.source.sha256}. U v6 Blender nije pokretan ni izvoz napravljen; usporedba koristi spremljene originalne matrice iz v5.
`);
console.log(JSON.stringify({terrain:terrain.passed,short:short.passed,unchangedAssets:unchangedAssets.length,changedSources:sourceComparison.filter(f=>!f.unchanged).map(f=>f.path),files:files.length}));
