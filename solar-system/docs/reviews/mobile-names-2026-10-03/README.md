# Nazivi objekata i mobilne lekcije — lokalna dorada, 3. listopada 2026.

Pregled: http://127.0.0.1:5198/demos/solar-system/ (razvojni server: port 5194). Izmjene nisu objavljene online.

## Uzrok i promjene

Klijentov prikaz odgovara grešci u prioritetu oznaka: popis markera bio je sortiran obrnuto za raspored naziva, pa se Mjesec obrađivao prije Zemlje, a kometi prije planeta. Svaka vidljiva oznaka rezervirala je fiksnih 184 × 48 px bez obzira na svoj stvarni tekst. Tako je Mjesečev naziv mogao potisnuti Zemljin na istom malom području. Velika obojena pozadina dodatno je naglašavala dodirnu površinu od 44 px.

- **Names on/off** sada je izravno u traci iznad scene. Koristi postojeću postavku i sinkroniziran je s Objects → Screen-space labels te tipkom L. Pamti se između pokretanja.
- Isključivanje skriva samo nazive u sceni, uključujući nazive prirodnih satelita i letjelica. Planetarne lokacijske točkice i stvarna tijela ostaju vidljivi. Kataloški popis i informacijski panel ostaju čitljivi.
- Oznake su tekst sa sjenom radi kontrasta, bez velikih vidljivih okvira. Odabrani naziv je plav i podcrtan. Nevidljive dodirne površine primarnih objekata i dalje imaju najmanje 44 × 44 px; fokus tipkovnice ostaje vidljiv. Dugi nazivi skraćeni su vizualno, a puni naziv ostaje u pristupačnom nazivu i title atributu.
- Raspored koristi stvarne dimenzije dodirnih površina, pokušava više položaja uz objekt i zadržava ih unutar scene. Odabrani objekt ima prednost; zatim Sunce i planeti, pa Mjesec i kometi. Nazivi prirodnih satelita uvažavaju zauzeta područja planetarnih oznaka.
- Neodabrani Mjesec nema zaseban naziv dok je njegova projekcija unutar 48 px od Zemljine. Odabrani Mjesec ostaje imenovan, a u Earth–Moon pogledu i pri dovoljnoj udaljenosti projekcija vidljiva su oba naziva. To je pravilo čitljivosti sučelja, bez promjene položaja ili veličina tijela.
- Na uskim ekranima fullscreen koristi ikonu s čitljivim pristupačnim nazivom. Time Names stane u postojeću traku bez velikog dodatnog reda kontrola.

## Lekcije na malom ekranu

Dodatna provjera vrlo niskog landscapea 667 × 320 otkrila je da naslov/datumska oznaka i dvoredna navigacija ostavljaju premalo mjesta za čitanje. Sada je donja navigacija u jednom redu, suvišan status objekta u tom prikazu je skriven, a Exit lesson ostaje trajno dostupan u gornjoj traci. Naslov i broj koraka dijele red, datum ostaje jasno označen kao nastavni primjer. Tekst se i dalje skrola unutar panela. Na portretnim ekranima ostaje i donji Exit lesson.

Nisu mijenjani orbitalni podaci, UTC osvjetljenje, astronomski parametri ni modeli lekcija. Ranije implementirani fallback bez WebGL-a ostaje dostupan.

## Pregled TheSkyLive-a

Pregledana je [njihova 3D stranica](https://theskylive.com/3dsolarsystem). Korisne ideje za zasebnu sljedeću doradu:

1. **Podijeli prikaz:** poveznica s UTC datumom i objektom na koji je kamera usmjerena. TheSkyLive čuva i dodane objekte. Za IOM bi vrijedilo uključiti način skale i kamere; takva poveznica olakšava nastavu i prijavu vizualnih problema.
2. **Spremi screenshot:** izvoz čiste slike uz datum, skalu i oznaku nastavnog/scenarijskog načina. Treba uključiti DOM nazive i kontekst, ne samo WebGL canvas.
3. **Odabir preko orbite:** TheSkyLive dopušta klik na orbitu za centriranje objekta. Kod IOM-a treba prvo definirati pouzdan odabir na križanjima putanja i razlikovanje dodira od povlačenja.

Pretraga objekata, upravljanje datumom i fokus kamere već postoje u IOM-u. Nisu kopirani njihov kod ili resursi niti je proširen raspon znanstvenih podataka. Navedene tri mogućnosti su prijedlozi, ne dio ove isporuke.


## Kako provjeriti lokalno

Otvoriti lokalni pregled, približiti unutarnje planete i promijeniti Names on/off. Postavka vrijedi i pri sljedećem pokretanju. Za zaseban Mjesec odabrati Moon iz popisa ili Earth–Moon pogled. Learn otvara sve tri lekcije; na uskom landscapeu Exit lesson je gore.

Automatizirane provjere koriste Playwright Chromium i WebKit na Windowsu. To su emulacije veličine ekrana i dodira, ne provjera na Ingovu iPhoneu 17 Pro / iOS-u 27. Svi znanstveni opisi lekcija ostaju nacrt za stručni pregled.


## Rezultati provjere

- 694 jedinična testa u 99 datoteka: prolaz. TypeScript, ESLint izmijenjenih izvora i asset provjere builda: prolaz.
- Ponovljeno 60 prolaza za Learn: Chromium 151 i WebKit 26.5 × sve tri lekcije × 3D/namjerno nedostupan WebGL × 667 × 320, 320 × 568, 390 × 844, 360 × 800 i 768 × 1024. Svaki prolaz uključuje korake, oba odgovora, povratak, restart, izlazak, ponovni ulazak, fullscreen i resize. Trajne kontrole imaju najmanje 44 × 44 px; nema horizontalnog overflowa; provjerena je i preostala visina za skrolanje teksta. [Matrica](education-matrix.json).
- Četiri Chromium acceptance testa: nazivi, postojeće lokacijske točkice, mobilni izbornik planeta i izlazak iz svih pet scenarija — prolaz. Test naziva provjerava Zemlju/Mjesec, stvarno nepoklapanje dodirnih površina, skrivanje svih naziva uz očuvane točkice, spremanje postavke, sinkronizaciju checkboxa, dodir Mjesečeva teksta u Earth–Moon pogledu i tipkovnicu. Traka kontrola dodatno je provjerena na 320 × 568, 360 × 800, 768 × 1024, 1366 × 768 i 844 × 390.

Snimke: [Nazivi uključeni](mobile-names-on.png), [nazivi isključeni](mobile-names-off.png), [lekcija na 667 × 320](lesson-short-landscape.png), [lekcija na 320 × 568](lesson-small-phone.png), [WebKit tekstualna lekcija](lesson-webkit-text.png), [izravni WebKit 3D canvas](lesson-webkit-canvas.png). Windows WebKit screenshot stranice izostavlja WebGL canvas; izravni readback priložen je odvojeno, uz testni preserveDrawingBuffer koji nije uključen u aplikaciju.

- WebKit s mobilnom emulacijom, dodirom i gustoćom zaslona 3×: test naziva prolazi (50,5 s). Provjereni su dodirni odabir Mjeseca, tipkovnica, trajna postavka naziva i responsive traka. Samo priprema udaljenosti kamere koristi sintetički wheel događaj jer mobilni Playwright WebKit ne podržava native mouse.wheel. To nije provjera fizičkog pinch gesta niti stvarnog iPhonea.
- Završni produkcijski build Solar System demoa: prolaz (Vite 4,29 s). Build ostaje lokalno; ništa nije objavljeno.

### Ponovljiva provjera naziva

Iz mape solar-system, uz pokrenut lokalni server na portu 5194:

```powershell
$env:SOLAR_SYSTEM_E2E_PORT='5194'
npm run test:e2e -- e2e/object-names.acceptance.spec.ts
npm run test:e2e -- e2e/object-names.acceptance.spec.ts --config playwright.webkit-mobile.config.ts
```

Matrica obrazovnog načina koristi scripts/verify-education-review.mjs, uz SOLAR_SYSTEM_REVIEW_URL postavljen na lokalni pregled. Ova provjera učitana je iz lokalnog builda; trajanje builda nije mjerenje performansi na fizičkom telefonu.
