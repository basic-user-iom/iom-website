**[Apri Solar System — Living Observatory](/demos/solar-system/)**

Come appare il Sistema solare quando le distanze restano lineari, le dimensioni dei pianeti rispettano la scala e il tempo può scorrere in entrambe le direzioni? Living Observatory riunisce effemeridi, immagini planetarie, lune, sonde ed esperimenti didattici in un ambiente 3D interattivo nel browser. Per chi si interessa di astronomia, il valore principale è il collegamento fra un oggetto visibile, il suo stato numerico e la provenienza dei dati.

La copertina mostra la Terra nella demo. Tutte le otto immagini di questo articolo sono vere schermate dell’applicazione, realizzate per la guida, non osservazioni telescopiche. I nomi dei comandi corrispondono all’interfaccia inglese della demo.

## 1. Leggere il Sistema solare attraverso i dati

Nell’osservatorio normale il movimento deriva da **effemeridi [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) incluse nell’applicazione**. Il browser interpola posizioni e velocità campionate mediante interpolazione cubica di Hermite. Legge quindi una descrizione precalcolata del moto, anziché risolvere un nuovo problema a N corpi a ogni pressione di Run.

Il pacchetto planetario principale copre **2000–2100**. L’orologio accetta UTC, converte internamente nella scala TDB e permette pausa, inversione e riproduzione accelerata. Le posizioni sono geometriche, nel riferimento eclittico J2000 del progetto. Non è una carta celeste apparente e topocentrica per puntare un telescopio: tempo di propagazione della luce, orizzonte locale e rifrazione atmosferica non fanno parte del modello di coordinate visualizzato.

Selezionando un corpo si consultano raggio, massa, periodo di rotazione, distanza dal Sole, velocità eliocentrica e irradianza solare. Si possono così confrontare variazioni di velocità lungo un’orbita o la diminuzione della luce solare con il quadrato della distanza, dalla Terra ai pianeti esterni.

![La vista dell’eclittica collega le posizioni degli oggetti alle traiettorie campionate delle effemeridi. Una copertura limitata produce un arco incompleto, non un’ellisse chiusa inventata.](/assets/blog/solar-system/orbits.webp)

## 2. Scala, orbite e camera

**True scale** è la modalità iniziale. Le distanze sono lineari: un’unità della scena equivale a un’unità astronomica. I raggi fisici risultano quindi molto piccoli. Nella vista dell’intero sistema, etichette e indicatori di selezione aiutano a individuare oggetti anche più piccoli di un pixel. Quei simboli non rappresentano il diametro reale del pianeta.

**Presentation** ingrandisce i corpi per renderli leggibili, mantenendone le posizioni orbitali. Confrontate le due modalità prima di giudicare le distanze da una schermata. Le linee orbitali seguono le effemeridi, non una collezione di ellissi ideali. Un secolo di dati non comprende l’intera rivoluzione di Nettuno, di circa 165 anni: il suo avviso di copertura è quindi significativo. Sonde e singoli oggetti del catalogo possono avere finestre temporali diverse.

Scegliete un corpo nel navigatore, trascinate per ruotare e usate la rotella per lo zoom. Le camere includono vista dall’alto dell’eclittica, inseguimento del corpo e inseguimento nella direzione della velocità. Le inquadrature predefinite mostrano Terra e Luna, la Grande Macchia Rossa di Giove e gli anelli di Saturno. La camera cambia il punto di vista, non la scala delle distanze.

## 3. Le mappe planetarie hanno una storia

La Terra combina mappe di terre emerse e oceani, nuvole e luci notturne con diffusione atmosferica. Marte usa immagini a colori Viking e dettagli delle normali derivati da MOLA. Giove e Saturno utilizzano immagini datate, comprese quelle del programma Hubble OPAL. Gli anelli di Saturno aggiungono struttura radiale, divisioni e ombre reciproche fra pianeta e anelli. Le normali suggeriscono il rilievo mediante l’illuminazione; non indicano terreno geometricamente risolto ovunque.

![L’inquadratura degli anelli di Saturno mostra le divisioni radiali e il rapporto fra pianeta, piano degli anelli e luce. È una visualizzazione del modello, non una fotografia di Cassini.](/assets/blog/solar-system/saturn.webp)

**La data dell’orologio non trasforma queste mappe in meteorologia storica.** Compositi nuvolosi, mosaici superficiali e dettagli delle tempeste hanno date di acquisizione proprie. Urano e Nettuno impiegano sommità nuvolose procedurali con [colori visibili sobri](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0), non mappe meteorologiche globali misurate. Il loro aspetto delicato va distinto dai forti contrasti delle immagini infrarosse elaborate. Anche il Sole combina fotosfera e corona procedurali con dettagli provenienti da immagini datate; non è una diretta solare.

Aprite **Data & provenance** per verificare attribuzioni e limiti dei modelli. Questa distinzione è essenziale quando un bel primo piano serve a spiegare l’astronomia reale.

## 4. Lune, comete e sonde

I cataloghi ricercabili vanno oltre gli otto pianeti: satelliti naturali, satelliti terrestri, comete denominate e sonde interplanetarie. Presenza nel catalogo, corpo dettagliato visualizzato e disponibilità di effemeridi sono aspetti distinti. Una voce non implica che ogni luna disponga di una mappa superficiale osservata.

Voyager 1 e 2 usano un modello NASA dettagliato, esplorabile avvicinando e allontanando la camera. Le traiettorie si riferiscono a dati di posizione; l’orientamento dell’antenna è illustrativo, non ricostruito dalla telemetria d’assetto. I satelliti terrestri sono propagati con elementi OMM inclusi e SGP4/SDP4, entro la finestra di validità dichiarata, anziché seguiti da un flusso in tempo reale.

![Voyager 1 nell’osservatorio: modello dettagliato, posizione sulla traiettoria e camera capace di passare dal contesto della missione all’esame ravvicinato.](/assets/blog/solar-system/voyager.webp)

Le cinque comete sono Halley, Encke, 67P, Hale–Bopp e NEOWISE. La coda ionica punta in direzione opposta al Sole; quella di polveri curva secondo una storia di emissione illustrativa. Gli effetti spiegano la geometria, non una previsione misurata dell’attività cometaria. Analogamente, le particelle delle fasce degli asteroidi e di Kuiper sono contesto statistico, non piccoli corpi seguiti individualmente. Il cielo di sfondo offre contesto visivo, non un campo stellare astrometrico dipendente dalla data.

## 5. Impact Lab: confrontare cause ed effetti

Impact Lab isola un evento dall’orologio dell’osservatorio. Scegliete bersaglio, diametro, densità, velocità, angolo d’ingresso, direzione e posizione dell’impattore; osservate poi ingresso atmosferico, frammentazione o esplosione in quota ed effetti superficiali. La Terra distingue terraferma e oceano, con modelli semplificati di cratere, pennacchio, cavità nell’acqua e onde.

Un esperimento utile modifica **un solo parametro alla volta**. A densità costante, raddoppiare il diametro di un impattore sferico ne moltiplica la massa iniziale per otto. Raddoppiare la velocità quadruplica l’energia cinetica iniziale: **E = ½mv²**. Perdite atmosferiche e frammentazione impediscono di confondere l’energia iniziale con quella che raggiunge la superficie.

![Un esperimento d’impatto oceanico in Impact Lab. Pennacchio e risposta dell’acqua sono approssimazioni didattiche; la visibilità aumentata degli effetti va distinta dai valori fisici dei risultati.](/assets/blog/solar-system/impact.webp)

Confrontate i risultati numerici con l’impostazione di visibilità: ingrandire un effetto sullo schermo non ingrandisce l’evento calcolato. Non è una valutazione di difesa planetaria, un modello delle vittime o una previsione di tsunami. Pausa, ripetizione e ripristino permettono di discutere meccanismi e sensibilità senza presentare le semplificazioni come previsioni.

## 6. Solar Fate: distinguere il futuro del Sole dalla finzione

La sequenza evolutiva scientifica comprime diverse fasi: Sole attuale, espansione in gigante rossa, riscaldamento del sistema interno, perdita degli strati esterni e nana bianca in raffreddamento. Navigazione fra fasi e scelta della camera permettono di confrontare la stella con il materiale circostante.

![La fase di gigante rossa in Solar Fate. L’evoluzione è compressa nel tempo; i pianeti offrono contesto, non traiettorie future previste.](/assets/blog/solar-system/solar-red-giant.webp)

È una sequenza evolutiva illustrata, non un calcolo della struttura stellare. Tempi, variazioni dimensionali e transizioni sono semplificati; la demo non risolve la questione della sopravvivenza finale della Terra e non calcola tutte le orbite future. La distinzione astrofisica fondamentale è che **[il Sole non ha massa sufficiente per terminare come supernova da collasso del nucleo](https://science.nasa.gov/universe/stars/types/)**.

![Gli strati esterni espulsi nella sequenza scientifica. La camera ampia mostra la struttura nebulare attorno al nucleo stellare esposto.](/assets/blog/solar-system/solar-nebula.webp)

L’opzione separata **Fictional Solar Supernova** è esplicitamente impossibile per il nostro Sole. È un esperimento cinematografico e deve restare identificato come tale anche quando si condividono immagini o si usa la demo in una presentazione.

## 7. Black-Hole Encounter: gravità e cattura cinematografica

**Physics Flyby** copia gli stati attuali di Sole, Luna e pianeti in una simulazione newtoniana a N corpi separata. Posizione iniziale, velocità e massa possono produrre esiti diversi; la cattura non è garantita. La diagnostica numerica aiuta a esaminare l’esperimento, ma non fornisce una stima dell’incertezza di livello scientifico.

![Controlli e vista d’incontro di Physics Flyby. Le traiettorie usano un modello didattico newtoniano; lente gravitazionale, disco e segnali di disgregazione sono approssimazioni visive.](/assets/blog/solar-system/black-hole.webp)

Non è un calcolo di relatività generale o di idrodinamica. La lente visiva non modifica l’integratore delle traiettorie. La modalità separata **Complete Consumption — Cinematic** introduce deliberatamente uno smorzamento artificiale per forzare la caduta. Un buco nero non risucchia automaticamente pianeti lontani: massa, distanza e stato orbitale iniziale restano determinanti.

## 8. Una prima esplorazione utile

1. Iniziate da Terra e Luna in True scale, poi confrontate Presentation. Notate quanto un cambiamento dei raggi alteri l’impressione dello spazio vuoto.
2. Scegliete un pianeta esterno, leggete la copertura dei dati e invertite l’orologio. Distinguete un arco incompleto da un’anomalia orbitale.
3. Inquadrate Voyager, avvicinatevi al modello e tornate alla traiettoria. Verificate fonte e finestra temporale prima di interpretarne la posizione.
4. Confrontate i risultati numerici di due esperimenti Impact Lab con un solo valore d’ingresso diverso.
5. Esplorate le fasi scientifiche di Solar Fate prima dell’alternativa fittizia.

Un browser desktop offre più spazio a controlli e grafica. Se necessario, riducete la qualità visiva: dettaglio grafico ed effemeridi sono aspetti separati. Gli scenari hanno orologi propri e il ripristino riporta all’osservatorio. L’uso più istruttivo consiste nel passare ripetutamente dall’immagine ai numeri e alle ipotesi dichiarate.

## Fonti e approfondimenti

- [Manuale JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html): riferimenti, scale temporali e grandezze geometriche o apparenti.
- [NASA: tipi di stelle](https://science.nasa.gov/universe/stars/types/): contesto evolutivo di giganti rosse, nane bianche e supernovae.
- [Università di Oxford: i colori di Urano e Nettuno](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0): perché immagini elaborate familiari possono falsare il confronto cromatico.
- **Data & provenance** nella demo: fonti e limiti di questa implementazione.

Schermate: IOM, acquisite dalla demo pubblicata il 27 settembre 2026. Immagini e modelli sottostanti conservano i crediti riportati nella demo. La guida descrive questa versione; dati inclusi e modelli visivi potranno cambiare nelle versioni successive.

**[Esplora Living Observatory](/demos/solar-system/)**
