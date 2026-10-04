# Learn i tekstualni način — lokalni pregled, 3. listopada 2026.

Spremno za pregled: popravak nedostupnog WebGL-a i prva lekcija **Sizes and distances**. Lokalni build: http://127.0.0.1:5198/demos/solar-system/ — odabrati **Learn**. Razvojni poslužitelj ostaje na portu 5194. **Ništa nije objavljeno online.** Preostale dvije lekcije čekaju provjeru ovog pristupa, prema dogovorenom opsegu. Ne predstavljamo ovu radnu verziju kao validirani nastavni alat.

## Postojeće komponente i opseg

- Zadržani su `CinematicTourController` i postojeća automatska tura. Lekcija koristi iste kontrole odabira, fokusa i skale kroz `SimulationControlPort`; koraci se mijenjaju ručno kako bi bilo vremena za čitanje i pitanja.
- Ponovno se koriste `SimulationClock`, JPL provider/decoder i postojeći katalozi, `captureScenarioEnvironmentSnapshot`, rendererove snimke kamere te `ObservatoryViewport` za fullscreen i prilagodljiv raspored.
- Postojeći Impact Lab, Scientific Solar Evolution, Fictional Solar Supernova te oba Black-Hole scenarija ostaju odvojeni od lekcije. Ulazak u lekciju tijekom scenarija je onemogućen; Exit scenario ostaje dostupan.
- Sačuvani su Saturn from Earth, Earth–Moon pogled, Shift + wheel, zajednički odabir/fokus i mobilne ladice. Nisu promijenjeni UTC osvjetljenje, astronomski parametri, izvorne efemeride, teksture niti modeli.
- Srednji opseg za cijelu fazu: ova manja isporuka uspostavlja tekstualni način i obrazac lekcije; slijede dvije sadržajno i vizualno zasebne lekcije te stručni pregled njihova sadržaja. Nema novih računa, analitike ni pohrane odgovora učenika.

## Uzrok i popravak 95% stanja

Podaci su se već učitavali neovisno o stvaranju renderera. StartupScreen je, međutim, završetak vezao uz spreman renderer i ostavljao blokirajući ekran s greškom. Bez WebGL-a to stanje nikad nije moglo postati spremno.

Sada terminalna grafička greška odmah uklanja početni ekran. Data & text mode nudi Back to IOM, katalog 15 glavnih objekata, fizičke vrijednosti, UTC datum, dostupne udaljenosti od Sunca, izvorne podatke i tekst lekcije. Obična navigacija 3D kamerom, slojevi, tura i scenariji su nedostupni; objašnjenje je vidljivo, a System overview onemogućen. Ako zakaže i preuzimanje efemerida, statične kataloške vrijednosti i lekcija ostaju dostupne, udaljenosti su jasno označene kao nedostupne, a promjena datuma je onemogućena.

Try 3D again ponovno stvara samo komponentu renderera. Prethodni renderer, observeri i slušači čiste se kroz postojeći lifecycle; podaci i runtime se ne preuzimaju niti stvaraju iznova. Testovi tri neuspjela pokušaja potvrđuju stabilan broj slušača, nula render-petlji tijekom greške i jednu nakon uspješnog ponovnog pokretanja. Retry nakon prve greške više ne vraća blokirajući početni ekran. Nisu mijenjane postavke sigurnosti preglednika; niža kvaliteta nije ponuđena kao rješenje za nedostupan kontekst.

## Prva lekcija

Sedam kratkih koraka: stvarna skala, Zemlja, Jupiter, Sunce, povećani prikaz, udaljenosti u AU, dvije provjere razumijevanja s povratnom informacijom. Promjeri se računaju iz postojećih srednjih polumjera; udaljenosti iz razlike Sunčeva i planetarnog JPL vektora na prikazani datum. Tekst razdvaja stvarne dimenzije, nejednako povećane planete, pomicanje kamere i točkice za lociranje objekata. Koraci rade i bez grafike.

Previous, Next, Restart i Exit lesson su trajno dostupni. Sadržaj se skrola unutar panela, a gumbi imaju najmanje 44 × 44 px. Tipkovnica, vidljiv fokus, fokus naslova nakon koraka i povratak fokusa na Learn provjereni su. Lesson framing je namjerno vođen koracima; po izlasku vraća se prethodna ručna kamera. Lekcija počinje pauzirana, bez automatskog pomicanja kamere. Play time eksplicitno pokreće nastavni primjer brzinom jednog dana u sekundi; Pause time ga zaustavlja, a svaki novi korak ponovno pauzira vrijeme. Reduced-motion ostaje poštovan.

Izlazak vraća datum, brzinu, smjer, pauzu, skalu, odabir, floating origin, kameru i bliski preset. Vraćaju se i praćenje/zoom granice pri prethodnom bliskom pogledu na Voyager ili mjesec. Spremanje korisničkih preferencija privremeno je obustavljeno tijekom lekcije. U ovoj lekciji datum nije unaprijed zamijenjen: kontekst objašnjava da playback pomiče nastavni primjer i da izlazak vraća izvorni datum.

Izvori u sučelju i za stručni pregled:

- [NASA/JPL — Make a Scale Solar System](https://www.jpl.nasa.gov/edu/resources/project/make-a-scale-solar-system/)
- [NASA — Solar System Sizes](https://science.nasa.gov/resource/solar-system-sizes/)
- [NASA — Jupiter Facts](https://science.nasa.gov/jupiter/jupiter-facts/)

## Provjere

- TypeScript, ESLint izmijenjenih izvora i provjera svih build asseta: prolaz. Lokalni production build prolazi; postojeća upozorenja o velikim bundleovima ostaju.
- Jedinični testovi: 685 prolaza.
- Novi browser testovi: potpuna prva lekcija, pogrešni i točni odgovori, vrijeme/pauza, ponovno pokretanje i ulazak, fullscreen, točno vraćanje stanja, vraćanje Voyagera i Ioa; nedostupan kontekst, neuspjelo stvaranje renderera nakon uspjele provjere podrške, ponovljeni retry, oporavak i zasebna greška preuzimanja podataka.
- Postojeće regresijske provjere: izlazak iz svih pet scenarija s mobilnom ladicom zatvorenom i u fullscreenu; mobilni izbornik planeta; točkice udaljenih objekata. Prolaz.
- Chromium i WebKit: 1366 × 768, 768 × 1024, 360 × 800 i 844 × 390; normalan 3D i namjerno blokiran WebGL, ukupno 16 kombinacija. U svakoj provjereni svi koraci, kviz, fullscreen, Previous, Exit, ponovni ulazak, Restart i promjena širine prozora. Bez horizontalnog overflowa, gumbi ostaju u prozoru i imaju površinu najmanje 44 × 44. Dodatni touch test vraćanja stanja radi na 390 × 844.
- Oba preglednika: povratak u Saturn from Earth, Earth–Moon, ručni orbit nakon Shift + wheel zooma, Voyager 1 i Io, uz tipkovnicu i fokus. [Snimke stanja](camera-restore.json).
- [Matrica rezultata](browser-matrix.json). Windows WebKit screenshot stranice izostavlja 3D canvas čak i uz testni preserveDrawingBuffer. Zato snimke WebKita potvrđuju samo raspored sučelja. Izravno očitavanje canvasa uz preserveDrawingBuffer potvrđuje stvarno renderirane Zemlju, pozadinu i orbite: [sadržaj WebGL canvasa](webkit-3d-canvas.png), 529 × 275 px, 36.048 nezatamnjenih piksela, gl.getError() = 0. Testni override nije uveden u aplikaciju. Jedna postojeća shader-kompajlerska poruka upozorava na potencijalno neinicijaliziran f_proceduralBands; shaderi u ovoj doradi nisu mijenjani. To nije dokaz rada na stvarnom Safari/iPhone uređaju.

**Stvarni uređaji:** nisu testirani iPhone/iPad, Android, Chromebook niti fizički tablet. Sve navedene mobilne dimenzije su emulacija viewporta/dodira na Windows računalu. Ne jamčimo rad na svakom Chromebooku.

## Lokalno mjerenje performansi

AMD Ryzen 9 7950X 16-Core Processor, Windows 10.0.26300; Playwright Chromium 151.0.7922.34 i WebKit 26.5, headless, DPR 1, bez CPU/mrežnog throttlinga. Svaki slučaj koristi novi kontekst preglednika, localhost production build. Učitavanje je vrijeme od navigacije do dostupnog Learn i uklonjenog početnog ekrana. Frame interval je vanjski requestAnimationFrame uzorak od 2,5 s u pauziranom Zemljinu koraku, bez screenshot overridea.

| Preglednik | Viewport | 3D spreman | Tekst spreman | 3D frame interval, medijan / p95 |
| --- | --- | --- | --- | --- |
| chromium | 1366 × 768 | 6.09 s | 0.30 s | 66.7 / 100.0 ms |
| chromium | 768 × 1024 | 6.00 s | 0.28 s | 50.0 / 66.7 ms |
| chromium | 360 × 800 | 6.03 s | 0.29 s | 33.3 / 33.4 ms |
| chromium | 844 × 390 | 5.93 s | 0.29 s | 33.4 / 50.0 ms |
| webkit | 1366 × 768 | 5.38 s | 0.52 s | 31.0 / 32.0 ms |
| webkit | 768 × 1024 | 5.03 s | 0.50 s | 31.0 / 33.0 ms |
| webkit | 360 × 800 | 4.86 s | 0.48 s | 16.0 / 16.0 ms |
| webkit | 844 × 390 | 5.60 s | 0.47 s | 16.0 / 31.0 ms |

Chromium koristi SwiftShader softverski renderer. WebKit izlaže oznaku “Apple GPU”, ali pokrenut je na Windowsu; ta oznaka nije identifikacija testiranog Apple uređaja. Rezultati su kratki lokalni uzorci, ne mjerenje mrežnog učitavanja na mobitelu ni obećanje FPS-a. Tekstualni način nema petlju 3D renderera. [Sirova mjerenja](performance.json). Mjerenje je obavljeno prije završnog popravka vraćanja auxiliary-inspection stanja; taj popravak mijenja izlazak iz lekcije, ne početno učitavanje ni prikaz izmjerenog Zemljina koraka.

Nisu povećana preuzimanja efemerida: paket i dalje sadrži približno 35 MB binarnih orbitalnih podataka. Zasebna moguća optimizacija bila bi odgođeno učitavanje neobaveznih kataloga i scenarija; zahtijevala bi vlastite testove dostupnosti podataka i nije dio ove manje dorade.

## Screenshotovi

- [Desktop — lekcija](desktop-lesson.png)
- [Mobitel — lekcija](mobile-lesson.png)
- [Landscape — WebKit UI, bez uhvaćenog canvasa](landscape-lesson-webkit.png)
- [Tablet — WebKit UI, bez uhvaćenog canvasa](tablet-lesson-webkit.png)
- [Mobitel — rad bez WebGL-a](mobile-data-mode.png)
- [Mobitel — tekst lekcije u WebKitu](mobile-text-lesson-webkit.png)
- [WebKit — izravna snimka 3D canvasa](webkit-3d-canvas.png)

## Procjena 2D opcije — nije implementirana

SVG pregled u ravnini ekliptike može koristiti iste JPL vektore, UTC datum i zajednički odabir. Prednost je pregled odnosa i udaljenosti bez GPU-a. Ipak treba zasebno riješiti projekciju trodimenzionalnih putanja, čitljivost naziva, pan/zoom, prikaz prstenova i kratke intervale pokrivenosti letjelica/kometa. Mora jasno pisati da je riječ o projekciji; oznake objekata ne bi imale fizičku veličinu. Za mali broj glavnih objekata SVG daje pristupačniju semantiku od Canvasa 2D. Preporuka je zaseban, ograničen prototip nakon provjere tekstualnog načina; postojeći 3D renderer ostaje glavni prikaz.

## Nakon pregleda ovog pristupa

**Godišnja doba:** koristiti postojeće UTC upravljanje i osvjetljenje Zemlje, s jasno označenim nastavnim datumima tijekom godine. Usporediti polutke i nagib osi; ne uvoditi eksperimentalnu promjenu nagiba u prvu verziju. Dodati provjeru zablude o udaljenosti od Sunca. Izvor za sadržaj: [NASA — What Causes the Seasons?](https://spaceplace.nasa.gov/seasons/en/).

**Zemlja, Mjesec i Sunce:** ponovno koristiti Earth–Moon kameru, postojeće položaje i osvjetljenje, uz tekst koji razlikuje svemirski pogled od opažanja sa Zemlje. Faze i geometriju pomrčina objasniti odvojeno; ilustraciju ne označavati kao predviđanje pomrčine određenog datuma. Izvor za faze: [NASA — Moon Phases](https://science.nasa.gov/moon/moon-phases/). Za ovu lekciju potreban je poseban pregled prikaza promatrača i geometrijskih oznaka prije implementacije.

Obje će lekcije koristiti isti panel, provjeru razumijevanja, tekstualnu alternativu i spremanje/vraćanje stanja. Obrazovni sadržaj ostaje nacrt do stručnog pregleda.

## Ponovljiva provjera

Iz direktorija solar-system:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5198
# U drugom terminalu; development server za acceptance testove na 5194:
$env:SOLAR_SYSTEM_E2E_PORT='5194'
npm run test:e2e -- e2e/learning.acceptance.spec.ts e2e/webgl-data-mode.acceptance.spec.ts
node scripts/verify-learning-review.mjs
node scripts/verify-learning-camera-restore.mjs
node scripts/profile-learning-review.mjs
```

Review skripte zapisuju rezultate u tmp/learning. SOLAR_SYSTEM_REVIEW_URL može zadati drugi lokalni URL. Ne pokreću deploy i ne mijenjaju sigurnosne postavke preglednika.
