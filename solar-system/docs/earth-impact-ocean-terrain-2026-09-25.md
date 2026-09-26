# Earth Impact � ocean i regionalni reljef

Datum: 25. 9. 2026. Model: impact-earth-terrain-v4.

## �to je promijenjeno

- Zemlja koristi lokalno spremljene NOAA ETOPO1 visine i dubine. Isti sampler slu�i klasifikaciji podloge, zavr�etku putanje i geometriji reljefa.
- Klasifikacija se radi na stvarnom terminalnom mjestu. Ocean je zaseban ishod ocean-surface-impact. Airburst iznad oceana ostaje atmosferski dogadaj i ne stvara povr�inski vodeni stup.
- Ocean ima sredi�nji vodeni mlaz, razbacani vodeni rub, svijetlu paru i prstenove valova. Kopneni krater, scorch, stijenski izbacaji i tlo�ni udarni val su iskljuceni.
- Vizualna brzina valova koristi lokalnu dubinu i relaciju c = sqrt(g/k * tanh(k*h)); odabrana valna duljina i amplituda ostaju autorske vrijednosti. Valovi su ograniceni na vodu i nestaju. Zavr�etak, reset i promjena tijela ciste efekte.
- Lokalni komad Zemlje pokriva pribli�no 900 � 900 km i ima 192 � 192 celije. Vrhovi su podignuti prema izmjerenim visinama, bez dodatnog vertikalnog uvecanja. Koriste Zemljine postojece teksture i osvjetljenje.
- Putanja na kopnu presijeca izmjerenu visinu, umjesto da nastavi do idealne kugle razine mora. Zavr�ni korak rje�ava se bisekcijom. ENU putanja ostaje vezana uz srednji polumjer; povr�inski efekti dobivaju visinski pomak.
- Kraterski sloj prati lokalni reljef. Kamera i baza plumea prate visinu terminalnog mjesta.
- Panel prikazuje ocean/dubinu ili kopno/visinu, izvor i rezoluciju. Pokretanje na Zemlji ceka teren; neuspjelo ucitavanje daje jasnu poruku.
- Asset od 14,9 MB ucitava se tek pri otvaranju Impact Laba. Podr�ani su poslu�itelji koji gzip automatski dekodiraju i oni koji ga poslu�uju kao datoteku.
- True scale ostaje zadana skala.

## Podaci i granice

[NOAA ETOPO1](https://oceanwatch.aoml.noaa.gov/erddap/griddap/etopo180.html) kombinira topografiju i batimetriju. Izvorni korak je jedna lucna minuta; ovaj paket uzima svaki peti uzorak, dakle 5 lucnih minuta (~9,3 km na ekvatoru). Sjever�jug rezolucija ne postaje finija dodatnim poligonima. Obale, uski tjesnaci i mali otoci ostaju pribli�ni.

Maska oceana dobivena je povezivanjem negativnih celija s Pacifikom. Zatvorene kopnene depresije ne progla�avaju se oceanom. Vrlo uski tjesnaci koje uzorkovanje prekine mogu ograniciti klasifikaciju malih mora. Kopnene depresije ispod razine mora u ovom prikazu ostaju na referentnoj kugli.

Prikazuje se stvarni regionalni reljef kopna; ovo nije model terena metarske rezolucije. Batimetrija se koristi za dubinu i valove. Nema podvodne kamere, vidljivog presjeka morskog dna, podvodnog kratera, strujanja fluida, odbijanja/refleksije valova od obale, poplavljivanja ni prognoze tsunamija. Ocean ne ostavlja kopneni krater iznad vode.

[NASA prikaz oceanskih udara](https://www.nas.nasa.gov/assets/nas/pdf/ams/2016/AMS_20160922_Robertson.pdf) opisuje �upljinu, mlaz i valni paket. Projekt vizualno razlikuje te pojave, ali ne provodi njihov hidrodinamicki proracun. Relacija fazne brzine u konacnoj dubini navedena je i u [NOAA materijalu o disperziji](https://repository.library.noaa.gov/view/noaa/13447/noaa_13447_DS1.pdf).

## Provjera

- 93 ciljana testa: fizika, stvarni DEM i checksum, sferna/terenska kolizija, scenarij, rendereri, deterministicna pauza/ponavljanje, reset, skala i panel.
- Browser: ocean 20� N, 80� W (2.730 m dubine); kopno 35� S, 70� W (4.234 m nadmorske visine). Provjereno odsustvo kratera nad oceanom, para, vodeni stup, valovi, reljef, True scale i reset.
- TypeScript i ciljani lint prolaze. Izolirani build s provjerom postojecih asseta prolazi; postojece Vite upozorenje za velike chunkove ostaje.
- [Browser rezultati](../tmp/ocean-terrain-review/results.json), [ocean](../tmp/ocean-terrain-review/ocean-03s.png), [kopno](../tmp/ocean-terrain-review/land-03s.png).

Ponovljiva provjera: node scripts/verify-ocean-terrain.mjs. Generator paketa: node scripts/generate-earth-impact-terrain.mjs <etopo180.dods>. Tocan upit, format i checksum su u public/assets/impact/earth-etopo1-5min.json.

Promjene su lokalne. Produkcija nije objavljena.
