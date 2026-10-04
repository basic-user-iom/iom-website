# Dijeljenje, izvoz slika i Learn kamere — lokalni pregled

Lokalni razvoj: http://127.0.0.1:5194/demos/solar-system/
Lokalni build: http://127.0.0.1:5198/demos/solar-system/

Ništa nije objavljeno online. Snimke i testovi su iz Playwright emulacije Chromiuma i WebKita na ovom Windows računalu, ne sa stvarnog iPhonea ili Androida.

## Share & save view

U traci scene dodan je Share (na mobitelu ikona s pristupačnim nazivom).

- Copy link sprema UTC trenutak, odabrano tijelo, kameru i ručni orbit/zoom, skalu, bliski preset, prirodni satelit/letjelicu u inspekciji te osnovne slojeve i Venus display. Primatelju se otvara pauzirano. Različit omjer ekrana mijenja vidljivo polje; ne obećava se identičan screenshot na drugom ekranu.
- Link je verzioniran i provjeren prije uporabe: datum i dostupna pokrivenost, valjani objekti i modovi, konačne koordinate i ograničena veličina. Nevaljani link ostavlja aplikaciju upotrebljivom uz objašnjenje. Uz čitljiv UTC datum čuva se točan postojeći TDB trenutak simulacije, pa dijeljenje ne uvodi dodatno milisekundno zaokruživanje položaja. Ne mijenja se postojeći model vremena.
- Lokalne poveznice su jasno označene: localhost nije javna poveznica koju bi udaljeni klijent mogao otvoriti. Kada je ova verzija objavljena, isti gumb koristi adresu objavljene stranice.
- Link u postojećoj kartici također se primjenjuje. Navigacija na novi #view završava prethodnu sesiju i učitava zapisani prikaz; ne dodaje renderer u postojeću petlju.
- Ako pristup međuspremniku nije dopušten, polje ostaje dostupno za ručno kopiranje. Ne koristi se servis za skraćivanje linkova, analitika ili nova mrežna pohrana.
- Prepare PNG stvara pregled; Save PNG preuzima datoteku, a Open image omogućuje spremanje kroz preglednik na telefonu. U slici su 3D scena, vidljivi nazivi/točkice, UTC, skala i kontekst lekcije/scenarija. Screenshot ima vlastiti natpis, bez prekrivanja scene kontrolama.
- Ponovno se crta postojeći renderer i slika se kopira u istom JavaScript zadatku. Nije trajno uključen preserveDrawingBuffer i ne stvara se novi WebGL kontekst. Izlaz je ograničen na 2048 px širine i najviše 2× CSS rezoluciju.
- Lekcije i aktivni scenariji mogu se spremiti kao PNG. Poveznica za navigaciju zasad dijeli opservatorij, bez serijalizacije nastavnog napretka ili simuliranog katastrofalnog događaja. Bez WebGL-a izvoz slike je onemogućen s objašnjenjem.

## Kamere u lekcijama

Uzrok nejasnog početnog prikaza bio je korištenje općeg pregleda sustava: njegov kadar uključuje znatno udaljenije putanje i koristi nizak kut. Lekcija sada ima zaseban prikaz kamere koji ne mijenja astronomske podatke.

- Veličine: početak i provjera znanja gledaju unutarnje planete odozgo, sa Suncem u sredini. Isti kadar koristi se za usporedbu stvarne i povećane skale. Korak o udaljenostima proširuje prostor do Jupitera. Zemlja, Jupiter i Sunce imaju zasebne veće krupne planove; tekst i dalje nalaže usporedbu tablice, a ne promjera slika na ekranu.
- Godišnja doba: kamera je sa strane linije Sunce–Zemlja, s vidljivim dnevnim i noćnim dijelom. Postojeći nagib osi i UTC osvjetljenje nisu promijenjeni; dijagram i izračuni objašnjavaju sezonsku geometriju.
- Zemlja–Mjesec: kamera kadrira oba tijela oko sredine njihova razmaka, odozgo, sa smjerom Sunčeva svjetla s desne strane. Veličine i udaljenosti ostaju fizičke, pa su tijela mala; panel zasebno prikazuje osvijetljeni dio Mjeseca viđen sa Zemlje.
- Sve kompozicije računaju udaljenost prema užem vidnom polju, pa se prilagođavaju panelima, portrait/landscape prikazu i fullscreenu. Kadar se osvježava i tijekom nastavne reprodukcije.
- U lekcijama je pozadina mirnija: nema karte Mliječne staze, kataloških zvijezda, kometa ili statističkih pojaseva; nazivi i putanje odnose se na relevantna tijela. Pri izlasku vraćaju se prethodni slojevi i stanje kamere. Ostaje postojeća pauza/reduced-motion kontrola.

## Rezultati provjere

- 700 jediničnih testova, uključujući validaciju URL-a i geometriju nastavnih kamera: prolaz.
- Svih 18 koraka u sva tri Learn modula × Chromium/WebKit × 1366 × 768, 390 × 844, 667 × 320: **108 provjera kadra**. Centriranje, popunjenost kadra u krupnim planovima, Zemlja/Mjesec vidljivi zajedno, bez horizontalnog overflowa i JavaScript iznimaka. [Podaci](camera-results.json).
- Snimke: [desktop](learn-desktop.png), [mobitel](learn-mobile.png), [landscape](learn-landscape.png), [godišnja doba](seasons-camera.png), [PNG iz WebKita](webkit-moon-export.png).

Nema potvrde na fizičkom iOS uređaju. Znanstveni sadržaj Learn moda i dalje je nacrt za stručni pregled. Ovo je dorada prezentacije i navigacije, ne promjena efemerida, rotacija, radijusa ili drugih astronomskih parametara.

- **30 povrataka stanja:** Chromium i WebKit × sve tri lekcije × Saturn from Earth, Earth–Moon, ručni free orbit, Voyager 1 i Io. Kamera, cilj, preset, inspekcija i sedam referentnih slojeva vraćaju se; provjeren je i fokus tipkovnice. [Podaci povratka](preset-restore.json).
- **Share provjere u WebKitu s mobilnom emulacijom i DPR 3:** poveznica u novoj sesiji i istoj kartici, točan trenutak simulacije, položaj kamere, Saturn from Earth, Voyager, obrada nevaljanog URL-a, kopiranje uz odbijen clipboard, PNG s nazivima i kontekstom — prolaz. Postojeći test naziva i mobilne trake također prolazi.
- [Izvezeni PNG](scene-export.png), [Share na mobitelu](share-mobile.png), [Share na desktopu](share-desktop.png). WebKit screenshot stranice na Windowsu može izostaviti 3D canvas u pozadini; izvezeni PNG sadrži stvarne piksele scene, bez tog ograničenja snimanja prozora.

- **36 provjera responsive lekcija:** Chromium i WebKit × sve tri lekcije × normalan 3D / namjerno nedostupan WebGL × 360 × 800, 768 × 1024, 667 × 320. Prolaze koraci, oba pitanja, restart, izlazak/ponovni ulazak, fullscreen, resize, vidljive dodirne površine najmanje 44 × 44 px i unutarnje skrolanje. Nema horizontalnog overflowa ni JavaScript iznimaka. [Matrica](education-matrix.json).

## Ponovljiva provjera

Iz mape solar-system, s razvojnim serverom na portu 5194:

```powershell
$env:SOLAR_SYSTEM_E2E_PORT='5194'
npm run test:e2e -- e2e/sharing.acceptance.spec.ts e2e/object-names.acceptance.spec.ts
npm run test:e2e -- e2e/sharing.acceptance.spec.ts e2e/object-names.acceptance.spec.ts --config playwright.webkit-mobile.config.ts
$env:SOLAR_SYSTEM_REVIEW_URL='http://127.0.0.1:5194/demos/solar-system/'
node scripts/verify-lesson-framing.mjs
node scripts/verify-learning-camera-restore.mjs
$env:REVIEW_VIEWPORTS='[[360,800],[768,1024],[667,320]]'
node scripts/verify-education-review.mjs
```

- Završna četiri Share acceptance testa prolaze u Chromiumu i WebKitu (uz zasebno ponovljenu provjeru bez WebGL-a). U tekstualnom modu polje datuma prati učitani UTC zapis. Ako korisnik zatim odabere drugi objekt i datum pa uključi 3D, taj noviji odabir ostaje sačuvan; odgođena dijeljena kamera ga ne prepisuje.
- Završni TypeScript/build, ESLint izmijenjenog koda i provjera whitespacea: prolaz. Lokalni pregled vraća HTTP 200. Nije izvršen commit, push ili produkcijski deploy.
