import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve('../..'), dir = 'evidence/placement-v5/';
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, ''));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const assetPaths = ['site/public/models/icm-anim-2025/model-web-review-v5.glb','site/public/models/icm-anim-2025/collision-review-v5-exact.glb','site/public/models/manifest-review-v5.json'];
const assets = assetPaths.map(p => ({path:p,bytes:fs.statSync(path.join(root,p)).size,sha256:hash(path.join(root,p))}));
const base = read('candidate-manifest-v4.json');
const baseAssets = base.assets.map(a => ({path:a.path,expected:a.sha256,current:hash(path.join(root,a.path))})).map(a=>({...a,unchanged:a.expected===a.current}));
if(baseAssets.some(a=>!a.unchanged))throw Error('Base v4 asset changed');
const inputCheck = read(dir+'input-verification-v5.json');
const visual = read(dir+'final-visual-placement-v5.json');
const browser = read(dir+'restored-browser-v5.json');
const walk = read(dir+'restored-walk-routes-v5.json');
const glass = read(dir+'glass-browser-final-v5.json');
const source = read(dir+'original-pack-hash-final-v5.json');
const sourceFiles = ['src/lighting/prepareArchitecturalMeshes.ts','src/main.ts','src/ReviewLocations.ts','scripts/offline-batch-model.mjs'];
const scripts = fs.readdirSync('scripts').filter(n=>/v5\.mjs$/.test(n)).map(n=>'scripts/'+n);
const files = [...sourceFiles,...scripts].map(p=>({path:'site/building-viewer/'+p,sha256:hash(p)}));
const manifest = {
 schema:5,date:'2026-10-04',status:'isolated review candidate; no production activation',preview:'http://127.0.0.1:5204/',baseManifest:'candidate-manifest-v4.json',source,assets,baseAssets,
 placement:{restored:visual.objects,maxPackedBoundsErrorMetres:Math.max(...visual.placements.map(r=>r.maximumBoundsError)),runtimeMatricesMatchAsset:browser.positions.every(r=>r.error<1e-6),report:dir+'restored-source-placement-v5.json'},
 collision:{...read(dir+'restored-collision-runtime-exact-v5.json'),existingExactSupports:read(dir+'exact-geometry-preserved-v5.json'),probes:{tested:browser.probes.length,passed:browser.probes.filter(p=>p.error!==null&&p.error<.006).length},report:dir+'restored-stair-collision-v5.json'},
 walk:{passed:walk.passed,total:walk.total,flights:walk.routes.length,speeds:[.35,1.6,3.2],maxAirborneFrames:Math.max(...walk.results.map(r=>r.airborne??0)),report:dir+'restored-walk-routes-v5.json',scope:'First tread to upper landing in both directions; external approach and the nine larger assemblies are not certified full routes'},
 glass:{changedOpaqueParts:glass.changedPaintParts,glassPartsVerifiedUnchanged:glass.actualGlassUnchanged,report:dir+'glass-browser-final-v5.json',sourceTransformComparison:dir+'original-glass-door-comparison-v5.json'},
 verification:{typeScript:'PASS',viteBundle:'PASS; existing bundle size warning',visualRegression:'PASS',surfaceRegression:'PASS',newGlassRegression:'PASS',pageErrors:browser.errors,seatRows:visual.seatRows,animations:visual.animations},
 inputCheck:{unchanged:inputCheck.filter(r=>r.unchanged).length,total:inputCheck.length,changedSinceV4:inputCheck.filter(r=>!r.unchanged),note:'The prior audit .blend differs from the v4 snapshot. This turn did not write it; no candidate GLB input changed.',report:dir+'input-verification-v5.json'},
 files,limits:['Original v4 CAD/headroom/coverage/activation issues remain; full npm build not certified','Restored collision includes selected existing near-horizontal metal/grating/wood faces; no handrail or wall collision completion','No new foot IK or animation clip edits','Door transforms match the original for the inspected ground-floor assemblies; full correspondence with the user screenshot is not established'],
 originalProjectModified:false,originalBlendModified:false,blenderExported:false,committed:false,deployed:false
};
fs.writeFileSync(path.join(root,'candidate-manifest-v5.json'),JSON.stringify(manifest,null,2)+'\n');
const report=`ICM BUILDING VIEWER — DOPUNA v5, 4. 10. 2026.

Pregled: http://127.0.0.1:5204/
Izvorni pregled na 5192 i aktivni projekt F:\\iom_website nisu mijenjani.
Ova dopuna nadograđuje izdvojeni kandidat v4; njegove ranije neriješene CAD i aktivacijske stavke ostaju važeće.

VRAĆENI POLOŽAJI
Izvor je D:\\IOM\\ICM\\ICM_pack.blend (1.338.966.252 bajta). Datoteka je pregledana u odvojenom Blender procesu s isključenim automatskim izvršavanjem skripti, bez spremanja. SHA-256 prije i poslije je isti: ${source.sha256}.
Uspoređeno je 7.695 imenovanih mreža; 4.960 referentnih objekata podudara se po granicama unutar 2 mm. Potvrđen je prijelaz osi Blender Z-up u glTF Y-up.
Vraćeni su izgubljeni pomaci 18 objekata: FluchtWeg014 (4 primjerka), FluchtWeg015 (3), FluchtWeg016 (2), TR_Stufen013/014/015/017/018/020/021/022 i pylon. Svi zadržavaju postojeće rotacije, geometriju i roditelje. Pomaci su preuzeti iz world matrica originala.
Položaji su već bili izgubljeni u objavljenoj verziji i provjerenim starijim lokalnim GLB-ovima. Online datoteke su jednake aktivnim lokalnim GLB-ovima. Izvorna pogrešna mjesta omogućila su optimizatoru spajanje preklopljenih kopija, pa je obnova napravljena prije oba native gltfpack prolaza i offline batchinga. Novi kandidati ne prepisuju v4.
Konačni GLB čuva svih 18 vlasnika; najveće odstupanje njihovih granica od obnovljenog izvora nakon pakiranja je ${Math.max(...visual.placements.map(r=>r.maximumBoundsError)).toFixed(9)} m. U browseru se podudara svih 18 world matrica. Sačuvano je 78 LOD redova sjedala i etažna animacija.
Slike: restored-origin-v5.png, restored-west-v5.png, restored-east-v5.png i restored-pylon-v5.png u evidence/placement-v5/. Izbornik Mjesto ima četiri nova prečaca.

HODANJE PO VRAĆENIM STUBAMA
Dodano je 5.082 postojećih trokuta oslonca za 17 vraćenih stubišta/podesta. Odabrane su stvarne gotovo horizontalne plohe materijala m.metal_grey, Treppengitter.002 i Floor_Wood_Vray_001, najmanje površine 0,005 m² i apsolutne Y komponente normale 0,999. Winding odabranih podložnih lica okrenut je prema gore bez pomicanja vrhova; odvojene visinske grupe sprečavaju automatsko stvaranje rampi. Nisu popunjavani otvori.
Runtime čuva točno isti usmjereni Float32 skup svih 5.082 trokuta; nema zamjenskih rampi. Ranijih 604 mreža / 1.175 točnih trokuta stuba i poda također ostaje nepromijenjeno.
Prolazi 51/51 uzoraka oslonca, po tri na svakom od 17 objekata. Osam TR_Stufen letova prolazi 48/48 ruta gore i dolje pri 0,35 / 1,6 / 3,2 m/s, bez gubitka oslonca. Ruta ide od prve stube do gornjeg podesta; nije dokaz svih vanjskih prilaza, ograda ili svih grana devet većih sklopova.
Prva dijagnostička ruta pretpostavila je jednake lokalne koordinate zrcaljenih mreža; zamijenjena je točkama stvarnih ploha svakog objekta. Završna točka silaska nalazi se na prednjem dijelu prve stube, izvan dodira kapsule s prethodnom višom stubom. Obje ranije dijagnostike sačuvane su, a konačni rezultati su u restored-walk-routes-v5.json.

STAKLA I VRATA
Potvrđena je greška klasifikacije materijala: naziv roditeljskog sklopa Fenster/Glass pretvarao je i neprozirnu boju u staklo. U src/lighting/prepareArchitecturalMeshes.ts neprozirna boja/plastika više ne nasljeđuje prozirnost samo zbog naziva sklopa.
U stvarnom modelu tri panela vray Paint - Light sada imaju opacity 1, transparent false i depthWrite true, umjesto opacity 0,45 / transparent true / depthWrite false. Četiri uspoređena staklena dijela zadržavaju potpuno ista svojstva kao prije. Ciljani test pada prije popravka i prolazi poslije; konačna browser provjera također prolazi.
Provjereni sklopovi Verbindung West, Verbindung West002, BT_3_Fassade_Fenster_345645, Tuer_glas_ i 001–005 te DT_Drehtuer_007–012 imaju matrice koje se podudaraju s originalnim Blenderom (najveća razlika ispod 4e-9). Njihove položaje i kutove nisam mijenjao. Ovo ne potvrđuje da je svaki detalj korisnikove fotografije konačno riješen: puna korespondencija snimke i lokalnog pogleda nije utvrđena.

PROVJERE I STATUS
Prolaze nova regresija stakla, postojeće regresije prikaza i vidljivosti, TypeScript i Vite bundle. Browser ne prijavljuje JavaScript iznimke. Nema tvrdnje o ukupnom poboljšanju FPS-a.
Puni npm run build i produkcijska aktivacija nisu proglašeni prolaznima: prethodne prepreke pokrivenosti, CAD otvori, niski stropovi i preostale dorade animacije stopala iz v4 ostaju otvoreni.
Od 35 ulaza uspoređenih s prethodnim snapshotom 34 su jednaka. Promijenjen je icm-full-audit-and-candidates-20261003.blend; ovaj rad nije pisao tu datoteku. Svi kandidat GLB ulazi i svih šest v4 izlaznih resursa ostali su jednaki. Izvorni ICM_pack.blend također je nepromijenjen.
Nije rađen novi Blender GLB izvoz, commit ni deploy. Potpuni putovi, hashovi, rezultati i ograničenja nalaze se u candidate-manifest-v5.json; dokazi su u evidence/placement-v5/.
`;
fs.writeFileSync(path.join(root,'IZVJESTAJ-v5.txt'),report);
console.log(JSON.stringify({assets:assets.map(a=>({path:a.path,bytes:a.bytes})),walk:manifest.walk.passed,inputsUnchanged:manifest.inputCheck.unchanged,originalBlendUnchanged:source.unchanged,report:path.join(root,'IZVJESTAJ-v5.txt')}));
