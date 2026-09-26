# Earth Impact — provedene izmjene

Datum: 26. 9. 2026.
Projekt: `F:\iom_website\solar-system`
Polazište: [analiza od 25. 9.](earth-impact-online-analysis-2026-09-25.md)

## Što je promijenjeno

| Područje | Novo ponašanje |
|---|---|
| Skala | Početna planetarna skala ostaje True scale. Impact Lab sada također počinje s fizičkom skalom efekata. Asteroid u fizičkom načinu nema skriveni proxy za uvećavanje. |
| Kamera | Zadani filmski prikaz prati asteroid i zatim kadar udara. Ground observer ostaje 2 m iznad prikazane mreže tla; rast oblaka više ne podiže promatrača kilometrima. Bliska ravnina clippinga prilagođena je toj visini. |
| Atmosfera | Dodatni prolaz neprozirne scene daje stvarnu dubinu terena i vode. Atmosferska integracija završava na toj dubini. Prozirni oblaci crtaju se nakon atmosfere uz vlastitu lokalnu transmisiju i meke kontakte s tlom. |
| Dnevno nebo | Zvjezdana pozadina prigušena je pri dnevnom pogledu unutar Zemljine atmosfere. Po resetiranju se vraća izvorno stanje pozadine. |
| Ocean | Energetski ograničena šupljina ima negativnu visinu; slijede urušavanje, odgođeni središnji mlaz, balističke kapljice i disperzivni valni paket s udolinama. |
| Valovi | Faza se računa iz udaljenosti u metrima. Fazna i grupna brzina ovise o valnoj duljini i dubini vode; širenje mreže ne mijenja valnu duljinu. |
| Krater | Lokalna mreža zaista se udubljuje, s podignutim rubom i tragom izbačaja u istom materijalu. Osnovna kugla izrezana je ispod lokalnog terena kako ne bi ispunjavala krater. |
| Procjena dimenzija | Polumjer kratera izveden je iz gravitacijskog skaliranja Collins–Melosh–Marcus, uz preživjelu masu, brzinu, gustoću, kut i gravitaciju. To zamjenjuje prethodnu čisto umjetničku funkciju megatona. |
| Plitka voda | Pojednostavljeno slabljenje brzine kroz vodeni stupac daje gornju procjenu mogućeg kratera u podlozi. Duboki ocean ne dobiva kopneni krater na površini. |
| Reljef | Lokalni javni Mapzen Terrarium podaci u dva stupnja detaljnosti nadopunjuju NOAA ETOPO1. Izostanak lokalnih podataka zadržava regionalni teren. Nule u kopnenim DEM pločicama više ne brišu batimetriju oceana. |
| Izbačaj | Povratak materijala provjerava visinu terena i deformaciju kratera, a ne samo idealnu kuglu. Površinski val prati visinu tla. |
| Para i prašina | Osvjetljenje prati Sunce odabranog planeta. Volumen pojedinih oblaka integrira gustoću duž pogleda; broj uzoraka ovisi o kvaliteti. Rast oblaka ima zasebnu vremensku skalu, a nestajanje smanjuje neprozirnost umjesto spuštanja vrha. |
| Tlačni front | Kratkotrajni tanki front i blaga refrakcija zamjenjuju dugotrajnu prozirnu kupolu. Ishodi iznad tla ostaju vezani uz visinu eksplozije. |
| GPU preciznost | Izvedene normale vode računaju se u numerički prikladnoj skali. Time su uklonjene crne površine uzrokovane podlijevanjem pri računanju vektorskog produkta u AU jedinicama. |

## Podaci, ponavljanje i trošak prikaza

Lokalno učitavanje traži do 18 pločica (zoom 9 i 12), s ograničenom predmemorijom od 54 pločice. Oko ekvatora zoom 12 daje raster od približno 38 m po uzorku. **To nije obećanje izvorne geografske rezolucije od 38 m:** ona ovisi o izvorima na toj lokaciji. Područja bez tih podataka i oceanska dubina zadržavaju regionalni ETOPO1. Rubovi lokalnih skupova postupno prelaze na grublji teren.

Aktivni skup terena postavlja se prije pokretanja. Promjena parametara zaustavlja prethodni zahtjev, a aktivna simulacija i replay ne mijenjaju podatke terena. Model je označen kao v5. Potpis parametara nije potpuni arhiv vanjskih DEM podataka: regionalni fallback i lokalni podaci mogu dati različitu visinu za isti unos.

Geometrija vode i njezine obalne maske izrađuju se pri pripremi, a vremenska deformacija izvodi se na GPU-u. Nema ponovnog uzorkovanja desetaka tisuća vodenih vrhova na CPU-u svakog kadra. Vodena mreža dodatno ima tri budžeta indeksa; najmanji koristi 16 puta manje trokuta od najvećeg. Broj kapljica ograničen je na 512, broj oblačnih volumena na postojeći budžet do 192, a volumen koristi 4/8/12 uzoraka prema budžetu kvalitete. Dubinski prolaz postoji samo dok je lokalni Impact prikaz aktivan i prati prilagodljivu rezoluciju aplikacije.

## Što model predstavlja

Ovo ostaje edukativni prikaz. Šupljina koristi pretpostavljeni udio od 8% energije udara za procjenu gravitacijske potencijalne energije vode; nije rezultat numeričkog rješavanja hidrodinamike. Procjena interakcije s dnom pretpostavlja konstantan otpor, bez detaljnog raspada u vodi. Valni paket ne računa poplavljivanje obale, lom vala ni pouzdanu opasnost od tsunamija.

Oblačni volumeni, njihovo raspršenje svjetla, bljesak i izbačaj ostaju ograničene aproksimacije. Nije ugrađena potpuna višestruka volumetrijska simulacija cijelog oblaka ni puni atmosferski solver. Implementirana je kompozicija s dubinom koja rješava identificirani problem pogrešno integrirane atmosfere.

## Provjera

- **125 prolaznih ciljanih testova** fizike, površine, lokalnih podataka, rendererâ, kamera, atmosferske kompozicije, pozadine i panela.
- TypeScript i ciljani ESLint.
- Izolirani produkcijski build s provjerama svih postojećih astronomskih i modelskih asseta.
- Stvarni Chromium/WebGL: ocean 20° N / 80° W, kopno 35° S / 70° W, fizička skala, filmska kamera i promatrač na tlu; faze oko 3, 12, 25, 45, 55 i 145 sekundi.
- Sve prikazane atmosfere (Zemlja, Venera, Mars, Jupiter, Saturn, Uran, Neptun) provjerene su u Chromiumu bez konzolnih i WebGL grešaka.
- Low, Medium, High i Ultra te prikaz 390 × 844 provjereni su bez grešaka; [rezultati kvalitete](../tmp/impact-v5-quality/results.json). Mjerenja su izvedena na softverskom SwiftShader rendereru, pa nisu benchmark stvarne grafičke kartice. Medijani kratkog uzorka bili su približno 117/133/150/200 ms po kadru; ne tvrdi se 60 FPS na svim uređajima.
- [Galerija snimki](../tmp/impact-v5-review/index.html).
- [Skripta vizualne provjere](../scripts/verify-impact-v5.mjs), [rezultati](../tmp/impact-v5-review/results.json), [snimke](../tmp/impact-v5-review/).

U integracijskim datotekama postoje tri ranije lint primjedbe: dvije neiskorištene dodjele `focused` u AppShellu i type-import `BufferGeometry` u DebugSolarSystemRendereru. Ciljani moduli ovog zahvata provjeravaju se zasebno. Produkcija nije objavljena ovim zahvatom.

## Primarni izvori

- [Collins, Melosh i Marcus (2005), Earth Impact Effects Program](https://adsabs.harvard.edu/pdf/2005M%26PS...40..817C): gravitacijsko skaliranje i prijelaz jednostavnog u kompleksni krater.
- [NASA Ames — Asteroid Impacts in the Ocean](https://www.nas.nasa.gov/pubs/ams/2016/09-22-16.html): fizički slijed šupljine, urušavanja, mlaza i valova.
- [Bruneton — Precomputed Atmospheric Scattering](https://ebruneton.github.io/precomputed_atmospheric_scattering/): integracija atmosferskog raspršenja duž segmenta do vidljive točke.
- [NVIDIA GPU Gems 3, poglavlje 23](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-23-high-speed-screen-particles): dubina scene i meki kontakti čestica.
- [Mapzen Terrain Tiles na AWS-u](https://registry.opendata.aws/terrain-tiles/) i [obvezne atribucije izvorima](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- [NOAA ETOPO](https://www.ncei.noaa.gov/products/etopo-global-relief-model): globalni reljef i batimetrija; projektni regionalni asset ostaje postojeći ETOPO1.
