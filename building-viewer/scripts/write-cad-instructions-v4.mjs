import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('../..');const r=JSON.parse(fs.readFileSync(path.join(root,'evidence/auditorium-unresolved-dense-v4.json'),'utf8').replace(/^\uFEFF/,''));
const text=`UPUTE ZA IDUĆI BLENDER / CAD RAZGOVOR — v4

Otvori F:\\iom_website\\building-viewer\\blender-candidates-20261003\\icm-full-audit-and-candidates-20261003.blend i radi isključivo u novoj kopiji, npr. icm-cad-decisions-v5.blend. Izvor ostavi sačuvan. Prije rada provjeri otvorenu scenu, frame 0, aktivne operacije i postojeće izvještaje. Ne pokreći izvoz automatski.
Lokalna kopija punog viewera: http://127.0.0.1:5204/. Izbornik Mjesto sadrži pregled stuba, sjedala i CAD prepreka; narančasti okvir je samo oznaka prostora lika, ne prijedlog automatskog reza.

1. PLOČE I VISINA PROLAZA
Pregledaj bt2_technik_boden_1OG pod roditeljima 1-floor.BT2 / 1st Floor._anim1. U početnom položaju ploča siječe prostor potreban za Etagentreppen_262.001 i Etagentreppen_7676.001.
Three.js koordinate su metri, Y gore:
- E262: X=-37,22, Z=-11,30414; gazište Y=4,692079; donja ploha Y=5,900415; slobodno 1,208336 m.
- E7676: X=-72,89, Z=-11,30414; gazište Y=4,692080; donja ploha Y=5,897430; slobodno 1,205351 m.
Pregledaj zusatz_fb_bt2_og2 pod 2 floor.BT2 / 2st Floor._anim1 za Etagentreppen_276 i Etagentreppen_277. Pri vrhu, oko Z=54,46991 i X=-52,33419 odnosno -57,84443: gazište Y=8,338731, donja ploha oko Y=8,96999, slobodno oko 0,63126 m. Slobodni bočni pojas 0,0961 m uži je od kapsule promjera 0,28 m.
Viewerov lik visok je 1,70 m. Ovo nije tvrdnja o zakonskoj minimalnoj visini prolaza.
Izvorni CAD nije pronađen. Prvo potvrdi jesu li stube na namjeravanoj etaži i postoji li otvor u nacrtu. Na odvojenoj označenoj kopiji prikaži mogući otvor ili ispravljenu trasu, s mjerama i potrebnom širinom. Konstrukciju ne rezati i ploče ne uklanjati bez potvrde namjere.
Animacija etaža pomiče ove ploče prema gore, ali pri frame 0 i pri hodanju prepreka ostaje. Runtime provjera matrica na 0/50/100% i povratku na 0 nalazi se u evidence/animation-hierarchy-v4.json. Problem nije riješen odabirom animirane poze.

2. 30 LICA PODA DVORANE
Objekt RG_Teil_01, izvorni indeksi:
538, 603, 604, 644, 663, 693, 726, 744, 758, 770, 771, 778, 779, 789, 790, 842, 854, 855, 869, 871, 884, 889, 1587, 1588, 2130, 2188, 5193, 5737, 5835, 6820.
Ne poistovjećivati indekse s indeksima prepakovanog runtime GLB-a. Za izbor u Blenderu koristi izvorno uvezenu mrežu s 8.072 lica i odgovarajuću scenu.
Koordinate, vrhovi, preklopljena lica i primjeri nalaze se u evidence/auditorium-unresolved-dense-v4.json. Obavljeno je 36 unutarnjih uzoraka po licu, ukupno 1.080. Kod 28 lica postoji djelomično preklapanje, a 12 nema posvuda potvrđen par donje plohe. To nije potvrda da su cijela lica namjeravane gornje površine.
Posebno pregledaj 2188 i 6820: u ovom uzorkovanju nema ni pokrovne ni uparene donje plohe. Lice 6820 vrlo je mali fragment; ne pretvarati ga u veliki hodni oslonac.
Prijedlog na kopiji: obilježi ove skupine različitim bojama i provjeri rubove/preklapanja prema CAD-u. Izoliraj eventualne točno dokazive gornje poligone. Ne dodavati široku rampu, ne zatvarati otvore i ne okretati svih 30 lica automatski.

3. IZLAZI TR_Stufen004 / TR_Stufen005
Pregledaj originalne podeste Decke_2OG_A i susjedni pod. Podest je približno Y=10,0, završetak gazišta oko Y=10,352 / 10,429, a susjedni pod oko Y=10,4 pri Z=41,9–42,0.
Potvrdi jesu li potrebni dodatna stuba, drugačija kota podesta ili druga trasa. Prolazak kapsule nije arhitektonska potvrda prijelaza. Ne nivelirati cijelu ploču radi jednog testa.

4. LIK I STOPALA
Xbot-stairs-candidate.glb ostaje osnova: isti kostur, bind poza, nazivi, skinning i postojeća skala oko 0,01. Ne primjenjivati transformacije na rig ili mijenjati root motion naslijepo.
Stairs_Up (1,6 s, referenca 0,35 m/s) i Stairs_Down (1,4 s, 0,40 m/s) su loopani i in-place. Viewer određuje položaj kontrolerom. Očuvaj ostale klipove.
Foot IK nije uveden. Podaci o kostima stopala u evidence/character-playback-v4-final.json pokazuju položaje u stvarnom prolazu, ali nisu kontakt tabana. Eventualnu doradu kontakta napravi prvo na jednom reprezentativnom kraku i usporedi više visina stuba. Zabilježi stance/swing intervale i lokalni smjer; za prilagodbu različitim stubama potrebno je razmotriti runtime IK, a ne obećati univerzalni kontakt jednim klipom.

5. IZVOZ NAKON ODLUKE
Izvozi pod NOVIM imenima tek nakon pregleda prijedloga. Očuvaj roditelje, animacijske kanale, položaje, UV-e, materijale i extras. Točni kolizijski kandidati moraju imati stvarne gornje poligone s usmjerenjem +Y u Three.js svijetu; provjeri world matricu i negativne transformacije instanci.
Za ovu kopiju vrijedi pretvorba Three.js (x,y,z) u Blender (x,-z,y); provjeravaj evaluirane svjetske koordinate, ne samo lokalne vrijednosti objekta.
Ponovi usporedbu usmjerenih trokuta nakon izvoza i nakon runtime buildCollisionChunks. U aktualnom v4 kolizija prolazi samo uz gltfpack -noq; -vpf sam po sebi NE isključuje kvantizaciju. Nemoj pisati iomSurfaceTopologyRepaired bez stvarne provjere.

Preostala zasebna viewer provjera prije produkcije: šira pokrivenost i aktivacijska evidencija još ne prolaze. Čuvanje naziva promijenilo je semantičke uzorke provjere; broj 138 pojavljuje se i uz staru koliziju. To se ne rješava rezanjem CAD-a ili snižavanjem praga testa.
`;
fs.writeFileSync(path.join(root,'BLENDER-CAD-UPUTE-v4.txt'),text);
