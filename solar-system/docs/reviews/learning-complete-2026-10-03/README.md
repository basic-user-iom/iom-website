# Learn — sve tri lekcije, lokalni pregled 3. listopada 2026.

Lokalni pregled: http://127.0.0.1:5198/demos/solar-system/ → **Learn**. Razvojna verzija: http://127.0.0.1:5194/demos/solar-system/. Ništa nije objavljeno online. Ovo nastavlja [prvu isporuku fallbacka i lekcije o veličinama](../learning-fallback-2026-10-03/README.md).

## Što je dodano

Learn otvara pristupačan izbornik triju lekcija:

- **Sizes and distances:** 7 koraka, usporedba fizičkih promjera Zemlje, Jupitera i Sunca, stvarna i povećana skala, udaljenosti u AU.
- **Why we have seasons:** 5 koraka, usporedba lipnja, prosinca i ožujka te siječanjski primjer koji pobija objašnjenje godišnjih doba samo udaljenošću od Sunca. Prikazane su Sunčeva deklinacija i geometrijske duljine dana na 45° sjeverno i južno.
- **Earth, Moon and Sun:** 6 koraka, postojeći Earth–Moon pogled iz svemira uz odvojenu ilustraciju Mjesečeva osvijetljenog dijela gledanog iz središta Zemlje. Primjeri prve četvrti, mlađaka, uštapa i zadnje četvrti te geometrija pomrčina i uloga nagiba Mjesečeve orbite.

Svaka lekcija ima cilj, kratke korake, dvije provjere razumijevanja s povratnom informacijom, Previous, Next, Restart i Exit lesson. Tekst je dostupan i bez WebGL-a. Kada nema ni orbitalnih podataka, ostaju objašnjenja; brojke se ne izmišljaju. Novi datumi stalno su označeni kao **Teaching example**. Nema novih računa, analitike ni pohrane odgovora učenika.

## Ponovno korištene komponente i stanje

Zadržani su postojeća tura, scenariji, zajednički odabir/fokus, UTC model osvjetljenja Zemlje, JPL efemeride i Earth–Moon kamera. Koraci prolaze kroz postojeći SimulationControlPort. Za izbornik se koristi ObservatoryDialog s tipkovničkim fokusom i Escape zatvaranjem; panel lekcije i spremanje prethodnog stanja prošireni su iz prve isporuke.

Izlazak vraća prethodni UTC datum, brzinu/smjer/pauzu vremena, skalu, odabir, floating origin, kameru i bliski preset. Kamera za Voyager i prirodne satelite ponovno dobiva svoje granice navigacije. Lekcije počinju pauzirane; eksplicitni Play time pokreće jedan dan u sekundi, a Next ponovno pauzira vrijeme. Reduced-motion se poštuje. Astronomski parametri, teksture, shaderi i izvorne efemeride nisu mijenjani.

Fallback prekida blokirajuće učitavanje pri grafičkoj grešci. Back to IOM, katalog i Learn ostaju dostupni. Ovisne 3D kontrole jasno su nedostupne. Try 3D again ne ponovno preuzima podatke i ne umnaža render-petlje/listenere.

## Izračuni i granice modela za stručni pregled

- Deklinacija: postojeći vektor od Zemlje prema Suncu transformiran postojećom EarthRotationModel orijentacijom. Geometrijska duljina dana: 24/π × acos(−tan φ × tan δ), uz ograničenje argumenta na [−1, 1]. Polutke se uspoređuju na ±45°. Nema promjene Zemljina nagiba, ni hipotetskog eksperimenta s osi.
- Faza: (1 + cos i)/2, gdje je i kut Sunce–Mjesec–Zemlja. Elongacija je geocentrični kut između Mjeseca i Sunca. Izračun koristi iste fizičke ECLIPJ2000 vektore kao aplikacija, prije mapiranja osi za renderer. Fiksna orijentacija malog diska je nastavna konvencija; nije lokalni horizont promatrača.
- Sezonski datumi 2026. približni su nastavni primjeri, a ne izračun točnog trenutka solsticija/ekvinocija. Duljina dana zanemaruje refrakciju, teren i prividni polumjer Sunca. Nije prognoza izlaska/zalaska za određenu lokaciju.
- Faze su trenutačna geocentrična geometrija, bez vremena putovanja svjetlosti, paralakse, libracije, terena ili sjene pomrčine. Dijagram pomrčina ima ilustrativne veličine, razmake i sjene; ne predstavlja predviđanje pomrčine na nastavnom datumu.
- Mali SVG dijagrami služe lekcijama. Zasebni 2D pregled orbita bez WebGL-a i dalje je samo procijenjena opcija; nije izgrađen niti je zamijenjen 3D renderer.

Sadržaj je označen kao radni nacrt za stručni pregled. Prolaz tehničkih testova ne predstavlja neovisnu obrazovnu validaciju.

Izvori su dostupni i uz lekcije: [NASA — godišnja doba](https://spaceplace.nasa.gov/seasons/en/), [NASA — Earth Facts](https://science.nasa.gov/earth/facts/), [USNO — dan i noć uz ekvinocij](https://aa.usno.navy.mil/faq/equinoxes), [NASA — Mjesečeve faze](https://science.nasa.gov/moon/moon-phases/), [NASA — pomrčine](https://science.nasa.gov/moon/eclipses/), [USNO — faze i osvijetljeni dio](https://aa.usno.navy.mil/faq/moon_phases). Izvori lekcije o veličinama ostaju navedeni u prvoj isporuci i aplikaciji.

## Provjere funkcija i rasporeda

- Prolazi 690 jediničnih testova u 98 datoteka, TypeScript, ESLint izmijenjenih izvora i testova te lokalni production build s provjerom izvornih asseta. Postojeće upozorenje o velikim JavaScript bundleovima ostaje.
- Novi izračuni provjereni su analitičkom geometrijom mlađaka/uštapa/četvrti, očekivanim sezonskim deklinacijama i duljinama dana, rasponima faza na nastavne datume, površinom osvijetljenog dijela SVG diska i ponašanjem pri nedostajućoj geometriji. Postojeći UTC testovi Zemljine rotacije i validacija efemerida prolaze bez izmjena parametara.
- Testovi fallbacka pokrivaju nedostupan WebGL pri provjeri mogućnosti, neuspjelo stvaranje renderera nakon uspjele provjere, tri neuspjela ponovna pokušaja i oporavak. Broj registriranih globalnih render-listenera ostaje stabilan; tijekom greške nema render-petlje, nakon oporavka postoji jedna. Zasebno je testiran prekid preuzimanja orbitalnih podataka.
- [Matrica preglednika](browser-matrix.json): **60 prolaza**, Chromium 151.0.7922.34 i WebKit 26.5, sve tri lekcije, normalan 3D i namjerno blokiran WebGL. Veličine: **1366 × 768, 768 × 1024, 360 × 800, 390 × 844 i 844 × 390**. U svakoj kombinaciji provjereni su svi koraci, oba točna odgovora, Previous, Restart, Exit, ponovni ulazak, fullscreen i resize. Nema horizontalnog overflowa; trajne kontrole lekcije imaju najmanje 44 × 44 px i ostaju unutar ekrana. Nema JavaScript pageerror događaja.
- [Povratak kamere](camera-restore.json): **30 prolaza**, pet početnih pogleda × tri lekcije × dva preglednika. Saturn from Earth, Earth–Moon, ručni orbit nakon Shift + wheel zooma, Voyager 1 i Io vraćaju položaj, metu, način i odabir. Provjereni su tipkovnički ulazak, fokus naslova koraka i povratak fokusa na Learn.
- Mobilni acceptance testovi zasebno provjeravaju zadane datume novih lekcija, sezonske brojke, lunarne postotke, netočan/točan odgovor, playback/pauzu, potpuno vraćanje prethodnog vremena/skale/kamere, odustajanje od izbornika tipkom Escape i ulazak u Learn iz fullscreena. Bez orbitalnih podataka brojčani readouti izostaju uz objašnjenje.

**Ograničenje testiranja:** sve dimenzije mobitela/tableta su emulacija viewporta i dodira na Windows računalu. Nisu testirani stvarni iPhone, iPad, Android, Chromebook niti fizički tablet. Ne jamčimo rad na svakom Chromebooku. Windows Playwright WebKit nije zamjena za provjeru na iOS Safariju.

**Snimke WebKita:** ovaj headless build izostavlja WebGL canvas iz screenshota stranice. Zato je snimka sučelja odvojena od izravnog očitanja WebGL drawing buffera. Testni preserveDrawingBuffer koristi se samo za snimanje, nije uključen u aplikaciji. [Izravna snimka Zemlje](webkit-earth-canvas.png) potvrđuje da je 3D sadržaj nacrtan; crni canvas na WebKit screenshotu stranice ne predstavlja rezultat 3D renderera.

## Screenshotovi

- [Learn izbornik na mobitelu](mobile-learn-menu.png)
- [Desktop: godišnja doba](desktop-seasons.png) i [izračuni/ilustracija](desktop-seasons-measurements.png)
- [Desktop: Mjesec gledan sa Zemlje](desktop-moon-measurements.png)
- [Uski mobitel: tekst i stalne kontrole](mobile-seasons.png)
- [Landscape: Earth–Moon lekcija](landscape-moon.png)
- [Tablet: WebKit sučelje](tablet-webkit-interface.png), uz navedeno ograničenje screenshotova
- [Mobitel bez WebGL-a](mobile-fallback.png)
- [WebKit: godišnja doba bez 3D-a](mobile-webkit-text-seasons.png)

## Ponovljiva provjera

Iz direktorija `solar-system`:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5198 --strictPort
# U drugom terminalu, uz development server na 5194:
$env:SOLAR_SYSTEM_E2E_PORT='5194'
npm run test:e2e -- e2e/education.acceptance.spec.ts e2e/learning.acceptance.spec.ts e2e/webgl-data-mode.acceptance.spec.ts
node scripts/verify-education-review.mjs
node scripts/verify-learning-camera-restore.mjs
node scripts/profile-learning-review.mjs
```

Matrica i snimke nove faze nastaju u `tmp/education`; camera/performance skripte koriste `tmp/learning`. Varijabla `SOLAR_SYSTEM_REVIEW_URL` može zadati drugi lokalni pregled. Nema deploy koraka. Za objavu treba zasebno odobrenje.


## Lokalno mjerenje učitavanja i performansi

AMD Ryzen 9 7950X 16-Core Processor            , win32 10.0.26300; Playwright headless, novi kontekst preglednika za svaki slučaj, localhost build, DPR 1, bez CPU/mrežnog throttlinga. Učitavanje je vrijeme od navigacije do dostupnog Learn i uklonjenog početnog ekrana. Frame interval je vanjski requestAnimationFrame uzorak od 2,5 s u pauziranom Zemljinu koraku lekcije o veličinama.

| Preglednik | Viewport | 3D spreman | Tekst spreman | 3D interval, medijan / p95 |
| --- | --- | --- | --- | --- |
| chromium | 1366 × 768 | 6.44 s | 0.46 s | 66.7 / 83.4 ms |
| chromium | 768 × 1024 | 6.26 s | 0.39 s | 66.6 / 66.7 ms |
| chromium | 360 × 800 | 6.34 s | 0.32 s | 33.4 / 50.0 ms |
| chromium | 844 × 390 | 7.40 s | 0.30 s | 50.0 / 66.7 ms |
| webkit | 1366 × 768 | 5.51 s | 0.51 s | 31.0 / 46.0 ms |
| webkit | 768 × 1024 | 5.27 s | 0.47 s | 31.0 / 33.0 ms |
| webkit | 360 × 800 | 5.26 s | 0.51 s | 15.0 / 30.0 ms |
| webkit | 844 × 390 | 5.50 s | 0.47 s | 16.0 / 31.0 ms |

Chromium koristi SwiftShader softverski renderer. WebKit na ovom Windows hostu izlaže oznaku “Apple GPU”; to nije identifikacija testiranog Apple uređaja. Ovo su kratki lokalni uzorci, bez obećanja mrežne brzine ili FPS-a na stvarnom mobitelu. Tekstualni način nema vlastitu 3D render-petlju; njegov uzorak rAF mjeri preglednik. Screenshot preserveDrawingBuffer nije korišten za ova mjerenja. [Sirovi rezultati](performance.json).

Orbitalni binarni paketi ostaju približno 35 MB; ova faza ne tvrdi da je smanjila njihovo preuzimanje. Učitavanje dodatnih kataloga na zahtjev ostaje zasebna moguća optimizacija.

Posljednja provjera regresija: svih šest acceptance testova prošlo je, uključujući nove dvije lekcije, mobilni popis planeta i točkice za lociranje te izlazak iz svih pet postojećih scenarija.
