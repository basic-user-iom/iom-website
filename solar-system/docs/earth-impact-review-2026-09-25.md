# Earth Impact — analiza i provedene izmjene

Datum: 25. 9. 2026.
Projekt: Solar System / Impact Lab
Model nakon izmjena: impact-target-sphere-v3

## Nalaz

Problem nije bio samo u jačini efekata. Simulacija, prikaz događaja, koordinatni sustav i kamera imali su nekoliko međusobno povezanih grešaka. To je stvaralo eksplozije tamo gdje ih izračun nije opravdavao, pogrešno pozicionirane efekte i neujednačenu skalu.

## Ispravljeni problemi

| Područje | Prije | Sada |
|---|---|---|
| Ishod plitkog prolaza | Tijelo koje promaši atmosferu nakon isteka integracije dobivalo je airburst i eksploziju. | Odlazeća putanja završava na izlaznoj granici. Ishod „No impact in simulated interval” nema bljesak, krater, dim ni udarne valove. |
| Raspad i usporavanje | Jednokratno povećanje presjeka za nekoliko fragmenata ostavljalo je premalo atmosferskog kočenja. | Nakon praga dinamičkog tlaka širi se ograničeni oblak fragmenata, čime kontinuirano raste efektivni presjek. |
| Kraj svijetlog leta | Spori preživjeli ostaci mogli su izazvati prikaz glavnog površinskog udara. | Kad brzina padne ispod 3 km/s i ostane manje od 10% početne kinetičke energije, završava svijetli događaj; glavni atmosferski događaj sidri se na maksimumu predaje energije. |
| Zemljopisni položaj | Izračun je koristio +Y za sjever, a rotacija tijela i osvjetljenje +Z. ENU baza bila je lijeva. | Koristi se jedinstvena +Z os sjevera i desna ENU baza: east × north = up. |
| Vrijeme i visina airbursta | Terminalni prikaz mogao je koristiti interpolirani uzorak umjesto stvarnog maksimuma. | Točan uzorak maksimuma uključen je u putanju; vrijeme, mjesto i prijavljena visina odgovaraju istom događaju. |
| Airburst bljesak | Prava faza airburst nije aktivirala vidljivu vatrenu kuglu. | Bljesak i kugla pojavljuju se na visini eksplozije. |
| Dim nakon airbursta | Dim je rastao iz tla. | Sidro oblaka je mjesto zračne eksplozije. |
| Atmosferski val | Prsten na fiksnoj visini od 12 km izgledao je odvojen od udara. | Na stjenovitim planetima val se širi kao lokalna sfera; tlo zaklanja donju polovicu kod površinskog udara. Oblaci divovskih planeta zadržavaju svoj poseban prikaz. |
| Veličina efekata | Skriveni minimumi vezani uz polumjer planeta stvarali su prenaglašene oblake i zavjese. Faktor uvećanja mogao se mijenjati tijekom animacije. | Uklonjeni su dodatni planetarni minimumi. Enhanced koristi jedan faktor iz punog profila događaja, najviše 16×. |
| Izbačeni materijal | Vidljive trake bile su odvojene od balističkih uzoraka korištenih u dijagnostici. | Vrhovi prikazanih putanja koriste stvarni deterministički skup čestica; povratak na tlo uklanja pripadne efekte. |
| Kamera | Promatrala je krater i koristila stare velike odmake zbog nekadašnje atmosfere. | Chase i observer kadriraju obujam efekata, uključuju airburst i prate njegovo povišeno sidro. |
| Skala cijelog sustava | Pokretanje Impact Laba prebacivalo je True scale na Presentation scale. | Impact Lab zadržava korisnikov odabrani način prikaza. |
| Kamera nakon eksplozije | Near plane se i nakon nestanka asteroida odredivao prema povr�ini planeta te odrezao sredinu zracne vatrene kugle. | Dubinski raspon lokalnog dogadaja racuna se prema obujmu efekata i udaljenosti od njih. Browser provjera izravno provjerava da je prednja strana kugle iza near planea. |
| Dubina i nebo | Zvijezde su se crtale preko neprozirne površine. Polumjer asteroida za clipping bio je dodatno pomnožen lokalnom skalom. | Zvijezde poštuju dubinu; kamera dobiva ispravan svjetski polumjer asteroida. |
| Prikazane energije | Početna energija i TNT mogli su se protumačiti kao energija udara u tlo. | Posebno su označene početna energija, energija na površini i energija predana atmosferi. |

Pri zadnjem integracijskom koraku koji prelazi površinu i zbroj atmosferske energije sada koristi stvarno interpolirano trajanje koraka.

## Numerička provjera

Sljedeće su rezultati ovog edukacijskog modela, a ne prognoze stvarnih udara. U svim redovima, osim navedenih iznimaka: kamen, gustoća 3000 kg/m³, brzina 20 km/s, kut 35°, uključen raspad i atmosfera.

| Scenarij | Rezultat | Visina glavnog atmosferskog događaja / brzina na površini |
|---|---|---|
| Promjer 1 m | Airburst | 39,77 km |
| Promjer 20 m | Airburst | 30,16 km |
| Promjer 100 m | Airburst | 16,48 km |
| Promjer 140 m | Površinski udar | 4,53 km/s |
| Promjer 5000 m | Površinski udar | 20,05 km/s |
| 20 m, raspad isključen | Površinski udar | 15,85 km/s |
| 20 m, atmosfera isključena | Površinski udar | 20,08 km/s |
| 20 m, kut 5° | Bez terminalnog udara | Bez eksplozije |
| 100 m, kut 5°, atmosfera isključena | Bez terminalnog udara | Bez eksplozije |

Za 20 m stariji model prikazivao je površinski udar brzinom približno 14,29 km/s. Sada je glavni događaj atmosferski. Za 140 m promjena raspršenja smanjuje izračunatu površinsku brzinu s približno 19,13 na 4,53 km/s. To je velika promjena ponašanja, zbog koje je verzija modela i potpisa reproducibilnog događaja podignuta s v2 na v3.

Početni promjer od 100 m nije promijenjen radi zadržavanja starog ishoda: s postojećim zadanim parametrima novi model daje airburst. Veći ili otporniji objekti, drugi kutovi te isključivanje atmosfere/raspada mogu promijeniti ishod.

## Osnova modela i granice

Širenje oblaka koristi brzinu proporcionalnu brzini leta i korijenu omjera gustoće zraka i tijela. Ograničenje na sedam početnih polumjera je odabrani parametar aproksimacije; nije univerzalna konstanta za sve asteroide. Osnova i rasprava ograničenja nalaze se u NASA radu [Asteroid Fragmentation Approaches for Modeling Atmospheric Energy Deposition, odjeljak 2.3](https://ntrs.nasa.gov/citations/20180003387). Prag završetka svijetlog leta od 3 km/s i 10% energije izričito je pravilo ovog edukacijskog modela.

[NASA/JPL opis događaja kod Čeljabinska](https://cneos.jpl.nasa.gov/news/fireball_130301.html) potvrđuje važnost fragmentacije, povećanja presjeka i atmosferskog kočenja. Ovaj projekt nije kalibriran niti validiran kao rekonstrukcija tog događaja.

Preostala ograničenja:

- Zemljina površina tretira se kao čvrsta podloga. Nema zasebne hidrodinamike udara u ocean, vodenog stupa ili tsunamija.
- Nema lokalnog reljefa visoke rezolucije. Pri vrlo bliskoj kameri vide se ograničenja globalne karte i poligonalne kugle.
- Krater, dim, temperatura boja i brzine vizualnih valova ostaju autorski edukacijski efekti. „Physical effect scale” znači bez dodatnog faktora uvećanja tih efekata, ne validirani geofizički proračun.
- Atmosfera je statična eksponencijalna aproksimacija; nema vjetra, vremena, stvarne kemije ni modela strujanja fluida.
- Spori meteoriti nakon završetka svijetlog leta nisu simulirani do tla.
- Mjesto terminalnog događaja proizlazi iz putanje; konfigurirana lokacija služi početnom usmjeravanju i nije zajamčeno mjesto udara nakon kočenja i zakrivljenja putanje.

## Provjera

- 91 ciljani test prolazi: fizika, životni ciklus scenarija, rendereri, skala efekata, panel i pozadinsko nebo.
- Uključena je matrica od 36 ekstremnih kombinacija promjera, brzine i kuta s provjerama konačnih koordinata, nenegativne mase i ograničenog energetskog proračuna.
- TypeScript prolazi. Ciljani lint Impact modula, panela, testova i neba prolazi. ?iri integracijski kod ima tri postoje?e lint primjedbe: dvije neiskori?tene dodjele u AppShell.tsx i import koji treba ozna?iti kao type u DebugSolarSystemRenderer.ts. One nisu blokirale build.
- Projekt je izgrađen u izolirani direktorij tmp/earth-impact-review-build uz provjeru asseta. Postojeća upozorenja o velikim Vite chunkovima ostaju.
- Browser provjera obuhvaća ulazak, površinski bljesak, ejecta, plume, airburst, observer, Physical/Enhanced, fullscreen, plitki prolaz i reset. Provjerava očuvanje True scale i greške konzole.

Ponovljiva provjera iz direktorija solar-system:

~~~powershell
node scripts/audit-earth-impact.mjs
node scripts/verify-earth-impact-review.mjs
~~~

Numerički rezultati: [physics-results.json](../tmp/earth-impact-review/physics-results.json).
Browser rezultati i snimke: [browser-results.json](../tmp/earth-impact-review/browser-results.json).

Izmjene su lokalne; produkcija nije objavljena.


Zavr?ne snimke: [plume na dnevnoj strani](../tmp/earth-impact-review/05-surface-plume.png), [cijela airburst vatrena kugla](../tmp/earth-impact-review/06-airburst.png). Puna provjera s prolazom bez udara: [browser-all-cases.json](../tmp/earth-impact-review/browser-all-cases.json).
