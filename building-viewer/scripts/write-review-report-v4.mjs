import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve('../..');const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const artifactFiles=['site/public/models/icm-anim-2025/model-web-review-v4.glb','site/public/models/icm-anim-2025/collision-review-v4-exact.glb','site/public/models/icm-ext/model-web-review-v4.glb','site/public/models/review-v4/Xbot-stairs-v4.glb','site/public/models/review-v4/seats-lod1-v4.glb','site/public/models/manifest-review-v4.json'];
const assets=artifactFiles.map(relative=>{const p=path.join(root,relative);return{path:relative,bytes:fs.statSync(p).size,sha256:hash(p)}});
const read=f=>JSON.parse(fs.readFileSync(path.join(root,'evidence',f)));
const routes=read('full-viewer-routes-v4.json').result,geo=read('exact-geometry-v4-exact.json'),perf=read('seat-performance-v4-final.json'),character=read('character-playback-v4-final.json');
const manifest={schema:4,date:'2026-10-04',status:'isolated-full-viewer-review; NOT production activation',preview:'http://127.0.0.1:5204/',originalPreview:'http://127.0.0.1:5192/',originalProject:'F:/iom_website/building-viewer',supersedesForReview:'candidate-manifest-v3.json',inputs:read('input-verification.json'),originalInputsUnchanged:read('input-final-verification-v4.json').every(r=>r.unchanged),assets,visualObjects:read('visual-composition-v4.json'),collisionIntegrationReport:'evidence/collision-composition-v4.json',runtimeFiles:'evidence/changed-files-v4.json',geometry:geo,tests:{...routes.summary,controllerRegression:17,controllerRegressionPassed:17,instanceMatrixRegression:'PASS',slowGait30_60_120Hz:'PASS',fullBrowserSurfaces:read('surfaces-v4-final/report.json').ok,fullBrowserReload:read('final-preview-v4.json').pass,typeScript:'PASS',viteBundle:'PASS',standardTestCommands:'16/17 pass; stale activation contract correctly rejected',npmBuild:'BLOCKED by broad collision coverage gate (138 cells; limit 80)',productionActivation:'REJECTED; horizontal ratio and elevation-band requirements unmet'},character:{assetUnmodified:true,clipsInPlace:true,footIK:false,referenceUpMetresPerSecond:.35,referenceDownMetresPerSecond:.4,fullPassage:character.routes.map(r=>({reverse:r.reverse,airborne:r.airborne,rootError:r.rootError,states:r.states,stop:r.afterStop}))},lod:{rows:78,originalRetained:true,sourceTrianglesSaved:2389530,enterScreenErrorPixels:.25,exitScreenErrorPixels:.35,sourceErrorEstimateMetres:.004951,thresholdCaveat:'Estimated from sampled Blender error, not a certified Hausdorff bound',measurements:perf.map(({rawMs,...r})=>r),fpsImprovementClaim:false,drawCallReduction:false,hysteresis:read('seat-hysteresis-v4.json')},cadRequired:{floorUnresolvedFaces:routes.floor.filter(r=>r.error===null||r.error>=.015).map(r=>r.face),blockedRoutes:routes.routes.filter(r=>!r.ok).map(r=>({name:r.name,speed:r.speed})),headroomSlabs:['bt2_technik_boden_1OG','zusatz_fb_bt2_og2'],landingTransitions:['TR_Stufen004','TR_Stufen005'],instructions:'BLENDER-CAD-UPUTE-v4.txt'},excluded:['Rejected container/lamp/aggressive-seat/Area_all experiments','Quantized collision-review-v4.glb: superseded by collision-review-v4-exact.glb','Production GLB overwrite','New Blender exports','CAD slab cuts','Global DoubleSide or whole-scene normal recalculation'],limits:['Local desktop review; no Quest/mobile release validation','Named-owner preservation (-kn) increases asset size and can affect batching; LOD timings compare within this candidate only','Broad coverage differs with the new named visual hierarchy; old collision also reports 138 cells against this visual. Do not weaken the release gate','LOD screen threshold is based on sampled mesh error; near-view original remains necessary']};
fs.writeFileSync(path.join(root,'candidate-manifest-v4.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(assets.map(a=>[a.path,a.bytes]));
const near0=perf.filter(r=>r.name==='near'&&r.mode==='lod0'),far0=perf.filter(r=>r.name==='far'&&r.mode==='lod0');
const report=`ICM BUILDING VIEWER — ODVOJENI PREGLED v4, 4. 10. 2026.

Pregled: http://127.0.0.1:5204/
Izvorni pregled i projekt ostaju na http://127.0.0.1:5192/ i F:\\iom_website\\building-viewer.
Sve nove datoteke su u ${root}.
Ovo je kandidat za pregled. Nije aktivirana produkcija i nije izrađen certifikat koji bi zaobišao neuspjele provjere.

ŠTO JE INTEGRIRANO
U kopiji punog viewera spojeni su vizualni kandidati, točni oslonci stuba i poda, novi Xbot klipovi te usporedba sjedala. RG_Teil_01 koristi samo noviji kandidat s 261 ispravljenom plohom. Uključeno je točno čišćenje Decke_Raster001, Dachkonstruktion i Rahmen. Odbačeni pokusi nisu uključeni.
Ispravljeni su dijeljeni raycast rezultati, oslonac na rubu pri sporom hodu i instanceMatrix unutarnje kolizije. Stari pomoćni podesti i oslonci dvorane isključeni su samo za novu točnu koliziju. Ostali dijelovi stare kolizije zadržani su uz ograničeno uklanjanje preklapanja; detalji i jedan zadržani nepodudarni BU_Treppe dio nalaze se u collision-composition-v4.json.

PIPELINE I GEOMETRIJA
Kandidati su spojeni s provjerenim imenovanim izvornim GLB-ovima, zatim obrađeni postojećim native gltfpack/offline-batch pipelineom. 19 unutarnjih i 1 vanjski objekt imaju popis izmjena u evidence/visual-composition-v4.json; izvorne matrice pri spajanju podudaraju se unutar 2,8e-9.
Prvi zapakovani kolizijski pokušaj pomaknuo je pojedine vrhove do 7,6 mm. Odbijen je i sačuvan kao dijagnostika. Konačni collision-review-v4-exact.glb koristi -noq: 604/604 mreže, 1.175/1.175 trokuta, najveće odstupanje od ulaznih kandidata 0,000000513 m. Runtime čuva potpuno isti usmjereni Float32 skup trokuta; nema proxy zamjene.
Uklonjeno je 17 naslijeđenih tvrdnji o popravljenoj topologiji iz promijenjenog kolizijskog zapisa. Razlog je zabilježen; nove lažne oznake nisu dodane.

PROVJERE
- Puni ViewerEngine: 11/11 ciljnih oslonaca i 128/152 ruta pri 0,35 / 1,6 / 3,2 / 6,5 m/s, gore i dolje.
- Ostaju iste 24 problematične rute na četiri Etagentreppen zbog izvornih ploča.
- Pod: 1.112/1.142 uzorka unutar 15 mm. Istih 30 mjesta ostaje neriješeno.
- Dodatni Blender pregled tih 30 lica: 1.080 uzoraka; 28 lica ima djelomično preklapanje s drugim plohama, 12 nema svugdje potvrđenu donju plohu. Nisu dodane velike rampe niti zatvoreni otvori.
- 17/17 regresija kontrolera; dodatno prolaze transformacije instanci i spor hod s kontaktnim podrhtavanjem pri 30/60/120 Hz.
- Etažna animacija provjerena na 0%, 50%, 100% i povratku na 0%. Ploče ostaju pod izvornim animiranim roditeljima. Hod vraća zgradu u početni položaj; kolizija nije predstavljena kao animirana konstrukcija.
- Pregled ploha unutra/vani prolazi. Nema globalnog DoubleSide. Test prepoznaje i provjerenu oznaku razloga u materijalu nakon izvoza; nije izmišljen novi razlog.
- Browser nema prijavljenih JavaScript grešaka. Ponovno učitavanje zadržava 78 redova, bez nakupljanja starih LOD referenci.
- TypeScript i Vite bundle prolaze. Od 17 standardnih testnih naredbi prolazi 16; aktivacijska provjera ispravno odbija stare hashove i metrike.
- Puni npm run build NE PROLAZI provjeru šire pokrivenosti: 138 ćelija bez oslonca, granica 80. Izvorna kombinacija modela ima 46. Novi imenovani vizualni model sa STAROM kolizijom također daje 138, pa broj nije dokaz 92 novih rupa nastalih spajanjem kolizije. Potrebno je pregledati semantičku klasifikaciju i stvarne površine tih ćelija prije aktivacije. Prag nije oslabljen.
- Nova aktivacijska evidencija odbijena je zbog omjera horizontalne pokrivenosti i nedovoljnog broja/razmaka kvalificiranih etažnih pojaseva. Certifikat nije izdan.

LIK
Xbot datoteka preuzeta je bez izmjena. Novi klipovi su loopani i in-place; kontroler određuje položaj. Brzina klipova sada prati izmjereno kretanje uz reference 0,35 m/s za uspon i 0,40 m/s za silazak. Spor hod je početni izbor pregleda; Normalno vraća 3,2 m/s, Shift ostaje stresni brži prolaz.
Neprekinuti prolaz TR004 u oba smjera završava bez gubitka oslonca i bez odstupanja roota od kontrolera. U tom testu pri silasku nema klipa uspona; stop prelazi u idle. Provjereni su idle/walk/run/stairsUp/stairsDown prijelazi. Izbor smjera ublažava kratko kontaktno podrhtavanje preko pređene udaljenosti.
Foot IK nije implementiran. Uzorci položaja kostiju stopala nisu potvrda kontakta tabana. Pri drugačijim visinama stuba ili velikoj brzini ostaju moguće klizanje i prodiranje stopala; kandidat nije konačna animacijska dorada.

SJEDALA — STVARNA MJERENJA
Edge, RTX 3090, 1440×900, isti pogled/postavke, 100 okvira zagrijavanja + 180 mjerenih. Redoslijed LOD0/LOD1/LOD1/LOD0, zatim auto. Udaljeni pogled ima rastavljene etaže radi vidljivosti dvorane. renderer.info brojevi uključuju prolaze renderera, pa nisu jednak broj kao izvorni trokuti modela.
Blizu: LOD0 6.674.950 trokuta / 723 draw calls / medijan 16,5–16,8 ms; LOD1 3.856.530 / 723 / 16,8 ms. Auto zadržava svih 78 originalnih redova.
Daleko: LOD0 12.361.244 / 1.396 / 17,4–18,1 ms; LOD1 7.582.184 / 1.396 / 17,7 ms. Auto koristi svih 78 LOD1 redova, medijan 17,7 ms.
Smanjenje trokuta je potvrđeno; pouzdano poboljšanje FPS-a i smanjenje draw calls nisu potvrđeni. Granice su procijenjena pogreška na zaslonu ispod 0,25 px za ulaz i iznad 0,35 px za povratak. Temelj je uzorkovana Blender pogreška 4,951 mm, ne dokazana globalna granica. Histereza prolazi 30 oscilacija bez treperenja. Materijali, sjene i roditeljske transformacije ostaju isti. LOD1 izbliza ostaje isključivo ručna usporedba.
Čuvanje imenovanih vlasnika preko -kn povećava konačni unutarnji GLB na ${(assets[0].bytes/1e6).toFixed(2)} MB u odnosu na izvornih 96,80 MB te može utjecati na batching. Ovaj pregled ne tvrdi ukupno ubrzanje nad aktivnom verzijom. Quest/mobilni release nije provjeren.

KORIŠTENJE I DOKUMENTACIJA
U gornjoj traci odaberi Mjesto, LOD sjedala i brzinu hoda. CAD mjesta prikazuju narančasti okvir 1,70 m; oznake ne sudjeluju u koliziji. Pegman i WASD ostaju standardni način hoda.
Ako se server ugasi: u site/building-viewer pokreni npm run dev -- --host 127.0.0.1 --port 5204 --strictPort. Kopija koristi postojeći node_modules i zajedničke resurse iz F:\\iom_website; nije samostalni prenosivi paket.
Točan popis izvornog koda i SHA-ova: evidence/changed-files-v4.json. Ulazni/konačni hashovi: candidate-manifest-v4.json i evidence/input-final-verification-v4.json. Svih 35 ulaza je nepromijenjeno. Izvještaji, snimke i sirova mjerenja su u evidence/.
Za CAD odluke i idući Blender razgovor koristi BLENDER-CAD-UPUTE-v4.txt. Aktivne datoteke, prethodni kandidati i Blender izvor nisu prepisani; nije pokrenut novi Blender izvoz, commit ni deploy.
`;
fs.writeFileSync(path.join(root,'IZVJESTAJ-v4.txt'),report);
