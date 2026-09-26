Detaljna analiza Earth Impacta i prijedlog rješenja
Datum: 25. 9. 2026.

Pregledani su postojeći kod, stvarni prikaz u lokalnoj aplikaciji i primarni izvori na internetu. U ovom koraku nisu mijenjani renderer ni fizika aplikacije. Izrađene su dijagnostičke snimke, mjerenja i ovaj plan.

**Glavni zaključak**

Sadašnja implementacija razlikuje vrste udara i prikazuje više efekata, ali prikaz još ima obilježja prototipa. Najveće poboljšanje dolazi iz pravilne dubine, skale, kamere i vremenskog slijeda događaja. Dodavanje čestica ili pojačavanje bljeska samo po sebi neće riješiti problem.

[Interaktivna usporedba istog kadra](../tmp/impact-online-analysis/comparison.html) omogućuje uključivanje i isključivanje atmosfere i kupole udarnog vala. To su stvarne snimke aplikacije, ne prikaz predloženog budućeg rješenja. Crno nebo u dijagnostičkom kadru nije cilj dizajna.

**Što je izmjereno**

Postavke: Zemlja, promjer 140 m, gustoća 3.000 kg/m³, brzina ulaska 20 km/s, vertikalan ulazak, visoka kvaliteta, kamera ground-observer, Enhanced efekti, planet True scale. Globalno vrijeme je zaustavljeno kako bi usporedbe imale isto osvjetljenje.

| Slučaj | Vrijeme nakon udara | Visina kamere nad referentnom razinom mora | Uvećanje efekata |
|---|---:|---:|---:|
| Ocean 20° N, 80° W; dubina 2.730 m | oko 3 s | oko 29 km | 16× |
| Isti ocean | oko 12 s | oko 59 km | 16× |
| Kopno 35° S, 70° W; teren 4.234 m | oko 3 s | oko 43 km | 16× |

Brojevi ovise o točnom zaustavljenom kadru; zaokruženi su iz spremljenih mjerenja. Kamera na kopnu je približno 38 km iznad visine mjesta udara. Ground-observer je stoga trenutno zračni pregled, a ne promatrač na tlu. [Mjerenja](../tmp/impact-online-analysis/results.json), [ponovljena izolacija slojeva](../tmp/impact-online-analysis/ocean-layer-isolation.json).

Usporedba potvrđuje dva odvojena problema: isključivanje atmosfere mijenja plavi veo i kontrast, a isključivanje sloja udarnog vala uklanja kupolu. Efekti vode i pare ostaju i nakon uklanjanja obaju slojeva. Browser provjere završile su bez zabilježenih JavaScript/console error poruka; to nije mjerenje fizičke točnosti ni performansi.

**1. Atmosfera i dubina — prvi prioritet**

U AtmosphereScattering.ts:161–170 integracija zrake završava na idealnoj kugli ili vrhu atmosfere. Shader nema teksturu dubine stvarnog terena, vodenog stupa ili dima. Kamera unutar atmosfere postavlja gl_FragDepth na nulu. Atmosferski sloj ima renderOrder 10, dok plume ima 9. Zato konačna slika može dobiti atmosferski doprinos iza lokalnog objekta kao da se i taj dio zrake nalazi ispred njega. To je nalaz iz koda; intenzitet vidljive greške ovisi o kadru.

Predloženo rješenje: zajednički prolaz boje i dubine neprozirne scene; atmosfersko raspršenje integrirati samo do vidljivog fragmenta. Za nebo integrirati do izlaza iz atmosfere. Prozirne čestice trebaju atmosfersko prigušenje do vlastite udaljenosti, bez dvostrukog nanošenja istog veo-efekta. Jedan završni HDR/tone-mapping postupak.

Brunetonova implementacija eksplicitno odvaja nebo i aerial perspective do točke. Hillaire daje praktičnu arhitekturu s tablicama za nebo i atmosferu. Predlažem adaptaciju tih načela u postojeći SolarPostProcessing, uz korištenje već postojećih tablica tamo gdje su kompatibilne. Nije potrebna zamjena cijele aplikacije Unreal Engineom.
Izvori: [Bruneton — funkcije](https://ebruneton.github.io/precomputed_atmospheric_scattering/atmosphere/functions.glsl.html), [WebGL2 demo](https://ebruneton.github.io/precomputed_atmospheric_scattering/demo.html), [Hillaire — izvorna implementacija](https://github.com/sebh/UnrealEngineSkyAtmosphere), [Three.js DepthTexture](https://threejs.org/docs/pages/DepthTexture.html).

Za kontrolu: isti oblak na različitim udaljenostima, planina ispred oblaka, kamera na 2 m / 2 km / 30 km, dnevna i noćna strana. Atmosfera se ne smije globalno ugasiti radi ljepše lokalne slike.

**2. Ocean — nedostaje slijed šupljina → povrat vode → mlaz**

OceanImpactRenderer.ts računa promjer vodene forme iz flashRadiusM. Mlaz i vanjski rub kreću zajedno od t=0 i dijele istu balističku krivulju. U retku 90 Math.max(0, height) uklanja sve negativne visine. Ne postoji geometrijsko udubljenje vode niti njegovo urušavanje. Zbog toga trenutačni oblik čita se kao fontana ili vijenac.

NASA-in prikaz oceanskih udara opisuje nastanak šupljine, njezino popunjavanje i središnji mlaz te valni paket. To koristim kao kvalitativnu referencu za slijed; njihove rezultate za određene veličine i dubine ne treba primjenjivati na sve udare.
Izvor: [NASA — Tsunami Generation from Asteroid Airburst and Ocean Impact](https://www.nas.nasa.gov/pubs/ams/2016/09-22-16.html), [zaključci i primjeri u slajdovima](https://www.nas.nasa.gov/assets/nas/pdf/ams/2016/AMS_20160922_Robertson.pdf).

Predloženo:
- Bljesak i izbacivanje vode u prvom dijelu događaja.
- Rastuća lokalna šupljina u vodenoj površini, s rubom i kapljicama.
- Povrat vode i odgođeni središnji mlaz.
- Širenje i hlađenje pare, pad kapljica i odvajanje valnog paketa.

Potrebni su zasebni parametri cavityRadius/depth, collapseTime, jetHeight, spray i wavePacket, izvedeni iz terminalne energije, kuta i dubine kroz jasno označen približni model. Radijus bljeska nije zamjena za polumjer šupljine. Za bliski prikaz preporučujem lokalnu deformabilnu vodenu plohu i zasebne čestice za prevjese/raspršivanje. Heightfield sam ne može predstavljati svu preklopljenu vodu.

**3. Valovi i materijal vode**

Postojeći kod koristi izraz c=sqrt(g/k*tanh(kh)), ali shader crta fiksan broj prstenova preko plohe čiji se radijus povećava. Faza ovisi o UV koordinati, a valna duljina korištena u brzini ostaje drukčije definirana. Zato postojanje ispravnog izraza za brzinu ne čini cijelu animaciju disperzivnim modelom. Negativna polovica vala dodatno je odrezana.

Predloženo je vezati fazu uz stvarnu udaljenost u metrima i vrijeme, dopustiti vrhove i udoline te odvojiti brzinu valnih vrhova od kretanja omotača paketa. Za lokalni vizualni model moguće je koristiti zbroj disperzivnih komponenti i prigušenje; jednostavnu shallow-water jednadžbu ne bih predstavljao kao ispravan model kratkih valova u dubokom oceanu. [GeoClaw dokumentacija](https://www.clawpack.org/v5.9.x/bouss1d.html) objašnjava potrebu za disperzijom kada valovi nisu dovoljno dugi u odnosu na dubinu.

Voda treba normale iz deformacije, odraz neba, Fresnel i apsorpciju/prigušenje prema dubini; pjena treba pratiti rubove/raspad vode umjesto da bude samo svijetla kružnica. [Službeni Three.js GPU water demo](https://threejs.org/examples/webgl_gpgpu_water.html) daje koristan tehnički primjer, ali nije model udara ni gotov tsunami solver. U instaliranoj verziji Three.js postoje GPUComputationRenderer i Water moduli, pa WebGPU migracija nije preduvjet.

Plitku vodu treba odvojiti od dubokog oceana. Sada se kopneni izbačaji isključuju pri svakom oceanskom udaru; to ne pokriva udar koji dosegne dno. Za tu granu treba dodati i validirati zaseban model prolaza kroz vodeni stup.

**4. Udarni val — vidljiva kupola i pogrešna visina na planinama**

SurfaceShockwaveRenderer.ts:160–164 boji prozirnu sferu prema rubnom kutu gledanja. To izravno stvara kupolu vidljivu na snimkama. Njezino postojanje nije dokaz da se tako mora vidjeti tlak zraka.

Predlažem kratak i suptilan pojas optičkog izobličenja uz slabljenje s vremenom. Prašinu na tlu i eventualni kondenzacijski trag treba tretirati kao zasebne efekte s uvjetima nastanka. Pojačana vidljivost udarnog vala može ostati eksplicitna edukacijska opcija.

Dodatna konkretna greška: površinski atmosferski val polazi od ENU upM=3, a mapImpactEnuToBodyLocal koristi referentnu kuglu. Na lokaciji visine 4.234 m to postavlja središte oko 4,2 km ispod tla. Prizemni prsten također prati osnovni elipsoid, ne lokalni DEM. Potrebno je jedno dosljedno sidro događaja za sve renderere.

**5. Reljef, krater i ponovno padanje izbačaja**

Postojeći teren ima 192 segmenta preko oko 900 km: korak mreže je približno 4,7 km, a izvor visina oko 9,3 km sjever–jug. Više poligona ne donosi nove izmjerene detalje. Globalna tekstura i takav reljef imaju jasno ograničenje u bliskom kadru.

Preporuka je zadržati postojeći grubi model za pregled planeta, a uz mjesto udara učitavati detaljnije pločice. Za kopno kandidat je Copernicus GLO-30/GLO-90; za regionalno morsko dno ETOPO 2022 od 15 lučnih sekundi (~460 m na ekvatoru). Copernicus je DSM, uključuje vegetaciju i građevine; nije svugdje model golog tla. Podatke treba uskladiti po koordinatama, vertikalnoj referenci i obali. Izvori: [Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM), [NOAA ETOPO 2022](https://www.ncei.noaa.gov/products/etopo-global-relief-model).

Blizu udara koristiti finiju mrežu, prema rubu rjeđu; uzorkovanje i učitavanje ograničiti na vidljivo područje. Obalu klasificirati odgovarajućom maskom vode, umjesto isključivo povezivanjem negativnih visina. Provjeriti pristup/atribuciju pri pakiranju podataka; ključeve servisa ne stavljati u frontend.

CraterPatchRenderer.ts:132 ograničava dubinu zdjele na dio sitnog površinskog odmaka, a postojeći teren ostaje ispod. To je plitki geometrijski/dekorativni sloj, ne potpuno iskopan krater. Za stvarnu zdjelu treba deformirati lokalni teren i ukloniti/dubinski maskirati osnovnu kuglu ispod zamjenskog segmenta. Inače će kugla zatvoriti udubljenje. Isto vrijedi za duboku šupljinu oceana i prikaz morskog dna.

EjectaRenderer.ts:242 provjerava pad čestice na osnovni elipsoid, ne na DEM. Nakon dodavanja planina dio čestica može nastaviti ispod stvarnog tla. Kontakt mora uzorkovati istu deformiranu površinu koju vidimo.

Trenutačna formula polumjera kratera 80*Mt^0.28 autorska je skala. Za fizički utemeljeniju procjenu preporučujem zaseban model prolaznog i konačnog kratera, s gravitacijom, podlogom i parametrima udara te jasno dokumentiranim rasponom primjene. [Collins, Melosh i Marcus (2005)](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1945-5100.2005.tb00157.x) primjeren su polazni izvor, ne automatska potvrda točnosti naše implementacije.

**6. Para i dim**

VolumetricPlumeRenderer koristi raspoređene plohe okrenute prema kameri. To je legitiman postupak za realtime prikaz, ali nema čitanja dubine scene za mekano presijecanje terena. Osvjetljenje se računa prema fiksnom smjeru u prostoru kamere, umjesto prema stvarnom Suncu, pa se oblik svjetla može vezati uz kameru.

Prvo dodati soft particles, osvjetljenje iz istog Sunčevog smjera kao teren i odvojene profile pare/prašine. Zatim po potrebi zamijeniti glavni oblak lokalnim raymarchanim volumenom na high/ultra; zadržati jeftinije čestice za medium/low, kapljice i fragmente. [NVIDIA soft particles](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-23-high-speed-screen-particles) i [Three.js WebGL volume primjer](https://threejs.org/examples/webgl_volume_perlin.html) korisne su implementacijske reference.

**7. Kamera i True scale**

True scale trenutačno vrijedi za planet, dok Enhanced može povećati efekte 16 puta, a sam asteroid ima proxy za čitljivost. To je označeno u UI-ju, ali vizualni odnos prema okolini ipak se gubi. Kamera dodatno povećava udaljenost s rastom plumea.

Predlažem zadržati True scale planeta, koristiti 1× efekte u lokalnom fizičkom pogledu, a čitljivost rješavati kadrom i odvojenim markerom. Stvarni Ground observer neka ostane na odabranoj visini iznad terena, uz provjeru prepreka; Cinematic i Overview neka budu zasebni pogledi. Optički FOV i daljina kadra trebaju glatke, ograničene promjene. Ne treba obećati da promatrač s tla uvijek vidi cijeli oblak i mjesto udara preko zakrivljenosti Zemlje.

**Predloženi redoslijed provedbe**

| Korak | Konkretna isporuka | Provjera uspjeha |
|---|---|---|
| 1 | Ispravno sidro površinskog vala, stabilna lokalna kamera, jasna skala efekata | Ground observer prati teren; efekti ne startaju ispod planine |
| 2 | Dubina scene i ispravno uklapanje atmosfere/prozirnih efekata | Oblak ispred planine nema udaljeni atmosferski sloj ispred sebe |
| 3 | Šupljina oceana, odgođeni mlaz, čestice i koherentni valovi | Čitljiv slijed događaja; nema fontane od samog početka |
| 4 | Detaljnije pločice terena, stvarno udubljenje i kontakt izbačaja | Krater ima dubinu; čestice staju na vidljivom tlu |
| 5 | Osvjetljenje pare/dima, mekani kontakti, volumenski detalji | Rotacija kamere ne mijenja Sunčev smjer na oblaku |
| 6 | Profiliranje i kvalitetne degradacije prikaza | Mjerenja na ciljnom računalu; nema tvrdnje o FPS-u bez mjerenja |

Promjene bih zadržao u sadašnjem Three.js/WebGL2 projektu. Prvi prototip treba imati jednu fiksnu oceansku i jednu kopnenu scenu za usporedive snimke prije proširenja na sve lokacije.

Ocean renderer sada pri aktivnim trima plohama obrađuje do 23.667 vrhova na CPU-u po ažuriranju i za svaki uzorkuje teren. To je izračun iz veličine mreže, ne benchmark. Maske treba predračunati, a animaciju visina premjestiti na GPU; renderiranje oblaka niže rezolucije procijeniti tek uz mjerenja i provjeru rubova.

**Kako izbjeći ponavljanje istog problema**

Postojećih 93 testa provjerava funkcionalne ugovore, numeriku i životni ciklus. Ne dokazuju da je vodeni stup uvjerljiv ili da je atmosfera ispravno uklopljena.

Uz njih su potrebne referentne vremenske sekvence: duboki ocean, plićak, ravnica, planina, obala i airburst; dan/noć; 1× i Enhanced; kamera s tla i iz zraka. Posebno provjeriti negativni pomak vode, stvarnu dubinu kratera, dodir čestica s reljefom, odsutnost trajne kupole, nepromjenjivost rezultata pri pauzi/replayu i jednako Sunčevo osvjetljenje svih efekata. Za fizičke dimenzije koristiti dokumentirane referentne slučajeve i iskazati odstupanja.

Ovo je istraživanje i izvediv plan. Predložene zamjene još nisu ugrađene u aplikaciju.
