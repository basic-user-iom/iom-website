/* Auto-assembled by scripts/assemble-blog-locale-packs.mjs — do not hand-edit large blocks */
import type { DemoPostLocalePack } from './types'

export const itDemoBlogPosts: DemoPostLocalePack = {
  "3d-viewer": {
    pageTitle: "3D Viewer — modelli prodotto nel browser",
    demoLabel: "3D Viewer",
    heroVideoCaption: "Walkthrough prodotto — orbit, illuminazione HDR e chrome del viewer",
    excerpt: `Release desktop v3.19.2: affidabilità e qualità texture Streets GL, ripristino texture Product-mode dopo teardown City, header pannello unificati — più revisione GLTF/FBX/OBJ/IFC con proiezione suolo HDR e Streets GL.`,
    seo_title: "3D Viewer v3.19.2 — texture e affidabilità Streets GL — IOM",
    seo_description: `3D Viewer v3.19.2 per Windows (Setup + Portable): fix vertex-budget/simplify Streets GL, texture 4k con UV preservati, ripristino texture Product-mode e header FloatingPanelHeader unificati. Revisione browser per GLTF/FBX/OBJ/IFC con HDR e Streets GL.`,
    hook: `I clienti non dovrebbero aver bisogno di una postazione CAD per revisionare un modello. Il nostro 3D Viewer mette GLTF, FBX, OBJ e IFC in una finestra browser (e desktop) condivisibile — orbit, ispezione materiali, illuminazione 360° HDR e proiezione suolo, oppure inserimento del mesh nel contesto città OSM / Streets GL quando la location racconta la storia.`,
    coverNote: `Un breve walkthrough apre l'articolo; gli still sotto mostrano proiezione suolo HDR 360° e contesto città OSM 3D / Streets GL nello stesso viewer.`,
    whatYouSeeIntro: `Due capacità che vendono il modello oltre il vuoto grigio — illuminazione HDR cinematografica, poi tessuto urbano reale:`,
    whyBullets: [
      `- **Condividi un link, non uno ZIP** — gli stakeholder aprono il modello su un laptop durante una call`,
      "- **Un viewer per molti formati** — meno email con «quale app apre questo?»",
      `- **360° HDR + proiezione suolo** — illuminazione reale e ombre di contatto per ancorare il prodotto alla plate`,
      `- **OSM 3D / Streets GL nel viewer** — combinare contesto città con i propri modelli quando la strada vende il pitch`,
    ],
    whyUses: `configuratori prodotto, posizionamenti architettura ed esterno, tablet fiere, approvazioni client asincrone e presentazioni web standalone esportate dalla stessa pipeline.`,
    beginner: `Un viewer 3D è come una foto del prodotto che puoi ruotare. Invece di immagini piatte, il modello reale è nella pagina — trascina per girare, zoom sui dettagli, avvolgilo in luce HDR o posizionalo su una vera città OpenStreetMap quando serve «dove si colloca?». Nessuna installazione per la build web; una build desktop Windows copre offline o asset pesanti.`,
    glossary: [
      {
        term: "GLTF / GLB",
        def: "formati 3D web comuni ([Khronos glTF](https://www.khronos.org/gltf/))",
      },
      {
        term: "Orbit",
        def: "trascinare per ruotare la camera intorno al modello",
      },
      {
        term: "Ambiente HDR 360°",
        def: "wrap ad alta gamma dinamica che illumina il modello da cielo/scena reale",
      },
      {
        term: "Proiezione suolo",
        def: `proiezione dell'HDR sul piano del pavimento per ombre e riflessi coerenti`,
      },
      {
        term: "OSM 3D / Streets GL",
        def: `contesto città 3D derivato da OpenStreetMap combinabile con i tuoi modelli nel viewer ([streets.gl](https://streets.gl/))`,
      },
      {
        term: "Hotspot",
        def: "marcatore cliccabile sul modello con info o link",
      },
    ],
    trySteps: [
      `Apri il [sito 3D Viewer](https://3dbviewer.com/) o scarica Setup / Portable Windows dalla [release v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
      `Carica un sample o il tuo GLTF/GLB se la build consente l'import`,
      `Prova un ambiente HDR 360° con proiezione suolo — osserva le ombre di contatto ancorare il prodotto alla plate`,
      `Apri OSM 3D / Streets GL e immagina (o posiziona) il modello nel tessuto urbano reale`,
    ],
    requirements: [
      "**Browser:** Chrome, Edge o Firefox moderni per la build web",
      `**Desktop Windows:** Setup o Portable da [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)`,
      "**File:** preferire GLB/GLTF per web; CAD pesante può richiedere conversione",
      `**GPU:** path tracing e layer città densi vogliono una GPU decente — modalità leggere su dispositivi modesti`,
    ],
    viewA: {
      caption: `HDR 360° con proiezione suolo — prodotto illuminato dalla plate, ombre leggibili sull'asfalto`,
    },
    viewB: {
      caption: "OSM 3D / Streets GL nel viewer — contesto città combinabile con i tuoi modelli",
    },
    alsoCan: [
      "Cambiare ambienti HDR e ora del giorno per mood diversi",
      "Usare path tracing per still quando la qualità batte la velocità realtime",
      "Mescolare modalità Product / City / Hybrid per revisioni esterno o urbano",
      "Esportare una presentazione web standalone per consegna client",
    ],
    howWorks: `Il viewer è costruito sulla famiglia [Three.js](https://threejs.org/) con focus su revisione pratica: caricare mesh, inquadrarle, illuminarle con HDR + proiezione suolo e — quando il brief chiede una strada — aprire contesto città OSM 3D / Streets GL nello stesso chrome. Le build desktop estendono la stessa idea offline o con asset grandi. Il supporto formati segue pipeline client reali — l'obiettivo è sempre «apri, capisci, decidi.» Prodotto live: [3dbviewer.com](https://3dbviewer.com/).`,
    whatsNew: {
      heading: "Novità in v3.19.2",
      body: `Affidabilità bridge Streets GL e qualità texture, più rifinitura Product-mode:

- **Sync Streets GL** — simplify vertex-budget che preserva UV così auto e mesh grandi atterrano in modo affidabile nel contesto città
- **Texture migliori in City** — trasferimento texture binario fino a 4k con adattamento payload automatico per mappe Meshy grandi
- **Restore Product-mode** — le texture non scompaiono più dopo teardown Streets GL / City
- **Header pannello unificati** — chrome FloatingPanelHeader condiviso sui pannelli editor

**Download (Windows x64):** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Release notes](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
    },
    faq: [
      {
        q: "I clienti hanno bisogno di software CAD?",
        a: `No per la revisione — un link browser basta alla maggior parte degli stakeholder.`,
      },
      {
        q: "Possiamo mostrare il modello su una strada reale?",
        a: `Sì — OSM 3D / Streets GL gira nel viewer così puoi combinare contesto città con il tuo GLB/GLTF.`,
      },
      {
        q: "Dove scarico la build desktop Windows?",
        a: `Installer Setup e Portable sono sulla [release GitHub v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), anche linkata da [3dbviewer.com](https://3dbviewer.com/).`,
      },
      {
        q: "Possiamo brandizzarlo?",
        a: "Sì. Chrome viewer, ambienti e contenuto hotspot possono seguire il tuo brand.",
      },
    ],
    reading: [
      {
        label: "3D Viewer live",
        url: "https://3dbviewer.com/",
      },
      {
        label: "Download Windows v3.19.2",
        url: "https://github.com/basic-user-iom/3d/releases/tag/v3.19.2",
      },
      {
        label: "Panoramica glTF — Khronos",
        url: "https://www.khronos.org/gltf/",
      },
      {
        label: "Mappa live Streets GL",
        url: "https://streets.gl/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
    ],
    related: [
      {
        label: "Streets GL Bridge",
        url: "/blog/streets-gl-bridge",
      },
      {
        label: "Illuminazione volumetrica",
        url: "/blog/volume-lighting",
      },
    ],
  },
  "streets-gl-bridge": {
    pageTitle: "Streets GL Bridge — contesto città OSM per modelli 3D",
    demoLabel: "Streets GL Bridge",
    hook: `Un bel modello ha comunque bisogno di un posto dove stare. Streets GL Bridge esplora il contesto città 3D OpenStreetMap come strato di suolo — così asset geolocalizzati stanno in uno skyline riconoscibile invece che nel vuoto.`,
    coverNote: "La cover mostra il framing mappa/bridge usato sulla card portfolio.",
    whyBullets: [
      `- **La location vende la storia** — i clienti riconoscono l'isolato, non solo il mesh`,
      "- **Dati mappa aperti** — OSM come layer città vivo sotto il tuo asset",
      "- **Mentalità bridge** — collegare la pipeline modelli a un suolo navigabile",
      `- **DNA open source** — costruito attorno all'ecosistema Streets GL`,
    ],
    whyUses: `proposte urbane, slide contesto sito, anteprime prodotto o architettura geolocalizzate e conversazioni «dove si colloca in strada?» prima di un build GIS completo.`,
    beginner: `Pensa alle vibes di Google Earth, ma per mettere il tuo oggetto 3D in una vera griglia stradale. La mappa è il palco; il modello l'attore. Orbiti ed esplori invece di fissare un pavimento grigio infinito.`,
    glossary: [
      {
        term: "OSM",
        def: `OpenStreetMap — dati mappa costruiti dalla community ([openstreetmap.org](https://www.openstreetmap.org/))`,
      },
      {
        term: "Strato suolo",
        def: "città, strade e terreno sotto il modello",
      },
      {
        term: "Geolocalizzato",
        def: "posizionato a latitudine/longitudine reali sulla Terra",
      },
      {
        term: "WebGL",
        def: `API GPU browser che disegna la mappa 3D ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))`,
      },
    ],
    trySteps: [
      "Apri la [demo Streets GL Bridge](/demos/streets-gl/)",
      `Attendi che l'embed mappa si stabilizzi`,
      `Pan e zoom sul contesto città (o confronta con la [mappa live Streets GL](https://streets.gl/))`,
      "Immagina di posizionare un edificio client o un chiosco su un angolo noto",
    ],
    requirements: [
      "**Rete:** tile mappa e embed richiedono connessione",
      "**Browser:** Chromium moderno consigliato per viste mappa WebGL",
      "**Performance:** città dense sono più pesanti — zoom per esplorazione più fluida",
    ],
    viewA: {
      caption: "Tessuto urbano — strade e volumetrie come contesto",
    },
    viewB: {
      caption: "Lettura urbana ravvicinata — dove starebbe un modello",
    },
    alsoCan: [
      "Usare come layer di riferimento posizionando GLB geolocalizzati",
      "Indirizzare stakeholder alla mappa live [streets.gl](https://streets.gl/)",
      "Abbinare ai concetti Simple 3D Buildings di OSM",
    ],
    howWorks: `Streets GL renderizza struttura città 3D derivata da OSM nel browser. La nostra pagina bridge ospita quel contesto per workflow IOM — un layer pratico «dove si colloca?» invece di una suite GIS completa. Progetto upstream: [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl); mappa live su [streets.gl](https://streets.gl/).`,
    faq: [
      {
        q: "È Google Maps?",
        a: "No — si basa su OpenStreetMap e gli strumenti aperti Streets GL.",
      },
      {
        q: "Possiamo inserire il nostro edificio?",
        a: `È l'intento del bridge: modelli geolocalizzati sopra contesto città. Chiedici un'integrazione scoped.`,
      },
    ],
    reading: [
      {
        label: "Mappa live Streets GL",
        url: "https://streets.gl/",
      },
      {
        label: "streets-gl su GitHub",
        url: "https://github.com/StrandedKitty/streets-gl",
      },
      {
        label: "OSM Simple 3D Buildings",
        url: "https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings",
      },
      {
        label: "WebGL — Wikipedia",
        url: "https://en.wikipedia.org/wiki/WebGL",
      },
    ],
    related: [
      {
        label: "Artist Globe",
        url: "/blog/artist-globe",
      },
      {
        label: "3D Viewer",
        url: "/blog/3d-viewer",
      },
    ],
  },
  "panorama-360-tour": {
    pageTitle: "360° Panorama Tour Editor — creare walk guidati nel browser",
    demoLabel: "360° Panorama Tour Editor",
    hook: `I visitatori fiere ricordano le esperienze. Questo editor carica panorami equirettangolari, posiziona hotspot, collega tour multi-scena e salva un \`.360project\` — tutto nel browser, aprendo su The Black Witness di default.`,
    coverNote: `La cover è il passo 1 del tour guidato su The Black Witness — hotspot corvo + popup.`,
    whyBullets: [
      `- **Editor + visitatore in uno stack** — costruisci il tour, poi condividi un link preview`,
      "- **Hotspot che spiegano** — info, link scena e popup iframe opzionali",
      "- **Tour multi-scena** — guidare gli ospiti da stand a linea prodotto a venue",
      "- **File progetto che tieni** — salvare e ricaricare `.360project` tra sessioni",
    ],
    whyUses: `compagni fiere, walkthrough venue, storie linea prodotto, soft launch museo e approvazioni client prima di un build tour produzione completo.`,
    beginner: `Un panorama 360° è una foto che ti avvolge completamente — come stare al centro di una stanza. L'editor trasforma quelle foto in un tour: marcatori cliccabili (hotspot), collegamenti tra stanze e un percorso che gli ospiti seguono senza scaricare un'app.`,
    glossary: [
      {
        term: "Equirettangolare",
        def: "layout immagine 360° comune (sfera completa appiattita in rettangolo)",
      },
      {
        term: "Hotspot",
        def: "marcatore cliccabile — info, salto scena o URL/iframe",
      },
      {
        term: "Tour guidato",
        def: "sequenza scriptata di stop camera, popup ed effetti opzionali",
      },
      {
        term: ".360project",
        def: "file di salvataggio IOM per panorami, hotspot e impostazioni tour",
      },
      {
        term: "WebGPU birds",
        def: "effetto stormo opzionale sul tour (supportato GPU)",
      },
    ],
    trySteps: [
      `Apri il [360° Panorama Tour Editor](/demos/panorama-360/) (o [preview visitatore](/demos/panorama-360/?mode=preview))`,
      "Clicca **Play guided tour** e segui i quattro passi Black Witness",
      "Ferma il tour e clicca gli hotspot — corvo, fuoco, acqua, uccelli",
      `Nell'editor, seleziona ogni riga STEPS per saltare la camera e modificare quel beat`,
    ],
    requirements: [
      `**Browser:** Chrome o Edge moderni consigliati; funzioni WebGPU richiedono GPU capace`,
      `**Immagini:** JPG, PNG, WebP equirettangolari; HDR/EXR/KTX2 quando la pipeline li supporta`,
      `**Mobile:** la visualizzazione funziona; l'editing è più comodo su desktop`,
    ],
    viewA: {
      caption: "Passo 2 — hotspot fuoco animato e popup particelle",
    },
    viewB: {
      caption: "Passo 3 — beat acqua / spout sul tetto",
    },
    viewC: {
      caption: "Passo 4 — popup Animated birds con lo stormo contro il cielo tempestoso",
    },
    alsoCan: [
      "Collegare più panorami in un tour multi-scena guidato",
      "Aggiungere popup URL o iframe su hotspot per pagine prodotto o embed",
      `Layer [particelle](/blog/webgpu-particles), [spout](/blog/spout) e [uccelli](/blog/webgpu-compute-birds) sui passi guidati 2–4`,
    ],
    howWorks: `I panorami sono mappati su una sfera (o pipeline cube) così la camera sta al centro — l'approccio web 360 classico con [Three.js](https://threejs.org/) e API browser moderne ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) opzionale). Gli hotspot sono metadati scena: posizione, tipo e target. I passi tour guidato su The Black Witness collegano le stesse demo effetto a beat interattivi — Passo 2 \`+particles\` ([WebGPU Particles](/blog/webgpu-particles)), Passo 3 \`+particles/spout\` ([Spout](/blog/spout)), Passo 4 \`+birds\` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — ciascuno con \`hotspot+popup\` così movimento e storia cliccabile arrivano insieme. Preview visitatore è lo stesso motore senza chrome editor — vedi [tour The Black Witness](/blog/panorama-suite).`,
    faq: [
      {
        q: `Gli ospiti hanno bisogno di un'app?`,
        a: `No. Condividi un link browser. La modalità preview nasconde l'editor così i visitatori vedono solo il tour.`,
      },
      {
        q: "Possiamo usare i nostri panorami?",
        a: `Sì — carica still equirettangolari nell'editor e costruisci hotspot attorno al tuo venue o prodotto.`,
      },
      {
        q: "Come si collegano particelle, spout e uccelli al tour?",
        a: `Sono layer effetto opzionali sui passi guidati 2–4. Ogni passo abbina stop camera, effetto e popup hotspot — esplora le demo standalone, poi Play guided tour in /demos/panorama-360/.`,
      },
    ],
    reading: [
      {
        label: "Editor tour live",
        url: "/demos/panorama-360/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Equirectangular projection — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Equirectangular_projection",
      },
    ],
    related: [
      {
        label: "The Black Witness — Tour 360°",
        url: "/blog/panorama-suite",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "crm-demo": {
    pageTitle: "CRM Demo — prova la sandbox client IOM",
    demoLabel: "CRM Demo",
    hook: `Vuoi vedere come IOM gestisce lead, progetti e tempo senza toccare dati client live? La CRM Demo è una sandbox interattiva con aziende fittizie — pipeline, board, idee e bozze blog che restano in questa scheda browser.`,
    coverNote: `La cover mostra l'UI sandbox CRM dalla card portfolio.`,
    whyBullets: [
      `- **Sicuro cliccare tutto** — le modifiche non toccano mai database di produzione`,
      `- **Sensazione workspace completa** — lead, progetti, tempo, idee e post blog di esempio`,
      "- **Pitch in riunione** — apri `/crm-demo` e percorri il flusso live",
      `- **Stessa famiglia prodotto** — rispecchia la CRM client reale su \`/client-login\``,
    ],
    whyUses: `demo commerciali, walkthrough onboarding, formazione stakeholder e conversazioni «come sarebbe la nostra pipeline?» prima di provisionare un workspace reale.`,
    beginner: `Un CRM (customer relationship management) è dove uno studio traccia chi ha chiesto info, quali progetti sono attivi e come viene speso il tempo. Questa demo è una cucina di pratica: le ricette sono reali, gli ingredienti fittizi, e nulla di ciò che digiti lascia la scheda a meno che non esporti tu.`,
    glossary: [
      {
        term: "Sandbox",
        def: `copia di pratica dell'app con dati finti che reset in sicurezza`,
      },
      {
        term: "Pipeline",
        def: "fasi che un lead attraversa prima di diventare progetto",
      },
      {
        term: "In-memory",
        def: "i dati vivono in questa sessione browser, non sul server live",
      },
      {
        term: "Client login",
        def: "la CRM reale su `/client-login` con dati Supabase",
      },
    ],
    trySteps: [
      "Apri la [CRM Demo](/crm-demo)",
      "Sfoglia Leads o Projects — apri una scheda azienda fittizia",
      "Fai una piccola modifica (stato, nota o card board) per sentire la sandbox",
      "Opzionale: apri Blog nella demo CRM e anteprima un post di esempio",
    ],
    requirements: [
      `**Browser:** qualsiasi browser desktop moderno; finestra larga aiuta per le board`,
      "**Privacy:** dati sandbox locali alla scheda — refresh può resettare lo store",
      `**Non produzione:** non inserire mai segreti client reali; usa \`/client-login\` per lavoro live`,
    ],
    viewA: {
      caption: "Vista pipeline — lead fittizi in colonne di fase",
    },
    viewB: {
      caption: `Board progetto — task e contesto per un'azienda demo`,
    },
    alsoCan: [
      "Esplorare time tracking e mappe idee con voci di esempio",
      "Resettare il workspace demo per ripartire puliti",
      "Confrontare la sensazione sandbox con la CRM reale dopo login",
    ],
    howWorks: `La [CRM demo](/crm-demo) pubblica usa uno store in-memory così ogni click è disposable. La CRM produzione su \`/client-login\` parla con Supabase per dati staff e client reali. Stesso linguaggio UI, backend diverso — così un pitch non rischia mai un record live.`,
    faq: [
      {
        q: "Le mie modifiche appaiono ad altri visitatori?",
        a: `No. La sandbox è per scheda browser / sessione. Gli altri vedono la propria copia dei dati fittizi.`,
      },
      {
        q: "È la stessa cosa di client login?",
        a: `Stessa famiglia prodotto e schermate, ma \`/crm-demo\` non tocca mai database live. Il lavoro reale avviene su \`/client-login\`.`,
      },
    ],
    reading: [
      {
        label: "CRM Demo",
        url: "/crm-demo",
      },
      {
        label: "Client login",
        url: "/client-login",
      },
      {
        label: "Home IOM",
        url: "/",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "Image Prep",
        url: "/blog/image-prep",
      },
    ],
  },
  "image-prep": {
    pageTitle: "Image Prep — ridimensiona, comprimi e rimuovi EXIF nel browser",
    demoLabel: "Image Prep",
    hook: `Le immagini portfolio e web devono essere nitide, leggere e private. Image Prep ridimensiona ai preset comuni, comprime JPEG/WebP/PNG e rimuove EXIF camera/GPS — i file restano sul dispositivo finché non scarichi il risultato.`,
    coverNote: `La cover mostra l'UI tool Image Prep dalla card software.`,
    whyBullets: [
      "- **Resta on-device** — nessun upload su server sconosciuto per un resize rapido",
      "- **Preset web-ready** — dimensioni portfolio e sito senza acrobazie Photoshop",
      "- **Privacy by default** — rimuovi EXIF così GPS e metadati camera non trapelano",
      `- **Meno peso, stessa storia** — comprimi per pagine più veloci e fatture CDN più leggere`,
    ],
    whyUses: `preparare still hero, upload galleria, cover CRM/blog e pacchetti consegna client prima che arrivino a CMS o pagina demo.`,
    beginner: `Prima che una foto vada su un sito, di solito ha bisogno di tre favori: la giusta dimensione pixel, un file più piccolo e meno dati personali nell'header. Image Prep li fa nel browser — trascina un'immagine, scegli un preset, scarica una versione più pulita.`,
    glossary: [
      {
        term: "EXIF",
        def: "metadati che le fotocamere incorporano (impostazioni, timestamp, a volte GPS)",
      },
      {
        term: "Comprimere",
        def: "ridurre dimensione file, spesso con slider qualità",
      },
      {
        term: "WebP",
        def: "formato immagine moderno spesso più piccolo del JPEG a qualità simile",
      },
      {
        term: "On-device",
        def: "elaborazione nel browser; scegli tu quando scaricare",
      },
    ],
    trySteps: [
      "Apri [Image Prep](/tools/image-prep)",
      "Trascina un JPG o PNG dal tuo computer",
      "Scegli preset resize e formato (JPEG / WebP / PNG)",
      "Abilita rimozione EXIF se serve, poi scarica il risultato",
    ],
    requirements: [
      "**Browser:** Chrome, Edge o Firefox moderni con supporto canvas",
      "**Privacy:** elaborazione locale — evita comunque di incollare segreti altrove",
      `**Limiti:** RAW molto grandi possono richiedere un primo passaggio in editor desktop`,
    ],
    viewA: {
      caption: "Layout tool — immagine sorgente e controlli prep",
    },
    viewB: {
      caption: "Dopo prep — output web-ready pronto da scaricare",
    },
    alsoCan: [
      "Elaborare in batch alcuni still portfolio allo stesso preset",
      "Esportare WebP quando il sito destinazione lo supporta",
      "Usare prima di caricare cover per post blog o demo CRM",
    ],
    howWorks: `Il tool usa API browser (canvas / decodifica immagine) per ridimensionare e ricodificare sulla tua macchina. La rimozione EXIF elimina metadati incorporati così i file pubblicati non portano GPS o seriali camera per sbaglio. Background formati: [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) e [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).`,
    faq: [
      {
        q: "Le mie foto vengono caricate sui server IOM?",
        a: `No in prep normale — il lavoro resta nel browser finché non scarichi. Usa quel download come file da pubblicare altrove.`,
      },
      {
        q: "La qualità peggiorerà?",
        a: `La compressione scambia sempre dimensione e fedeltà. Parti da preset alta qualità; abbassa solo se il file resta pesante.`,
      },
    ],
    reading: [
      {
        label: "Tool Image Prep",
        url: "/tools/image-prep",
      },
      {
        label: "EXIF — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Exif",
      },
      {
        label: "WebP — Google developers",
        url: "https://developers.google.com/speed/webp",
      },
      {
        label: "File API — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/File_API",
      },
    ],
    related: [
      {
        label: "3D Viewer",
        url: "/blog/3d-viewer",
      },
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
    ],
  },
  "raven-path": {
    pageTitle: "Raven Path Animation — volo spline nel browser",
    demoLabel: "Raven Path Animation",
    hook: `A volte la storia è il movimento, non il fermo immagine. Raven Path mette un GLB alato su una spline Catmull-Rom — trascina i punti di controllo, regola velocità ed easing, inverti il percorso e mantieni l'animazione del battito d'ali mentre l'uccello segue la traiettoria.`,
    excerpt: `Anima un corvo (o il tuo GLB) lungo una spline modificabile — esporta il JSON del percorso per altri software, reimporta alla visita successiva e regola il timing nel browser.`,
    seo_title: "Raven Path Animation — volo spline ed export percorso — IOM",
    seo_description: `Prova la demo Raven Path di IOM: volo Catmull-Rom modificabile, import GLB/GLTF/FBX, export/reimport JSON del percorso e guida per principianti nella sezione 3D.`,
    coverNote: "La cover mostra il corvo sul suo percorso di volo modificabile.",
    whyBullets: [
      `- **Percorso come strumento di design** — rimodella il volo con punti di controllo visibili`,
      "- **Porta il tuo modello** — importa GLB, GLTF o FBX sullo stesso percorso",
      `- **Esporta e reimporta il percorso** — JSON per altri software o la prossima sessione`,
      `- **Timing percepibile** — velocità, ease-in/out, reverse e tangente vs. heading fisso`,
    ],
    whyUses: `loop hero per brand film, attract loop per stand, capitoli web narrativi, prototipazione di percorsi di «viaggio» creatura o prodotto prima di un passaggio animazione completo, e consegna di JSON percorso riutilizzabile ad altre pipeline.`,
    beginner: `Una spline è una curva liscia definita da pochi handle — come un filo flessibile nello spazio. Qui un corvo (o il tuo modello importato) percorre quel filo. Tiri gli handle e il volo si aggiorna live. Niente montaggio video; il percorso è il montaggio. Quando la rotta ti convince, esportala in JSON e ricaricala dopo — o usa i punti in altri tool.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: `una curva liscia che passa per i punti di controllo ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))`,
      },
      {
        term: "GLB / GLTF / FBX",
        def: "formati modello 3D comuni importabili sul percorso",
      },
      {
        term: "Path JSON",
        def: `punti di controllo esportati (e opzioni) reimportabili sul sito o usabili altrove`,
      },
      {
        term: "Tangent-aligned",
        def: "il modello ruota per guardare lungo la direzione del percorso",
      },
      {
        term: "Skeletal animation",
        def: `le ossa guidano il movimento secondario (come il battito d'ali) mentre la root segue la curva`,
      },
    ],
    trySteps: [
      "Apri la [demo Raven Path](/demos/raven-path/)",
      `Guarda un giro, poi trascina un punto di controllo della spline e vedi la rotta ridisegnarsi`,
      `In **Path**: **Export path JSON**, poi **Import path JSON** (o trascina il file sulla scena)`,
      `Opzionale: **Import GLB / GLTF / FBX**, poi regola velocità, ease, reverse o orientamento tangente`,
    ],
    requirements: [
      "**Browser:** Chrome, Edge o Firefox moderno con WebGL",
      "**GPU:** grafica integrata di solito basta per questa scena",
      `**Input:** mouse o trackpad rendono più facile l'editing dei punti rispetto al telefono`,
      "**File:** preferisci GLB autonomo per i modelli; i file percorso sono JSON",
    ],
    viewA: {
      caption: "Vista ampia del percorso — curva e corvo in un frame",
    },
    viewB: {
      caption: "Volo ravvicinato — posa alare lungo la spline",
    },
    alsoCan: [
      "Copia lo snippet THREE.Vector3 dal pannello Path per tool Three.js custom",
      `Confronta con l'esperimento [spline editor](/demos/spline-editor/) correlato`,
      `Studia i modifier di curva nella [demo WebGPU curve](/demos/webgpu-modifier-curve/)`,
      `Riutilizza l'idea percorso per «tour» prodotto o fly-through camera`,
    ],
    howWorks: `La demo usa [Three.js](https://threejs.org/) per campionare una curva Catmull-Rom ogni frame, posizionare la root del modello su quel campione e, opzionalmente, allineare l'asse forward alla tangente della curva mentre una clip scheletrica (se presente) guida il movimento secondario. Path JSON memorizza punti di controllo, loop chiuso e transform del percorso per reimportare sulla [demo live](/demos/raven-path/) o alimentare altri software. Stessa famiglia di idee degli esempi curve e animazione three.js — qui calibrata per un loop creatura leggibile con import ed export.`,
    faq: [
      {
        q: "Possiamo sostituire il corvo con la nostra mascotte?",
        a: `Sì — usa **Import GLB / GLTF / FBX** nella demo per provare subito il tuo modello sul percorso. Per una build di produzione brandizzata, chiedici una versione scoped.`,
      },
      {
        q: "Come riuso un percorso dopo o in altri software?",
        a: `Usa **Export path JSON** nel pannello Path. Reimporta quel file alla visita successiva sul sito, o usa i campi \`points\` / \`threeJsSnippet\` in Blender, Three.js o i tuoi tool.`,
      },
      {
        q: "È video o realtime?",
        a: `WebGL realtime. Puoi screen-recordare o esportare altrove, ma la demo stessa è una scena live.`,
      },
    ],
    reading: [
      {
        label: "Demo Raven Path",
        url: "/demos/raven-path/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "Spline Catmull–Rom — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
      {
        label: "Spline editor (correlato)",
        url: "/demos/spline-editor/",
      },
    ],
    related: [
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
      {
        label: "Dream — Ocean scroll",
        url: "/blog/iom-three",
      },
      {
        label: "Three.js Ocean",
        url: "/blog/threejs-ocean",
      },
    ],
  },
  "artist-globe": {
    pageTitle: "Artist Globe — una mappa vivente della pratica creativa",
    demoLabel: "Artist Globe",
    hook: `I portfolio si disperdono sul web; la geografia conta ancora. Artist Globe è una Terra WebGL interattiva di fotografi, pittori, scultori, artisti sonori e altro — filtra per pratica, apri profili, evidenzia paesi e invia una scheda per revisione.`,
    coverNote: "La cover mostra il globo con i marker artista dalla card 3D.",
    whyBullets: [
      "- **Scoprire per luogo** — ruota il mondo invece di scrollare griglie infinite",
      "- **Filtra per pratica** — fotografi, pittori, scultori, sound e altro",
      "- **Apri portfolio reali** — passa da un marker ai link di un artista",
      "- **Loop community** — invia un profilo per revisione quando vuoi comparire",
    ],
    whyUses: `scoperta culturale, scouting residenze e festival, networking in studio, e feature portfolio che servono uno strato spaziale «chi è dove?».`,
    beginner: `Immagina un globo da scrivania con pin per gli artisti. Lo ruoti, filtri chi appare e clicchi un pin per saperne di più. È una mappa di persone e pratiche, non un checkout di negozio.`,
    glossary: [
      {
        term: "WebGL globe",
        def: `una Terra 3D disegnata nel browser con grafica in stile [Three.js](https://threejs.org/)`,
      },
      {
        term: "Practice filter",
        def: "mostra solo certe discipline (es. fotografia)",
      },
      {
        term: "Profile",
        def: "una scheda artista con link ed evidenziazione paese",
      },
      {
        term: "Submit for review",
        def: "richiesta di aggiunta; gli editor approvano prima della pubblicazione",
      },
    ],
    trySteps: [
      "Apri [Artist Globe](/artist-globe)",
      "Trascina per ruotare; scroll o pinch per zoomare su una regione",
      "Usa i filtri pratica per restringere chi appare",
      `Clicca un marker per aprire un profilo, o segui il flusso submit se vuoi candidarti`,
    ],
    requirements: [
      "**Browser:** browser desktop o mobile moderno con WebGL",
      "**Rete:** profili e asset mappa richiedono connessione",
      "**Performance:** riduci altre tab GPU se il globo pesa su laptop datati",
    ],
    viewA: {
      caption: "Globo completo — marker sui continenti",
    },
    viewB: {
      caption: "Focus regionale — evidenziazione paese e pratica selezionata",
    },
    alsoCan: [
      "Evidenzia un paese mentre presenti una cohort regionale",
      "Condividi `/artist-globe` come landing page di scoperta",
      "Esiste modalità embed-friendly per frame portfolio più stretti (`?embed=1`)",
    ],
    howWorks: `Il globo è una scena [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API): una sfera texturizzata, controlli camera e sprite o mesh marker legati a lat/lon. Dati profilo e submission passano dallo stack web IOM così la mappa resta curata invece di un free-for-all non moderato.`,
    faq: [
      {
        q: "Chiunque può comparire sul globo?",
        a: "Le schede passano per submit-and-review così la mappa resta utile e affidabile.",
      },
      {
        q: "È un social network?",
        a: "No — è una mappa di scoperta di pratiche creative con link ai portfolio.",
      },
    ],
    reading: [
      {
        label: "Artist Globe",
        url: "/artist-globe",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
      {
        label: "Sezione 3D IOM",
        url: "/#3d",
      },
    ],
    related: [
      {
        label: "Streets GL Bridge",
        url: "/blog/streets-gl-bridge",
      },
      {
        label: "Art Gallery — SSR + Denoise",
        url: "/blog/ssr-denoise",
      },
    ],
  },
  "ssr-denoise": {
    pageTitle: "Art Gallery — WebGPU SSR + Denoise",
    demoLabel: "Art Gallery — WebGPU SSR + Denoise",
    hook: `Pavimenti lucidi e vetro sembrano reali solo se i riflessi reggono. Questa demo galleria esegue screen-space reflections WebGPU con denoise spatiotemporale — importa GLTF/FBX, cambia cieli HDR/EXR, cammina in third person e confronta riflessi raw vs. puliti.`,
    coverNote: "La cover mostra lo spazio galleria con riflessi denoised.",
    whyBullets: [
      "- **Riflessi che reggono** — SSR con denoise invece di una scia sfocata",
      "- **Porta il tuo modello** — carica GLTF/FBX nella shell galleria",
      "- **Cambia il cielo** — panorami HDR/EXR cambiano mood in secondi",
      "- **Percorri lo spazio** — esplorazione third person per lettura client-scale",
    ],
    whyUses: `viz prodotto interni, pitch galleria e showroom, review materiali, e conversazioni R&D WebGPU su qualità riflessi vs. framerate.`,
    beginner: `Le screen-space reflections (SSR) simulano specchi e pavimenti lucidi riusando ciò che la camera vede già, invece di renderizzare un secondo mondo completo. Può sembrare rumoroso. Denoise è il pass di pulizia che trasforma rumore scintillante in riflesso stabile — più vicino all'illuminazione da film, ancora live.`,
    glossary: [
      {
        term: "WebGPU",
        def: `API GPU browser moderna ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))`,
      },
      {
        term: "SSR",
        def: "screen-space reflections — specchi lucidi da ciò che è a schermo",
      },
      {
        term: "Denoise",
        def: "un filtro che leviga campioni riflesso rumorosi nello spazio/tempo",
      },
      {
        term: "HDR / EXR",
        def: "environment map ad alta gamma dinamica per illuminazione e cielo",
      },
      {
        term: "Third-person walk",
        def: "muovi un personaggio nella galleria invece del solo free-fly",
      },
    ],
    trySteps: [
      "Apri la [demo SSR + Denoise](/demos/ssr-denoise/) in Chrome o Edge",
      "Orbita o cammina finché vedi un riflesso lucido sul pavimento",
      `Attiva o confronta riflessi raw vs. denoised se l'UI espone lo switch`,
      "Opzionale: importa un piccolo GLTF/FBX o cambia HDR per re-illuminare la stanza",
    ],
    requirements: [
      "**Browser:** Chrome o Edge con WebGPU abilitato (113+ consigliato)",
      "**Hardware:** GPU discreta o integrata recente; abbassa qualità se scatta",
      "**Mobile:** limitato — tratta desktop come prima esperienza",
    ],
    viewA: {
      caption: `Galleria ampia — pareti d'arte e pavimento riflettente`,
    },
    viewB: {
      caption: "Dettaglio riflesso — lucentezza denoised sotto le luci",
    },
    alsoCan: [
      "Carica modelli custom per vedere come un pezzo cliente legge nella stanza",
      "Confronta qualità riflesso in movimento — il denoise mostra valore live",
      "Abbina ad altri studi WebGPU come volumetric lighting sullo stesso sito",
    ],
    howWorks: `Il punto di partenza è l'esempio ufficiale three.js [WebGPU SSR + denoise](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([sorgente su GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM avvolge quella pipeline in una shell galleria con import modello, swap HDR/EXR e walk mode così l'effetto è leggibile client, non solo un sample tech.`,
    faq: [
      {
        q: "Perché la pagina è vuota o mi avvisa?",
        a: `Questa demo richiede WebGPU. Usa una build recente di Chrome o Edge; Safari e Firefox datati potrebbero non esporre ancora l'API.`,
      },
      {
        q: "SSR è uguale al ray tracing?",
        a: `No. SSR riusa l'immagine a schermo; riflessi path-traced o ray-traced hardware sono un percorso più pesante. Denoise rende SSR più presentabile in realtime.`,
      },
    ],
    reading: [
      {
        label: "Demo live SSR + Denoise",
        url: "/demos/ssr-denoise/",
      },
      {
        label: "Esempio three.js SSR denoise",
        url: "https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise",
      },
      {
        label: "Sorgente esempio su GitHub",
        url: `https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html`,
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
      {
        label: "Three.js Ocean",
        url: "/blog/threejs-ocean",
      },
    ],
  },
  "iom-three": {
    pageTitle: "Dream — narrativa scroll oceano",
    demoLabel: "Dream — Ocean scroll",
    hook: `Non ogni pezzo 3D deve essere un cubo in orbita. Dream è una narrativa scroll attraverso acqua scura e calma, pioggia, terra lontana e riva — distorsione procedurale, audio ambient opzionale e runtime meteo con cielo, nuvole e sync giorno/notte. Capitolo 1 di 9; work in progress.`,
    coverNote: `La cover è lo schermo iniziale Dream — titolo, linea calma e controllo play prima che inizi lo scroll.`,
    whyBullets: [
      `- **Scroll come camera** — il movimento pagina racconta il capitolo, non solo drag in orbita`,
      "- **Atmosfera prima** — acqua, pioggia e meteo impostano il beat emotivo",
      "- **Audio che segue** — crossfade ambient opzionale con i capitoli visivi",
      "- **Mentalità serie** — capitolo 1 di 9 segnala un arco narrativo più lungo",
    ],
    whyUses: `landing story brand, companion web per mostre, opener folio, e esperimenti dove mood e pacing contano quanto la fedeltà del modello.`,
    beginner: `Invece di una camera libera che piloti tu, scrolli — e la scena avanza come pagine in un libro illustrato. Shader acqua e meteo fanno il grosso del visivo; leggi con pollice o rotella.`,
    glossary: [
      {
        term: "Scroll narrative",
        def: "beat narrativi legati alla posizione di scroll",
      },
      {
        term: "Procedural distortion",
        def: "movimento shader che deforma la superficie senza file video",
      },
      {
        term: "Weather runtime",
        def: "cielo, nuvole e giorno/notte guidati da parametri",
      },
      {
        term: "Crossfade audio",
        def: "layer ambient si mescolano al cambio capitolo",
      },
    ],
    trySteps: [
      "Apri la [demo Dream — Ocean scroll](/demos/dreams-iom/)",
      "Tocca play sullo schermo iniziale, poi scrolla lentamente i primi beat acqua",
      "Fermati sulla figura fluttuante — nota increspature, cielo e mood meteo",
      `Se l'audio è attivo nella tua build, unmute e scrolla di nuovo per il crossfade`,
    ],
    requirements: [
      "**Browser:** Chrome/Edge/Firefox moderno con WebGL",
      "**Motion:** scroll desktop o trackpad dà il pacing previsto",
      "**Audio:** opzionale — alcuni browser richiedono click prima del suono",
    ],
    viewA: {
      caption: "Schermo iniziale — DREAM., linea calma e play per entrare nello scroll",
    },
    viewB: {
      caption: "Dopo play — figura fluttuante su acqua scura e calma",
    },
    alsoCan: [
      "Usalo come mood board per un lancio multi-capitolo più lungo",
      `Abbina allo studio [Three.js Ocean](/blog/threejs-ocean) per contrasto tecnica superficie`,
      "Scopa un capitolo brandizzato con copy e audio bed custom",
    ],
    howWorks: `L'esperienza è un canvas [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) guidato dalla posizione di scroll: acqua shader e pass atmosferici si aggiornano col valore progresso narrativo. Meteo (cielo, nuvole, giorno/notte) è un runtime parametri invece di video baked. Live su [/demos/dreams-iom/](/demos/dreams-iom/).`,
    faq: [
      {
        q: "È finito?",
        a: `Capitolo 1 di 9 è il beat pubblico — una narrativa work-in-progress, non un film chiuso.`,
      },
      {
        q: "Possiamo mettere la nostra brand story qui?",
        a: `Sì come adattamento scoped: copy, pacing, audio e grade visivo. Contattaci con l'outline del capitolo.`,
      },
    ],
    reading: [
      {
        label: "Dream — Ocean scroll",
        url: "/demos/dreams-iom/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGL — Wikipedia",
        url: "https://en.wikipedia.org/wiki/WebGL",
      },
      {
        label: "Sezione 3D IOM",
        url: "/#3d",
      },
    ],
    related: [
      {
        label: "Three.js Ocean",
        url: "/blog/threejs-ocean",
      },
      {
        label: "Raven Path Animation",
        url: "/blog/raven-path",
      },
    ],
  },
  "threejs-ocean": {
    pageTitle: "Three.js Ocean — onde Gerstner, cielo ed export",
    demoLabel: "Three.js Ocean",
    hook: `Serve una piastra acqua hero brandizzabile in minuti? Questa demo oceano esegue acqua Gerstner-wave con cielo procedurale e preset sunset — posiziona testo 3D vetro (Google Fonts), icone decorative, cattura wallpaper o esporta fino a 30 secondi di video WebGL.`,
    coverNote: "La cover mostra il framing oceano sunset dalla card 3D.",
    whyBullets: [
      `- **Acqua leggibile in fretta** — onde Gerstner e cielo senza render farm da film`,
      `- **Tipo sull'acqua** — testo 3D vetro con Google Fonts per titoli`,
      "- **Preset sunset** — mood one-click per pitch e lockup",
      "- **Takeaway** — still wallpaper o breve export video WebGL",
    ],
    whyUses: `hero landing, piastre key art eventi, wallpaper social, e comp rapide «momento brand oceano» prima di un pass R&D acqua custom.`,
    beginner: `Le onde Gerstner sono un classico per simulare mare in realtime — picchi e valli che sembrano più acqua di una texture ripple piatta. Qui stanno sotto un cielo procedurale così componi titolo o icona e catturi.`,
    glossary: [
      {
        term: "Gerstner wave",
        def: "un modello matematico di mare usato negli oceani realtime",
      },
      {
        term: "Procedural sky",
        def: "colore cielo e sole calcolati in shader, non solo cupola foto",
      },
      {
        term: "Glass 3D text",
        def: "tipo estruso con shading rifrattivo/trasparente",
      },
      {
        term: "WebGL video export",
        def: "registrazione frame dal canvas in clip breve",
      },
    ],
    trySteps: [
      "Apri la [demo Three.js Ocean](/demos/ocean/)",
      "Orbita finché orizzonte e sole si leggono chiaramente (prova preset sunset)",
      `Aggiungi o modifica testo 3D vetro / icone se l'UI li offre`,
      "Cattura screenshot wallpaper o avvia breve export video (≤30s)",
    ],
    requirements: [
      "**Browser:** Chrome/Edge moderno consigliato per capture ed export",
      "**GPU:** grafica integrata di solito basta; abbassa qualità se le ventole girano",
      "**Export:** la capture video pesa di più — chiudi altre tab per take pulito",
    ],
    viewA: {
      caption: "Oceano sunset — orizzonte e mareggiata",
    },
    viewB: {
      caption: `Lockup titolo — testo vetro sull'acqua`,
    },
    alsoCan: [
      "Genera still social/wallpaper senza uscire dal browser",
      "Prototipa titoli evento prima del handoff al motion design",
      "Confronta tecnica con la narrativa scroll in [Dream](/blog/iom-three)",
    ],
    howWorks: `Costruito sulla linea ocean/water three.js ([sorgente esempio webgl_shaders_ocean](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) con UI IOM per testo, preset, screenshot e breve registrazione canvas. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) guida acqua e cielo ogni frame; l'export è una capture temporizzata dello stesso canvas.`,
    faq: [
      {
        q: "Possiamo usare la clip commercialmente?",
        a: `Tratta la demo pubblica come anteprima. Chiedici un pacchetto export licenziato o brandizzato per campagne.`,
      },
      {
        q: "È uguale a Dream — Ocean scroll?",
        a: `No. Questa è una piastra oceano orbitabile con tool export; Dream è un capitolo narrativo scroll su [/demos/dreams-iom/](/demos/dreams-iom/).`,
      },
    ],
    reading: [
      {
        label: "Demo Ocean",
        url: "/demos/ocean/",
      },
      {
        label: "Sorgente esempio ocean three.js",
        url: "https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "Onda Gerstner — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Trochoidal_wave",
      },
    ],
    related: [
      {
        label: "Dream — Ocean scroll",
        url: "/blog/iom-three",
      },
      {
        label: "Art Gallery — SSR + Denoise",
        url: "/blog/ssr-denoise",
      },
    ],
  },
  "panorama-suite": {
    pageTitle: "The Black Witness — tour visitatore 360°",
    demoLabel: "The Black Witness — Tour 360°",
    hook: `Lo stesso corvo, molti mondi — città, foresta, montagna, nebbia. Questa anteprima visitatore apre il tour The Black Witness senza chrome dell'editor, inquadrato a yaw −84,7° e pitch −6°, con hotspot, passi guidati e atmosfera WebGPU opzionale.`,
    coverNote: `La copertina è il passo 1 del tour guidato — hotspot corvo The Black Witness con popup aperto.`,
    whyBullets: [
      "- **Link visitatore-first** — nessuna UI editor; gli ospiti vedono solo il tour",
      "- **Passi guidati** — un percorso nella storia, non solo sguardo libero",
      "- **Hotspot con significato** — info e salti che insegnano mentre esplori",
      `- **Framing condivisibile** — deep-link yaw/pitch per una prima vista intenzionale`,
    ],
    whyUses: `compagni di mostra, lancio di serie fotografiche, loop attract da stand e proof client di come una storia 360° finita si sente su telefono o laptop.`,
    beginner: `Siete in piedi dentro una fotografia 360°. Trascinate per guardarvi intorno; toccate i marker per imparare o andare al posto successivo. La modalità preview è il „biglietto ospite“ — l'editor è come costruiamo; questo link è come il pubblico la vive.`,
    glossary: [
      {
        term: "Anteprima visitatore",
        def: "modalità tour senza strumenti di editing (`mode=preview`)",
      },
      {
        term: "Yaw / pitch",
        def: "angoli di sguardo orizzontale e verticale per la vista iniziale",
      },
      {
        term: "Tour guidato",
        def: `fermate ordinate che l'esperienza può attraversare`,
      },
      {
        term: "Hotspot",
        def: "un marker tappabile per info o la scena successiva",
      },
    ],
    trySteps: [
      "Aprire il [tour visitatore Black Witness](/demos/panorama-360/?mode=preview)",
      "Cliccare **Play guided tour** — quattro fermate camera con popup ed effetti",
      "Aprire un hotspot da soli dopo aver fermato il tour",
      `Condividere l'URL preview così i colleghi arrivano nella stessa esperienza`,
    ],
    requirements: [
      `**Browser:** browser mobile o desktop moderno; gli effetti WebGPU richiedono un dispositivo capace`,
      `**Rete:** i panorami sono pesanti in immagini — preferire Wi‑Fi al primo caricamento`,
      "**Input:** trascinamento touch o mouse; headset non richiesto",
    ],
    viewA: {
      caption: "Passo 2 — hotspot fuoco animato e popup particelle",
    },
    viewB: {
      caption: "Passo 3 — beat acqua / spout sul tetto",
    },
    viewC: {
      caption: "Passo 4 — Popup uccelli animati con lo stormo contro il cielo tempestoso",
    },
    alsoCan: [
      `Saltare all'[editor](/demos/panorama-360/) quando serve authorare hotspot`,
      "Riutilizzare il pattern deep-link per prime viste brandizzate in altri progetti",
      `Seguire lo stack effetti: [particles](/blog/webgpu-particles) → [spout](/blog/spout) → [birds](/blog/webgpu-compute-birds)`,
    ],
    howWorks: `Preview riusa lo stesso motore panorama dell'[Editor tour 360°](/blog/panorama-360-tour), ma i flag URL nascondono il chrome di authoring e impostano la camera iniziale (\`yaw\`, \`pitch\`). Hotspot e passi guidati sono dati di progetto su scene equirettangolari — [Three.js](https://threejs.org/) per sfera e camera, layer [WebGPU](https://en.wikipedia.org/wiki/WebGPU) opzionali per l'atmosfera. Su The Black Witness, il Passo 2 sovrappone [particles](/blog/webgpu-particles), il Passo 3 [spout](/blog/spout) e il Passo 4 [birds](/blog/webgpu-compute-birds) — ciascuno con hotspot+popup così gli ospiti hanno movimento sincronizzato a un beat narrativo cliccabile.`,
    faq: [
      {
        q: "Perché la mia vista parte in una direzione specifica?",
        a: `Il link imposta yaw −84,7° e pitch −6° così tutti condividono la stessa composizione di apertura.`,
      },
      {
        q: "Posso modificare gli hotspot da questo URL?",
        a: `Non in preview. Usare l'[editor tour](/demos/panorama-360/) (o chiederci un build di authoring production).`,
      },
      {
        q: "Quali sono i layer effetto nei passi 2–4?",
        a: `Passo 2 particles, Passo 3 spout/acqua, Passo 4 birds — ciascuno con popup hotspot. Le pagine esperimento standalone documentano la stessa tech.`,
      },
    ],
    reading: [
      {
        label: "Link tour visitatore",
        url: "/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6",
      },
      {
        label: "Editor tour",
        url: "/demos/panorama-360/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — Wikipedia",
        url: "https://en.wikipedia.org/wiki/WebGPU",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "css3d-sprites": {
    pageTitle: "CSS3D Sprites — HTML nello spazio 3D",
    demoLabel: "CSS3D Sprites",
    hook: `Cinquecentododici elementi HTML fluttuanti come sprite — poi morph tra piano, cubo, nuvola e sfera. È Three.js CSS3DRenderer: nodi DOM reali nello spazio camera, non solo quad texturizzati.`,
    coverNote: `La copertina mostra la nuvola di sprite a metà morph — tile HTML che leggono come formazione 3D.`,
    whyBullets: [
      `- **DOM incontra profondità** — contenuto HTML/CSS reale che orbita comunque in 3D`,
      `- **Storytelling morph** — piano → cubo → nuvola → sfera vende „i dati diventano forma“`,
      "- **Movimento senza game engine** — scala pulsante e transizioni nel browser",
      "- **Prototipo UI nello spazio** — card, label o foto come layout spaziali",
    ],
    whyUses: `schizzi UI spaziali, momenti portfolio „particella di card“ e demo client dove il contenuto deve restare HTML leggibile.`,
    beginner: `Immaginate thumbnail foto o tile colorate disposte in una stanza che potete ruotare. Ogni tile è ancora un elemento web normale — solo posizionato in 3D. Quando la forma cambia, le tile volano verso nuove posizioni come uno stormo coreografato.`,
    glossary: [
      {
        term: "CSS3DRenderer",
        def: "percorso Three.js che posiziona elementi HTML con transform CSS 3D",
      },
      {
        term: "Sprite",
        def: "un elemento piatto che sta nella scena come unità tipo billboard",
      },
      {
        term: "Morph",
        def: `transizione animata delle posizioni da una formazione all'altra`,
      },
      {
        term: "WebGL camera",
        def: "la stessa matematica camera 3D delle scene WebGL, che guida i transform CSS",
      },
    ],
    trySteps: [
      "Aprire la [demo CSS3D Sprites](/demos/css3d-sprites/)",
      "Trascinare per orbitare; osservare la formazione pulsare",
      "Attivare cambi forma (piano, cubo, random, sfera) se presenti pulsanti o UI",
      "Zoomare finché i singoli sprite HTML restano nitidi — quello è il vantaggio DOM",
    ],
    requirements: [
      "**Browser:** Chrome, Edge, Firefox o Safari moderno con transform CSS 3D",
      `**GPU:** carico leggero rispetto al compute WebGPU pesante — ok sulla maggior parte dei laptop`,
      "**Nota:** CSS3D + matematica camera Three.js, non una demo compute WebGPU",
    ],
    viewA: {
      caption: "Formazione sfera o cubo — sprite che leggono come volume solido",
    },
    viewB: {
      caption: "Nuvola / dispersione random — profondità e parallax delle tile HTML",
    },
    alsoCan: [
      "Scambiare contenuto sprite con immagini, label o colori brand",
      "Usare i morph come transizioni di sezione in un sito pitch",
      `Confrontare con l'esempio upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)`,
    ],
    howWorks: `Three.js guida una camera condivisa; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mappa le matrici oggetto su \`transform\` CSS dei nodi DOM. Le formazioni sono posizioni target; l'animazione interpola ogni sprite verso il layout successivo. Riferimento upstream: [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). A differenza dei sistemi particelle WebGPU, qui il lavoro è layout + compositing CSS piuttosto che compute shader.`,
    faq: [
      {
        q: "È WebGL o WebGPU?",
        a: `Né l'uno né l'altro come percorso principale — gli sprite sono HTML via CSS3D. Three.js usa comunque la matematica camera 3D familiare dalle scene WebGL.`,
      },
      {
        q: "Possiamo mettere card prodotto reali nella nuvola?",
        a: `Sì in principio — ogni sprite può contenere HTML più ricco. Definiamo performance e leggibilità per build client.`,
      },
    ],
    reading: [
      {
        label: "three.js — css3d_sprites",
        url: "https://threejs.org/examples/#css3d_sprites",
      },
      {
        label: "CSS3DRenderer docs",
        url: "https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "BufferGeometry Draw Range",
        url: "/blog/buffergeometry-drawrange",
      },
      {
        label: "WebGPU TSL Linked Particles",
        url: "/blog/webgpu-tsl-linked-particles",
      },
    ],
  },
  "compute-particles": {
    pageTitle: "Shape Particles — fisica compute WebGPU",
    demoLabel: "Shape Particles",
    hook: `Migliaia di particelle si allineano in cubo, sfera, toro, cuore — poi Release le lascia cadere sotto gravità GPU con rimbalzo sul pavimento. WebGPU compute mantiene la simulazione sulla scheda grafica.`,
    coverNote: "La copertina mostra un preset forma tenuto in formazione prima del drop.",
    whyBullets: [
      "- **Formazione → caos → reform** — una storia chiara per motion prodotto o brand",
      "- **Compute su GPU** — passi fisici senza bloccare il main thread",
      "- **Preset forma** — cubo, sfera, toro, cono, piramide, anello, cuore",
      `- **Prova interattiva** — Release e Reset vendono l'idea in un clic`,
    ],
    whyUses: `teaser di lancio, loop da stand e momenti pitch „i nostri dati diventano questa forma“.`,
    beginner: `Pensate a sabbia magnetica che può tenere una forma tipo logo, poi cade quando lasciate — e torna in forma al reset. La differenza è velocità: la GPU aggiorna ogni particella così resta fluida.`,
    glossary: [
      {
        term: "WebGPU",
        def: "API GPU browser moderna (più recente di WebGL) per compute e rendering",
      },
      {
        term: "Compute shader",
        def: "programma GPU che aggiorna dati (posizioni, velocità) senza disegnare triangoli",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language — logica GPU basata su nodi in JS",
      },
      {
        term: "Formazione",
        def: "posizioni target che fanno leggere le particelle come forma solida",
      },
    ],
    trySteps: [
      "Aprire la [demo Shape Particles](/demos/compute-particles/)",
      "Scegliere un preset forma e orbitare la formazione",
      "Premere Release — osservare gravità e rimbalzo sul pavimento",
      `Premere Reset per reformare; provare un'altra forma`,
    ],
    requirements: [
      "**Browser:** Chrome o Edge con WebGPU abilitato (versioni recenti)",
      "**GPU:** GPU discreta o integrata recente consigliata per count densi",
      "**Fallback:** senza WebGPU vedrete un messaggio capability — non è un port WebGL",
    ],
    viewA: {
      caption: "Formazione tenuta — particelle che leggono come preset solido",
    },
    viewB: {
      caption: "Dopo Release — spray e rimbalzo sul piano del pavimento",
    },
    alsoCan: [
      "Ciclare preset per un breve loop brand",
      "Regolare count / look per performance stand vs laptop",
      `Confrontare con [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)`,
    ],
    howWorks: `Un pass compute [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) aggiorna lo stato particelle ogni frame; il renderer disegna il risultato. Three.js espone questo tramite WebGPU renderer e nodi compute TSL. Upstream: [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL può disegnare particelle, ma il loop gravità/reform di questa demo è costruito per compute WebGPU.`,
    faq: [
      {
        q: "Perché il browser dice che manca WebGPU?",
        a: `Questo esperimento richiede WebGPU. Usare Chrome o Edge aggiornato; il supporto Safari/Firefox varia per versione.`,
      },
      {
        q: "Le particelle possono formare il nostro logo?",
        a: `Mesh target o point cloud custom sono un passo naturale — chiedeteci un build scoped.`,
      },
    ],
    reading: [
      {
        label: "three.js — compute particles",
        url: "https://threejs.org/examples/#webgpu_compute_particles",
      },
      {
        label: "WebGPU API — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "webgpu-spotlight": {
    pageTitle: "WebGPU Spotlight — fasci texturizzati e ombre",
    demoLabel: "WebGPU Spotlight",
    hook: `Un spot light che si comporta come un proiettore teatrale — texture proiettata nel cono, penombra morbida, decay e ombre focalizzate — su Three.js WebGPU con la classica scansione Lucy come soggetto.`,
    coverNote: `La copertina mostra Lucy sotto lo spotlight mobile su pavimento che riceve ombre.`,
    whyBullets: [
      "- **Linguaggio luce showroom** — cono, falloff e texture map tipo gobo",
      "- **Ombre reali** — contatto a terra vende profondità per prodotto e scultura",
      `- **Percorso materiali WebGPU** — illuminazione Three.js moderna, non GIF pre-calcolata`,
      "- **Helper on demand** — visualizzare la luce durante il tuning",
    ],
    whyUses: `turntable prodotto, studi galleria e pitch illuminazione prima di una scena production completa.`,
    beginner: `Uno spotlight è un cono di luce, come una lampada da palco. Qui vedete il bordo morbido del cono, come la luminosità cala con la distanza, e come l'ombra della scultura sta sul pavimento — tutto live nel browser.`,
    glossary: [
      {
        term: "Spotlight",
        def: "luce con angolo cono, direzione e texture opzionale nel fascio",
      },
      {
        term: "Penumbra",
        def: "il bordo morbido del cono luminoso",
      },
      {
        term: "Decay",
        def: `quanto rapidamente l'intensità cala con la distanza`,
      },
      {
        term: "WebGPU",
        def: `l'API GPU browser più recente usata da questo percorso renderer Three.js`,
      },
    ],
    trySteps: [
      "Aprire la [demo WebGPU Spotlight](/demos/webgpu-spotlight/)",
      `Orbitare intorno a Lucy; osservare lo spot mobile e l'ombra a terra`,
      "Attivare helper luce se disponibili per vedere il cono",
      "Notare penombra e focus — bordo morbido vs ombra netta come compromessi",
    ],
    requirements: [
      `**Browser:** Chrome o Edge con WebGPU (non l'esempio lights WebGL più vecchio)`,
      "**GPU:** qualsiasi GPU laptop recente di solito basta per questa scena",
      `**Modello:** Lucy PLY incluso — mesh custom pesanti possono richiedere ottimizzazione`,
    ],
    viewA: {
      caption: "Tre quarti — cono luce leggibile su Lucy e pavimento",
    },
    viewB: {
      caption: "Focus ombra — ombra di contatto e penombra a terra",
    },
    alsoCan: [
      "Scambiare texture gobo / proiezione per pattern brand",
      `Abbinare a demo volumetriche per mood „fascio nell'aria“`,
      `Studiare l'esempio upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)`,
    ],
    howWorks: `Three.js \`WebGPURenderer\` valuta spot light con map, penombra, decay e shadow map nella pipeline WebGPU. La scena orbita uno spot animato sopra Lucy PLY su un piano ricevente. Esempio ufficiale: [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL ha esempi spotlight classici; questa pagina segue specificamente il percorso lights WebGPU.`,
    faq: [
      {
        q: "È la stessa cosa dei god ray volumetrici?",
        a: `No — è illuminazione di superficie e ombre. Per fasci nell'aria, vedere il nostro lavoro di illuminazione volumetrica.`,
      },
      {
        q: "Possiamo illuminare il nostro prodotto?",
        a: `Sì. Sostituire Lucy con un GLB e matchare l'esposizione è un tipico passo client.`,
      },
    ],
    reading: [
      {
        label: "three.js — WebGPU spotlight",
        url: "https://threejs.org/examples/#webgpu_lights_spotlight",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
      {
        label: "WebGPU Custom Fog Scattering",
        url: "/blog/webgpu-custom-fog-scattering",
      },
    ],
  },
  "webgpu-compute-birds": {
    pageTitle: "WebGPU Compute Birds — flocking GPU",
    demoLabel: "WebGPU Compute Birds",
    hook: `Ottomila uccelli in stormo nel browser — separation, alignment e cohesion calcolati su GPU. Muovete il mouse per disturbare lo stormo; regolate il comportamento live.`,
    coverNote: "La copertina mostra lo stormo instanziato come murmuration coerente.",
    whyBullets: [
      "- **Boids classici, GPU moderna** — regole stile Reynolds a scala interattiva",
      "- **Instancing** — un mesh, migliaia di uccelli",
      "- **Disturbo puntatore** — gli stakeholder sentono agency in secondi",
      "- **WebGPU compute** — simulazione fuori dal main thread CPU",
    ],
    whyUses: `momenti brand ispirati alla natura, UI esplicative scientifiche e stress test per pipeline compute GPU.`,
    beginner: `Gli uccelli in stormo seguono regole semplici: non scontrarsi, allinearsi ai vicini, restare con il gruppo. Moltiplicate per migliaia e ottenete una murmuration. Qui quelle regole girano sulla scheda grafica così il movimento resta fluido.`,
    glossary: [
      {
        term: "Boids",
        def: "modello flocking classico: separation, alignment, cohesion",
      },
      {
        term: "Instancing",
        def: "disegnare efficientemente molte copie di un mesh",
      },
      {
        term: "Compute",
        def: "lavoro GPU che aggiorna posizioni/velocità uccelli ogni frame",
      },
      {
        term: "WebGPU",
        def: "API usata qui invece dei vecchi trucchi GPGPU solo WebGL",
      },
    ],
    trySteps: [
      "Aprire la [demo WebGPU Compute Birds](/demos/webgpu-compute-birds/)",
      "Osservare lo stormo stabilizzarsi in movimento coerente",
      "Muovere il mouse attraverso lo stormo per disturbarlo",
      "Aprire Birds settings e regolare separation / alignment / cohesion",
    ],
    requirements: [
      "**Browser:** Chrome o Edge WebGPU-capable consigliato",
      "**GPU:** mid-range o superiore per 8k istanze a frame rate fluidi",
      "**Not WebGL:** il percorso flocking compute punta a WebGPU",
    ],
    viewA: {
      caption: "Murmuration ampia — stormo che legge come un volume",
    },
    viewB: {
      caption: "Passaggio più vicino — uccelli instanziati e direzione di volo",
    },
    alsoCan: [
      "Ritunare le forze per mood brand più calmi vs caotici",
      "Usare come layer di sfondo dietro UI (attenzione al contrasto)",
      `Integrare lo stormo in un beat cielo di [360° guided tour](/demos/panorama-360/) (Passo 4)`,
      `Confrontare [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) su threejs.org`,
    ],
    howWorks: `Ogni frame un pass compute WebGPU applica forze flocking e scrive nuovi transform; il disegno instanziato renderizza gli uccelli. Upstream: [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). Esistono esempi WebGL „GPGPU birds“ più vecchi nella storia three.js; questa pagina IOM segue l'edizione compute WebGPU.`,
    tourBridge: {
      step: 4,
      stepLabel: "Tour guidato Passo 4 — layer birds + popup hotspot su The Black Witness",
      body: `Nella [360° Panorama Tour](/demos/panorama-360/), **Passo 4** è authorato come \`cam · +birds · hotspot+popup\`: la camera inclina verso il cielo, il layer WebGPU birds dà vita all'atmosfera, e un hotspot/popup mantiene la storia cliccabile.

Il flocking standalone prova la tech; il tour prova il **pattern prodotto** — layer GPU viventi sincronizzati a una fermata guidata così gli ospiti sentono movimento *e* possono ancora trascinare per guardare e toccare per imparare. I beat precedenti usano [WebGPU Particles](/blog/webgpu-particles) (Passo 2) e [Spout](/blog/spout) (Passo 3) allo stesso modo.`,
    },
    faq: [
      {
        q: "Perché così tanti uccelli?",
        a: `La scala è il punto — compute + instancing mostrano cosa WebGPU può sostenere interattivamente.`,
      },
      {
        q: "Gli uccelli possono seguire un percorso o logo?",
        a: "Campi guida e attractor sono estensioni comuni per storie client.",
      },
      {
        q: "Dove compaiono gli uccelli nel tour 360?",
        a: `Passo 4 tour guidato su The Black Witness — layer birds con popup hotspot. Aprire /demos/panorama-360/ e Play guided tour.`,
      },
    ],
    reading: [
      {
        label: "three.js — compute birds",
        url: "https://threejs.org/examples/#webgpu_compute_birds",
      },
      {
        label: "360° Panorama Tour Editor",
        url: "/demos/panorama-360/",
      },
      {
        label: "Boids — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Boids",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
    ],
  },
  "webgpu-parallax-uv": {
    pageTitle: "WebGPU Parallax UV — profondità in una texture piatta",
    demoLabel: "WebGPU Parallax UV",
    hook: `Ghiaccio che sembra più spesso di un piano piatto — il parallax UV TSL offsetta map ambientCG a strati con displacement, normali e rugosità sotto luce HDR.`,
    coverNote: `La cover mostra il suolo di ghiaccio con profondità parallax mentre la camera sfiora la superficie.`,
    whyBullets: [
      `- **Spessore simulato, risparmio reale** — segnale di profondità senza mesh scolpito pesante`,
      "- **Materiali TSL** — materiali a nodi Three.js moderni su WebGPU",
      "- **Stack PBR** — albedo, normal, rugosità e displacement insieme",
      "- **Ambiente HDR** — riflessi che vendono un materiale ghiacciato",
    ],
    whyUses: `studi materiali, piani di base per product shot e review « questo shader si legge? ».`,
    beginner: `Una foto normale di ghiaccio è piatta. Il parallax UV inganna l'occhio: muovendo la camera, la texture si sposta leggermente come se ci fosse profondità sotto la superficie — come guardare nel ghiaccio chiaro senza modellare ogni crepa.`,
    glossary: [
      {
        term: "Parallax mapping",
        def: "offset UV basato su angolo di vista e map altezza/displacement",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language per materiali GPU basati su nodi",
      },
      {
        term: "PBR",
        def: "physically based rendering — modello materiale rugosità/metalness",
      },
      {
        term: "HDR environment",
        def: "immagine ad alta gamma dinamica che illumina i riflessi della scena",
      },
    ],
    trySteps: [
      "Apri la [demo WebGPU Parallax UV](/demos/webgpu-parallax-uv/)",
      `Orbita basso sul ghiaccio — osserva lo shift di profondità con l'angolo`,
      `Confronta vista rasente vs. dall'alto`,
      "Nota come normali e rugosità cambiano il look gelato sotto HDR",
    ],
    requirements: [
      "**Browser:** WebGPU (Chrome/Edge consigliato)",
      "**Texture:** map stile ambientCG incluse; rete utile al primo caricamento",
      `**GPU:** da leggero a moderato — più pesante di un piano piatto non illuminato, più leggero di stormi compute completi`,
    ],
    viewA: {
      caption: "Angolo rasente — profondità parallax nel piano di ghiaccio",
    },
    viewB: {
      caption: "Vista più alta — map a strati e riflesso HDR leggibili",
    },
    alsoCan: [
      "Retargetare le map su pietra, legno o materiali di brand",
      "Usare come base sotto un GLB prodotto",
      "Studiare [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv)",
    ],
    howWorks: `Un materiale TSL campiona altezza/displacement per offsettare UV secondo direzione di vista (parallax), poi stratifica colore, normal e rugosità. WebGPURenderer esegue il grafo nodi. Upstream: [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Shader parallax WebGL classici esistono; questa demo segue il percorso WebGPU + TSL.`,
    faq: [
      {
        q: "Il ghiaccio è un vero volume 3D?",
        a: "No — è un piano ombreggiato. Il parallax simula profondità nel materiale.",
      },
      {
        q: "Possiamo usare il nostro set di texture?",
        a: "Sì. Nomi map e intensità corrispondenti = swap materiale standard.",
      },
    ],
    reading: [
      {
        label: "three.js — parallax UV",
        url: "https://threejs.org/examples/#webgpu_parallax_uv",
      },
      {
        label: "ambientCG",
        url: "https://ambientcg.com/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU TSL Raging Sea",
        url: "/blog/webgpu-tsl-raging-sea",
      },
      {
        label: "WebGPU Custom Fog Scattering",
        url: "/blog/webgpu-custom-fog-scattering",
      },
    ],
  },
  "webgpu-tsl-raging-sea": {
    pageTitle: "WebGPU TSL Raging Sea — onde procedurali",
    demoLabel: "TSL Raging Sea",
    hook: `Un mare in tempesta senza simulatore oceanico — onde sinusoidali a strati e noise frattale spostano un piano denso, con normali calcolate e creste emissive, tutto in TSL su WebGPU.`,
    coverNote: "La cover mostra alto mare con highlight luminosi sulle creste.",
    whyBullets: [
      `- **Acqua procedurale** — niente flipbook pre-baked; i parametri guidano l'atmosfera`,
      "- **Displacement TSL** — la matematica delle onde vive nel grafo materiale",
      `- **Energia delle creste** — highlight emissivi vendono schiuma e spray senza particelle`,
      "- **Percorso WebGPU** — sketch oceano Three.js moderno per pitch e R&D",
    ],
    whyUses: `sfondi ambientali, contesto prodotto marino e R&D shader prima di sistemi oceano FFT.`,
    beginner: `Il « mare » è una griglia piatta che la GPU spinge su e giù ogni frame con la matematica — grandi onde più piccolo chop. L'illuminazione sui pendii lo fa sembrare acqua invece di un foglio stropicciato.`,
    glossary: [
      {
        term: "Displacement",
        def: "spostamento vertici mesh (o shading) con una funzione di altezza",
      },
      {
        term: "Fractal noise",
        def: "noise a strati per dettaglio naturale",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language per authorare il grafo onde",
      },
      {
        term: "Normals",
        def: `direzioni di superficie per l'illuminazione; ricalcolate dalle onde`,
      },
    ],
    trySteps: [
      "Apri la [demo TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)",
      "Orbita e osserva grandi mareggiate vs. piccolo chop",
      "Cerca creste emissive sui picchi delle onde",
      `Confronta l'atmosfera con altri esperimenti oceano sul sito`,
    ],
    requirements: [
      "**Browser:** WebGPU richiesto per questo esempio TSL WebGPU",
      "**GPU:** piani più densi costano di più — abbassa pixel ratio se stutter",
      "**Non oceano WebGL:** distinto dalle demo acqua/FFT WebGL classiche",
    ],
    viewA: {
      caption: "Mare tempestoso ampio — mareggiate a strati leggibili in lontananza",
    },
    viewB: {
      caption: "Dettaglio cresta — normali e highlight emissivi",
    },
    alsoCan: [
      "Ritune ampiezza e noise per porto calmo vs. tempesta",
      "Usare come sfondo adiacente skybox sotto un prodotto",
      `Apri [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream`,
    ],
    howWorks: `Il displacement vertex (o TSL equivalente) somma grandi sinusoidi con noise frattale; le normali sono derivate così l'illuminazione reagisce ai pendii; le creste ricevono lift emissivo. Gira su Three.js WebGPU + TSL. Upstream: [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Per mari basati su spettro, vedi lavoro oceano FFT dedicato altrove su IOM — tecnica diversa, spesso WebGL o ibrida.`,
    faq: [
      {
        q: "È una simulazione oceano completa?",
        a: "No — displacement procedurale. Ottimo per look development; non CFD.",
      },
      {
        q: "WebGL o WebGPU?",
        a: `WebGPU via Three.js TSL. Copertura device più ampia può ancora preferire oceani WebGL.`,
      },
    ],
    reading: [
      {
        label: "three.js — TSL raging sea",
        url: "https://threejs.org/examples/#webgpu_tsl_raging_sea",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "WebGPU Parallax UV",
        url: "/blog/webgpu-parallax-uv",
      },
      {
        label: "Terrain Sandbox",
        url: "/blog/terrain-sandbox",
      },
    ],
  },
  "webgpu-tsl-linked-particles": {
    pageTitle: "WebGPU TSL Linked Particles — scie VFX disegnate",
    demoLabel: "TSL Linked Particles",
    hook: `Muovi il puntatore per generare una scia di particelle luminose — compute GPU, turbolenza, nastri di link tra vicini, rotazione tonalità e bloom. Uno sketch VFX TSL che si sente.`,
    coverNote: "La cover mostra nastri di particelle collegate con bloom.",
    whyBullets: [
      "- **Puntatore come pennello** — « prova subito » per clienti in call",
      "- **Link tra vicini** — linguaggio rete / sinapsi / costellazione",
      "- **Compute + TSL** — spawn, turbolenza e vita sulla GPU",
      "- **Finitura bloom** — glow morbido premium su UI scure",
    ],
    whyUses: "sfondi hero, momenti interattivi stand e sistemi visuali brand tech.",
    beginner: `Disegni con la luce: le particelle appaiono sotto il cursore, derivano con turbolenza, e linee sottili collegano punti vicini — come una costellazione che ricorda il tuo gesto per un momento.`,
    glossary: [
      {
        term: "Nearest-neighbor links",
        def: "linee tra particelle vicine nello spazio",
      },
      {
        term: "Turbulence",
        def: "campo di forza rumoroso che arriccia il moto delle particelle",
      },
      {
        term: "Bloom",
        def: "glow post-process intorno ai pixel luminosi",
      },
      {
        term: "TSL VFX",
        def: "effetti authorati con nodi Three.js Shading Language",
      },
    ],
    trySteps: [
      "Apri la [demo TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)",
      "Muovi il puntatore sul canvas per disegnare scie",
      "Pausa e osserva link e shift tonalità mentre le particelle svaniscono",
      "Orbita se abilitato; nota bloom su cluster luminosi",
    ],
    requirements: [
      "**Browser:** WebGPU (Chrome/Edge consigliato)",
      `**GPU:** bloom + compute vogliono un po' di margine — chiudi tab pesanti se serve`,
      "**Input:** mouse o trackpad; touch varia per device",
    ],
    viewA: {
      caption: "Cluster denso a sinistra — link magenta con accenti cyan",
    },
    viewB: {
      caption: "Mesh più vicina — nodi bloomati e nastri vicini",
    },
    alsoCan: [
      "Mappare puntatore su touch / bacchetta per installazioni",
      "Ricolorare ciclo tonalità verso palette brand",
      `Confronta [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)`,
    ],
    howWorks: `Compute WebGPU spawna e advecta particelle; materiali TSL renderizzano sprite/nastri; un pass link collega particelle vicine; bloom post-processa il frame. Upstream: [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). Reti linee WebGL (vedi draw-range) sono idea visiva correlata con pipeline diversa più supportata.`,
    faq: [
      {
        q: "È uguale alla demo shape particles?",
        a: `No — quella forma preset solidi e gravità. Questa è VFX disegnato col puntatore con link e bloom.`,
      },
      {
        q: "Possiamo rallentarlo per un film brand calmo?",
        a: "Sì — spawn rate, turbolenza e soglie bloom sono manopole tipiche.",
      },
    ],
    reading: [
      {
        label: "three.js — TSL linked particles",
        url: "https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "BufferGeometry Draw Range",
        url: "/blog/buffergeometry-drawrange",
      },
    ],
  },
  "webgpu-custom-fog-scattering": {
    pageTitle: "WebGPU Custom Fog Scattering — camminare nella foschia",
    demoLabel: "Custom Fog Scattering",
    hook: `Una passeggiata in prima persona tra silhouette di pini procedurali in nebbia esponenziale fresca — blur di scattering TSL basato sulla densità che ammorbidisce la distanza come aria umida.`,
    coverNote: "La cover mostra forme di pino che si dissolvono nella nebbia diffusa.",
    whyBullets: [
      "- **Atmosfera come soggetto** — mood prima, geometria dopo",
      "- **Blur di scattering** — la distanza si ammorbidisce come aria umida",
      "- **Densità regolabile** — nebbia e scattering come dial di design",
      "- **WebGPU + TSL** — nebbia custom oltre un singolo colore scene.fog",
    ],
    whyUses: "pitch ambientali, walkthrough tipo gioco e studi « meteo come brand ».",
    beginner: `La nebbia non è solo una tinta grigia. Nell'aria umida gli alberi lontani sembrano più morbidi e lattei. Questa demo ti fa vivere quella sensazione — silhouette di pini che svaniscono in una foschia fresca che puoi addensare o diradare.`,
    glossary: [
      {
        term: "Exponential fog",
        def: "nebbia che si addensa gradualmente con la distanza",
      },
      {
        term: "Scattering",
        def: "luce che rimbalza nel mezzo — qui approssimata come blur/ammorbidimento",
      },
      {
        term: "First-person",
        def: "camera si muove come se camminassi nella scena",
      },
      {
        term: "TSL",
        def: "node shading per personalizzare il comportamento nebbia su WebGPU",
      },
    ],
    trySteps: [
      "Apri la [demo Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)",
      "Cammina o guardati intorno nel campo di pini",
      "Alza densità nebbia — osserva la distanza collassare nella foschia",
      "Regola fattore scattering e confronta pini lontani nitidi vs. morbidi",
    ],
    requirements: [
      "**Browser:** Chrome o Edge compatibile WebGPU",
      `**Controlli:** tastiera / puntatore come implementato nell'UI demo`,
      "**GPU:** comodo su laptop moderni; abbassa risoluzione se motion blur",
    ],
    viewA: {
      caption: "Cammina più in profondità — tronchi più densi mentre la foschia chiude",
    },
    viewB: {
      caption: "Tronco vicino — scattering ammorbidisce la foresta dietro",
    },
    alsoCan: [
      "Retintare nebbia per mood brand alba / notte",
      "Scambiare silhouette con masse architettoniche",
      `Leggi [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)`,
    ],
    howWorks: `Silhouette procedurali simili ad alberi in una scena WebGPU; TSL implementa nebbia consapevole della densità e blur scattering così la struttura lontana si ammorbidisce. Upstream: [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). WebGL \`FogExp2\` standard è più semplice; questo esperimento mostra trattamento scattering custom sulla stack WebGPU.`,
    faq: [
      {
        q: "È illuminazione volumetrica?",
        a: `Mood correlato, tecnica diversa — qui focus nebbia/scattering in un bosco percorribile, non god rays rect-area.`,
      },
      {
        q: "Possiamo usare un modello sito reale?",
        a: `Sì come integrazione scoped — sostituire silhouette con LOD architettura semplificati.`,
      },
    ],
    reading: [
      {
        label: "three.js — custom fog scattering",
        url: "https://threejs.org/examples/#webgpu_custom_fog_scattering",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Spotlight",
        url: "/blog/webgpu-spotlight",
      },
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
    ],
  },
  "webgpu-modifier-curve": {
    pageTitle: "WebGPU Curve Modifier — testo lungo una spline",
    demoLabel: "WebGPU Curve Modifier",
    hook: `Testo estruso che scorre lungo una spline Catmull-Rom chiusa — trascina le maniglie di controllo e la mesh si deforma col percorso. Un approccio WebGPU ai curve modifier per logo e tipografia.`,
    coverNote: "La cover mostra letterforme piegate lungo la curva editabile.",
    whyBullets: [
      "- **Tipo come geometria** — logo e headline che vivono su un percorso",
      "- **Maniglie live** — rimodellare la storia davanti al client",
      "- **Spline chiusa** — loop per movimento stand infinito",
      `- **Si abbina agli strumenti percorso** — stessa famiglia di editor spline e rail camera`,
    ],
    whyUses: "logo animati, titoli esposizione e callout prodotto guidati dal percorso.",
    beginner: `Immagina lettere magnetiche flessibili lungo un filo curvo. Muovi i punti di controllo del filo e le lettere scivolano e si piegano di conseguenza. È un curve modifier — qui nel browser su WebGPU.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: "curva liscia che passa per i punti di controllo",
      },
      {
        term: "Curve modifier",
        def: "deforma una mesh perché segua un percorso",
      },
      {
        term: "Extruded text",
        def: "geometria lettere 3D da contorno font",
      },
      {
        term: "Control handle",
        def: "punto trascinabile che rimodella la spline",
      },
    ],
    trySteps: [
      "Apri la [demo WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)",
      "Clicca una maniglia di controllo per selezionarla",
      "Trascina per rimodellare il percorso chiuso — osserva il flusso del testo",
      "Orbita per controllare spessore lettere e silhouette",
    ],
    requirements: [
      "**Browser:** WebGPU (Chrome/Edge consigliato)",
      "**Input:** mouse per picking e drag delle maniglie",
      "**GPU:** modesto — font più pesanti / estrusione fine aumentano costo",
    ],
    viewA: {
      caption: "Loop completo — testo estruso che segue la spline chiusa",
    },
    viewB: {
      caption: "Edit maniglia — curvatura locale delle letterforme sul percorso",
    },
    alsoCan: [
      "Scambiare la stringa con un wordmark brand",
      "Esportare idee percorso in workflow rail camera",
      `Confronta [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)`,
    ],
    howWorks: `Una curva Catmull-Rom chiusa definisce il percorso; un modifier campiona la curva per trasformare geometria testo estruso ad ogni update. WebGPURenderer disegna il risultato. Upstream: [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Per editing puro percorso senza modifier, vedi l'[editor spline](https://threejs.org/examples/#webgl_geometry_spline_editor) WebGL — strumenti complementari.`,
    faq: [
      {
        q: "Possiamo usare il nostro font?",
        a: `Di solito sì con font licenziato meshabile per il web — gestiamo conversione nei build production.`,
      },
      {
        q: "WebGPU richiesto?",
        a: `Per questa pagina demo sì. Idee curva possono anche andare su WebGL a seconda del progetto.`,
      },
    ],
    reading: [
      {
        label: "three.js — curve modifier",
        url: "https://threejs.org/examples/#webgpu_modifier_curve",
      },
      {
        label: "three.js — spline editor",
        url: "https://threejs.org/examples/#webgl_geometry_spline_editor",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "Catmull Spline Editor",
        url: "/blog/spline-editor",
      },
      {
        label: "Shape Particles",
        url: "/blog/compute-particles",
      },
    ],
  },
  "webgpu-particles": {
    pageTitle: "WebGPU Particles — sprite fuoco e fumo",
    demoLabel: "WebGPU Particles",
    hook: `Sprite fuoco e fumo instanziati con cicli di vita TSL — UV fumo rotanti, fuoco additivo e griglia a terra semplice. VFX WebGPU compatto per mood e calore prodotto.`,
    coverNote: `La cover mostra lo stesso linguaggio particelle fuoco/fumo di Guided Tour Step 2 su The Black Witness — calore rooftop con popup hotspot « Animated fire » in https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      "- **VFX elementare leggibile** — fuoco + fumo senza pacchetto FX completo",
      "- **Sprite instanziati** — molte particelle, una strategia di draw",
      "- **Cicli di vita TSL** — spawn, invecchiamento e fade sul percorso GPU",
      "- **Fuoco additivo** — glow che compone pulito su scene scure",
      `- **Integrato nei tour 360°** — Step 2 su [Panorama 360](https://iobjectm.com/demos/panorama-360/) abbina particelle e popup hotspot`,
    ],
    whyUses: `mood fucina/lancio, sketch camp e industriali, loop hero leggeri e beat calore in tour guidati 360° interattivi.`,
    beginner: `Fuoco e fumo qui sono molte piccole immagini (sprite) che svaniscono e vorticoso nel tempo. Blending additivo rende le fiamme luminose; il fumo usa texture più morbide. Insieme vendono calore senza simulare combustione reale. Nel nostro [tour 360°](https://iobjectm.com/demos/panorama-360/), lo stesso linguaggio diventa Guided Tour Step 2 — una tappa che gli ospiti possono guardare intorno e cliccare.`,
    glossary: [
      {
        term: "Sprite particle",
        def: "quad texturizzato, spesso camera-facing, per fumo/fuoco",
      },
      {
        term: "Additive blending",
        def: "i colori si sommano — luminoso per fuoco, facile da sovraesporre",
      },
      {
        term: "Life cycle",
        def: "nascita, invecchiamento e morte di ogni particella",
      },
      {
        term: "Instancing",
        def: "disegnare efficientemente molte particelle da un template",
      },
      {
        term: "Guided tour Step 2",
        def: "su /demos/panorama-360/ — cam · +particles · hotspot+popup",
      },
    ],
    trySteps: [
      "Apri la [demo WebGPU Particles](/demos/webgpu-particles/)",
      "Orbita la colonna — separa nucleo fuoco da corpo fumo",
      "Osserva rotazione sprite / movimento UV nel fumo",
      `Apri [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, e guarda Step 2 (particelle + hotspot)`,
    ],
    requirements: [
      "**Browser:** WebGPU via Three.js (non solo vecchi esempi particelle WebGL)",
      "**GPU:** ok sulla maggior parte dei laptop moderni ai count predefiniti",
      "**Display:** sfondi UI scuri mostrano meglio il fuoco additivo",
    ],
    viewA: {
      caption: "Walkthrough fuoco rooftop — pennacchio animato sulla città",
    },
    viewB: {
      caption: "Calore ravvicinato — pennacchio particelle sulla skyline",
    },
    alsoCan: [
      "Ricolorare fiamme per calore brand-safe",
      "Stratificare sotto silhouette prodotto per film lancio",
      `Inserire lo stesso linguaggio particelle in un beat [tour guidato 360°](/demos/panorama-360/) (Step 2)`,
      "Apri [webgpu_particles](https://threejs.org/examples/#webgpu_particles)",
    ],
    howWorks: `Sprite instanziati campionano texture fuoco/fumo; materiali nodo TSL animano vita, rotazione e blending; WebGPURenderer compone il frame. Upstream: [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). Sistemi particelle WebGL restano ampiamente usati per supporto più ampio — scegli API in base ai device del pubblico.`,
    tourBridge: {
      step: 2,
      stepLabel: "Guided tour Step 2 — particelle + popup hotspot su The Black Witness",
      body: `Fuoco/fumo standalone è solo metà della storia. Nel [360° Panorama Tour](/demos/panorama-360/), **Step 2** è authorato come \`cam · +particles · hotspot+popup\`: la camera atterra su un beat rooftop, uno strato particelle vende calore/atmosfera, e un hotspot apre un popup così gli ospiti hanno storia + agency in una tappa.

Quella connessione è il vantaggio interattività — le particelle non sono wallpaper di sfondo; segnano un **momento in cui puoi fermarti, guardarti intorno e cliccare**. Lo stesso craft VFX esplorato qui diventa un beat guidato in un tour condivisibile. Vedi anche [Spout](/blog/spout) (Step 3) e [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).`,
    },
    faq: [
      {
        q: "È simulazione fluida reale?",
        a: "No — VFX sprite con motion authorato. Economico, controllabile, pitch-friendly.",
      },
      {
        q: "In cosa differisce da linked particles?",
        a: `Questi sono sprite fuoco/fumo. Linked particles enfatizzano scie puntatore e nastri vicini.`,
      },
      {
        q: "Dove compaiono queste particelle nel tour 360?",
        a: `Guided-tour Step 2 su The Black Witness — particelle con popup hotspot. Apri /demos/panorama-360/ e Play guided tour.`,
      },
    ],
    reading: [
      {
        label: "three.js — WebGPU particles",
        url: "https://threejs.org/examples/#webgpu_particles",
      },
      {
        label: "360° Panorama Tour Editor",
        url: "/demos/panorama-360/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "buffergeometry-drawrange": {
    pageTitle: "BufferGeometry Draw Range — reti particelle su WebGL",
    demoLabel: "BufferGeometry Draw Range",
    hook: `Una rete particelle vivente con linee di prossimità — \`BufferGeometry.setDrawRange()\` disegna solo punti e segmenti attivi. Three.js WebGL classico, ancora un workhorse per visual data-look.`,
    coverNote: "La cover mostra la nube particelle nodo-link con connessioni attive.",
    whyBullets: [
      "- **Estetica rete** — nodi e archi che sembrano dati",
      "- **Controllo draw range** — render solo ciò che vive questo frame",
      "- **Grafo regolabile** — count, distanza e connessioni max",
      "- **Ampia copertura device** — WebGL, non solo WebGPU",
    ],
    whyUses: "sfondi brand tech, metafore « sistema connesso » e embed WebGL leggeri.",
    beginner: `Punti fluttuano; quando due si avvicinano, appare una linea sottile — come persone che diventano rete. Il trucco è efficienza: il motore disegna solo punti e linee attivi invece di tutto sempre.`,
    glossary: [
      {
        term: "BufferGeometry",
        def: "dati mesh Three.js in buffer GPU",
      },
      {
        term: "Draw range",
        def: "limita quale fetta di buffer viene disegnata questo frame",
      },
      {
        term: "Proximity link",
        def: "linea quando particelle sono entro una distanza",
      },
      {
        term: "WebGL",
        def: "API 3D browser ampiamente supportata usata da questa demo",
      },
    ],
    trySteps: [
      "Apri la [demo BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)",
      "Orbita la nube particelle",
      `Alza o abbassa count particelle e distanza link nell'UI`,
      "Osserva linee apparire/scomparire quando i vicini cambiano",
    ],
    requirements: [
      "**Browser:** qualsiasi browser moderno con WebGL",
      "**GPU:** scala con count particelle e connessioni — abbassa su device deboli",
      "**Nota API:** percorso WebGL — utile quando WebGPU non disponibile",
    ],
    viewA: {
      caption: "Rete completa — particelle con segmenti prossimità",
    },
    viewB: {
      caption: "Grafo ravvicinato — link attivi draw-range chiaramente leggibili",
    },
    alsoCan: [
      "Mappare colori a categorie o forza segnale",
      "Usare come sfondo attenuato sotto copy UI",
      `Studiare [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)`,
    ],
    howWorks: `Particelle aggiornano in JS (o buffer GPU-friendly semplici); segmenti linea ricostruiti o ranged per coppie vicine; \`setDrawRange\` limita draw al sottoinsieme attivo. Upstream: [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Per stormi compute WebGPU e nastri link TSL, vedi esperimenti più recenti — stessa famiglia visiva, API diversa.`,
    faq: [
      {
        q: "Perché non WebGPU qui?",
        a: `WebGL vince ancora per copertura device massima. WebGPU quando serve compute o materiali TSL.`,
      },
      {
        q: "I link possono rappresentare dati reali?",
        a: "Sì — sostituire prossimità casuale con i tuoi archi grafo in build production.",
      },
    ],
    reading: [
      {
        label: "three.js — buffergeometry drawrange",
        url: "https://threejs.org/examples/#webgl_buffergeometry_drawrange",
      },
      {
        label: "Three.js BufferGeometry",
        url: "https://threejs.org/docs/#api/en/core/BufferGeometry",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
    ],
    related: [
      {
        label: "CSS3D Sprites",
        url: "/blog/css3d-sprites",
      },
      {
        label: "WebGPU TSL Linked Particles",
        url: "/blog/webgpu-tsl-linked-particles",
      },
    ],
  },
  "spline-editor": {
    pageTitle: "Catmull Spline Editor — percorsi da trascinare",
    demoLabel: "Catmull Spline Editor",
    hook: `Percorsi Catmull-Rom interattivi con gizmo transform — confronta uniform, centripetal e chordal, regola tensione, esporta array \`Vector3\` per rail camera e percorsi oggetti.`,
    coverNote: "La cover mostra la spline editabile con punti controllo e contrasto tipo curva.",
    whyBullets: [
      "- **Authorare percorsi visivamente** — niente liste coordinate digitate prima",
      "- **Confronto tipo curva** — uniform vs centripetal vs chordal in un posto",
      "- **Pronto export** — array Vector3 per rail, fly-through e modifier",
      "- **Affidabilità WebGL** — funziona dove WebGPU non è ancora disponibile",
    ],
    whyUses: "pianificazione percorsi camera, rail turntable prodotto e tool briefing motion.",
    beginner: `Una spline è una curva liscia guidata da pochi punti controllo — come un righello flessibile. Trascina i punti e il percorso si aggiorna. Filmmaker e giochi usano la stessa idea per movimenti camera; qui lo editi nel browser.`,
    glossary: [
      {
        term: "Catmull-Rom",
        def: "famiglia spline che interpola attraverso punti controllo",
      },
      {
        term: "Centripetal",
        def: "parametrizzazione che di solito evita meglio loop/cuspidi del uniform",
      },
      {
        term: "Tension",
        def: "quanto strettamente la curva piega verso i controlli",
      },
      {
        term: "Gizmo",
        def: "maniglia translate/rotate/scale on-screen per un punto",
      },
    ],
    trySteps: [
      "Apri la [demo Spline Editor](/demos/spline-editor/)",
      "Trascina punti controllo con il gizmo",
      "Passa uniform / centripetal / chordal e confronta la curvatura",
      `Esporta o copia dati Vector3 se l'UI lo offre — rail camera`,
    ],
    requirements: [
      "**Browser:** browser WebGL moderno (Chrome, Edge, Firefox, Safari)",
      "**Input:** mouse per drag gizmo; desktop più facile",
      "**API:** famiglia esempio Three.js WebGL — non WebGPU",
    ],
    viewA: {
      caption: "Percorso completo — punti controllo e curva Catmull-Rom liscia",
    },
    viewB: {
      caption: "Edit gizmo — riforma locale del rail",
    },
    alsoCan: [
      "Alimentare export in camere fly-through",
      "Abbinare al WebGPU curve modifier per type-on-path",
      `Usare upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor)`,
    ],
    howWorks: `Punti controllo definiscono una \`CatmullRomCurve3\`; l'editor visualizza polilinea/curva e permette trasformare punti. Tipo curva e tensione cambiano parametrizzazione. Upstream: [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([sorgente](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Esportare punti collega agli strumenti percorso IOM e al [WebGPU curve modifier](/demos/webgpu-modifier-curve/).`,
    faq: [
      {
        q: "Quale tipo curva scegliere?",
        a: `Centripetal è default sicuro contro cuspidi; confronta nell'UI per il tuo percorso.`,
      },
      {
        q: "Può guidare una camera reale su sito client?",
        a: "Sì — colleghiamo punti esportati a un controller camera production.",
      },
    ],
    reading: [
      {
        label: "three.js — spline editor",
        url: "https://threejs.org/examples/#webgl_geometry_spline_editor",
      },
      {
        label: "Catmull–Rom spline — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Curve Modifier",
        url: "/blog/webgpu-modifier-curve",
      },
      {
        label: "Terrain Sandbox",
        url: "/blog/terrain-sandbox",
      },
    ],
  },
  "terrain-sandbox": {
    pageTitle: "Terrain Sandbox — dipingere un mondo dal noise",
    demoLabel: "Terrain Sandbox",
    hook: `Noise a strati diventa colline da orbitare — pianta alberi, rocce e marker, rigenera seed, regola altezza e rugosità. Un MVP sandbox WebGL IOM verso brush, GLTF e dati DEM reali.`,
    coverNote: "La cover mostra una patch terreno seedata con props sparsi.",
    whyBullets: [
      "- **Paesaggio giocabile** — stakeholder capiscono mood sito velocemente",
      "- **Seed + manopole** — varianti riproducibili per art direction",
      "- **Props sulla superficie** — alberi/rocce/marker per storie di scala",
      "- **Roadmap-friendly** — MVP verso sculpt, GLTF, MapTiler DEM",
    ],
    whyUses: "pitch ambientali precoci, preview tipo gioco e tool workshop per talk layout.",
    beginner: `Il terreno non è ancora scolpito a mano — la matematica (noise) inventa colline. Cambi quanto sono alte e ruvide, pianti qualche oggetto perché la scala sembri reale, e giri come esplorando un sito.`,
    glossary: [
      {
        term: "Procedural terrain",
        def: "paesaggio generato da algoritmi invece di mesh scansionata",
      },
      {
        term: "Seed",
        def: "numero che rende riproducibile lo stesso paesaggio casuale",
      },
      {
        term: "DEM",
        def: "digital elevation model — dati altezza reali (percorso futuro)",
      },
      {
        term: "WebGL",
        def: "API 3D browser usata da questa sandbox",
      },
    ],
    trySteps: [
      "Apri la [demo Terrain Sandbox](/demos/terrain-sandbox/)",
      "Orbita il terreno; rigenera seed per nuova landform",
      "Regola altezza e rugosità",
      "Piazza alberi, rocce o marker e ricontrolla silhouette",
    ],
    requirements: [
      "**Browser:** browser WebGL moderno",
      `**GPU:** griglie più grandi costano di più — riduci risoluzione su device leggeri`,
      "**Rete:** non richiesta per terreno noise core (props locali alla demo)",
    ],
    viewA: {
      caption: "Landform ampia — colline noise con crinali leggibili",
    },
    viewB: {
      caption: "Pass props — alberi/rocce danno scala umana",
    },
    alsoCan: [
      "Salvare seed preferiti come riferimenti art direction",
      "Pianificare follow-up con brush sculpt o props GLTF",
      "Confrontare con tile reali in Procedural GL",
    ],
    howWorks: `Campioni noise a strati costruiscono heightmap; mesh displaced e ombreggiata; props raycast o height-sample sulla superficie. Stack Three.js su **WebGL** per supporto ampio. MVP sandbox IOM — non esempio stock three.js — con percorso verso brush, import asset e MapTiler DEM opzionale per siti reali.`,
    faq: [
      {
        q: "È geografia reale?",
        a: `Non ancora — noise procedurale. DEM / MapTiler reali in roadmap per lavoro site-true.`,
      },
      {
        q: "WebGL o WebGPU?",
        a: "WebGL per questa sandbox così più device aprono il link.",
      },
    ],
    reading: [
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "MapTiler",
        url: "https://www.maptiler.com/",
      },
      {
        label: "Procedural noise (intro)",
        url: `https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js`,
      },
    ],
    related: [
      {
        label: "Procedural GL Terrain",
        url: "/blog/procedural-gl",
      },
      {
        label: "WebGPU TSL Raging Sea",
        url: "/blog/webgpu-tsl-raging-sea",
      },
    ],
  },
  "procedural-gl": {
    pageTitle: "Procedural GL Terrain — tile mondo reale in 3D",
    demoLabel: "Procedural GL Terrain",
    hook: `Paesaggi reali streamati come terreno GPU LOD — la nostra pagina embedda la [procedural.eu](https://www.procedural.eu/map/) map ufficiale powered by procedural-gl.js (MPL-2.0). Primo passo: demo upstream live; build MapTiler self-hosted può seguire.`,
    coverNote: `La cover è uno still live dall'embed procedural.eu — tile elevazione/immagini MapTiler reali in 3D, non sandbox noise.`,
    whyBullets: [
      "- **Luoghi reali** — elevazione da tile map, non solo noise",
      "- **GPU LOD** — dettaglio dove guardi, mesh più leggere lontano",
      "- **Core open-source** — procedural-gl.js sotto MPL-2.0",
      "- **Ponte verso production** — embed ora; self-host dopo con la tua key",
    ],
    whyUses: "contesto sito architettura, pitch location e geo storytelling web.",
    beginner: `Invece di inventare colline, questo viewer carica tile terreno reali così puoi sorvolare geografia effettiva in 3D — più vicino a una Earth view leggera che a un livello gioco fatto di noise.`,
    glossary: [
      {
        term: "LOD",
        def: "level of detail — più dettaglio mesh vicino camera",
      },
      {
        term: "Map tiles",
        def: "pezzi immagine/elevazione streamati per vista corrente",
      },
      {
        term: "procedural-gl.js",
        def: "libreria open-source terreno GPU da dati map",
      },
      {
        term: "MapTiler",
        def: "provider tile spesso usato per key production (fuori repo)",
      },
    ],
    trySteps: [
      "Apri la [demo Procedural GL](/demos/procedural-gl/)",
      `Attendi caricamento della [procedural.eu map](https://www.procedural.eu/map/) embed`,
      "Pan e zoom su terreno reale",
      "Immagina posizionare edificio client o percorso su un crinale noto",
    ],
    requirements: [
      "**Rete:** richiesta — tile e embed procedural.eu necessitano connettività",
      "**Browser:** Chromium moderno consigliato per terreno WebGL",
      "**Key:** key MapTiler production restano server-side / env — mai committate",
    ],
    viewA: {
      caption: "Vista regionale — terreno LOD da tile streamate",
    },
    viewB: {
      caption: "Rilievo ravvicinato — crinali e valli leggibili in 3D",
    },
    alsoCan: [
      "Usare come contesto accanto a GLB geolocalizzato",
      "Pianificare fork MapTiler self-hosted",
      "Leggere docs su [procedural.eu](https://www.procedural.eu/)",
    ],
    howWorks: `La nostra pagina \`/demos/procedural-gl/\` embedda l'esperienza map ufficiale su [procedural.eu/map](https://www.procedural.eu/map/). Sotto il cofano, [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) costruisce mesh GPU LOD da tile elevazione/immagini (WebGL). Prossimo passo IOM: build self-hosted con MapTiler — API key fuori git repo. Terreno geografico, complementare al noise procedurale [Terrain Sandbox](/demos/terrain-sandbox/).`,
    faq: [
      {
        q: "La map è hostata da IOM?",
        a: `Questo primo passo embedda procedural.eu. Variante self-hosted = task production separato.`,
      },
      {
        q: "WebGL o WebGPU?",
        a: `Streaming terreno WebGL via procedural-gl.js — scelto per stack libreria ed ecosistema tile.`,
      },
    ],
    reading: [
      {
        label: "procedural.eu map",
        url: "https://www.procedural.eu/map/",
      },
      {
        label: "procedural.eu docs",
        url: "https://www.procedural.eu/",
      },
      {
        label: "procedural-gl-js on GitHub",
        url: "https://github.com/felixpalmer/procedural-gl-js",
      },
    ],
    related: [
      {
        label: "Terrain Sandbox",
        url: "/blog/terrain-sandbox",
      },
      {
        label: "Streets GL Bridge",
        url: "/blog/streets-gl-bridge",
      },
    ],
  },
  spout: {
    pageTitle: "Spout — acqua a tubo raymarched",
    demoLabel: "Spout",
    hook: `Un tubo cromato che versa acqua raymarched — rifrazione, trasparenza e riflessi in un port WebGL2 self-hosted del classico Shadertoy di P_Malin. Trascina per orbitare la scultura fluida — poi lo stesso beat acqua integrato nel nostro [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).`,
    coverNote: `La cover mostra il beccuccio con acqua rifrattiva che cattura l'ambiente. Lo stesso linguaggio effetto appare come Step 3 (\`+particles/spout\`) in https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      "- **Pedigree Shadertoy** — pezzo studio noto, ora su iobjectm.com",
      `- **Acqua raymarched** — niente mesh splash particelle; distance fields fanno il lavoro`,
      `- **Rifrazione & riflessione** — linguaggio materiale che i clienti riconoscono dalle ads`,
      "- **Port WebGL2** — ampia reach real-time senza WebGPU",
      `- **Integrato nei tour 360°** — Step 3 su [Panorama 360](https://iobjectm.com/demos/panorama-360/) abbina spout/acqua e popup hotspot`,
    ],
    whyUses: `demo craft shader, moodboard branding liquido, insegnare look-dev raymarching e beat acqua in tour guidati 360° interattivi.`,
    beginner: `L'acqua non è uno splash filmato. La GPU avanza raggi attraverso una forma matematica finché colpisce « acqua » o « metallo », poi curva la vista come una lente. Ecco perché tubo e fluido sembrano così puliti da ogni angolo. Nel nostro [tour 360°](https://iobjectm.com/demos/panorama-360/), lo stesso linguaggio liquido diventa una tappa guidata che gli ospiti possono guardare intorno e cliccare.`,
    glossary: [
      {
        term: "Raymarching",
        def: "passi lungo un raggio attraverso un distance field fino a trovare una superficie",
      },
      {
        term: "SDF",
        def: "signed distance function — matematica che descrive forme per raymarcher",
      },
      {
        term: "Refraction",
        def: "curvatura della vista attraverso acqua trasparente",
      },
      {
        term: "Shadertoy",
        def: "playground online shader pixel/raymarch (originale di P_Malin)",
      },
      {
        term: "Guided tour Step 3",
        def: "su /demos/panorama-360/ — cam · +particles/spout · hotspot+popup",
      },
    ],
    trySteps: [
      "Apri la [demo Spout](/demos/spout/)",
      "Trascina per orbitare tubo e acqua",
      "Osserva la rifrazione spostare lo sfondo attraverso il fluido",
      `Apri [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, e guarda Step 3 (spout / acqua + hotspot)`,
      `Confronta con la [vista Shadertoy](https://www.shadertoy.com/view/lsXGzH) originale`,
    ],
    requirements: [
      "**Browser:** Chrome, Edge, Firefox o Safari compatibile WebGL2",
      "**GPU:** costo raymarch da leggero a moderato — riduci risoluzione se serve",
      "**API:** port shader WebGL2 — non compute WebGPU",
    ],
    viewA: {
      caption: "Spout hero — metallo tubo e colonna acqua rifrattiva",
    },
    viewB: {
      caption: "Dettaglio orbit — riflessi e trasparenza nel fluido",
    },
    alsoCan: [
      "Retunare palette per metalli brand e tinta fluido",
      "Usare still come riferimenti look-dev liquidi prodotto",
      `Inserire il beat acqua in una tappa [tour guidato 360°](/demos/panorama-360/) (Step 3)`,
      `Creditare e studiare lo [Shadertoy](https://www.shadertoy.com/view/lsXGzH) di P_Malin`,
    ],
    howWorks: `Un fragment shader WebGL2 fullscreen (o legato a mesh) raymarched SDF per tubo e acqua, applicando rifrazione, trasparenza e riflessi. IOM ospita un port dell'esperimento Shadertoy [lsXGzH](https://www.shadertoy.com/view/lsXGzH) di P_Malin sotto \`/demos/spout/\`. È shader art classica su **WebGL2**, complementare alle demo scena Three.js e distinta dall'acqua WebGPU TSL.`,
    tourBridge: {
      step: 3,
      stepLabel: `Guided tour Step 3 — spout / particelle acqua + popup hotspot su The Black Witness`,
      body: `Spout non è solo un esperimento standalone. Su [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/), **Step 3** del tour guidato The Black Witness è authorato come \`cam · +particles/spout · hotspot+popup\`: la camera atterra sul beat acqua rooftop, lo strato spout/acqua vende movimento liquido sul posto, e un popup hotspot mantiene la narrativa interattiva.

Questo è il vantaggio interattività — gli ospiti non guardano solo rifrazione; arrivano a una **tappa temporizzata**, possono ancora guardarsi intorno e cliccare l'hotspot per significato. Apri l'editor o [anteprima visitatore](https://iobjectm.com/demos/panorama-360/?mode=preview), premi **Play guided tour**, e vai a Step 3. Abbina con [WebGPU Particles](/blog/webgpu-particles) (Step 2) e [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) per lo stack effetti completo.`,
    },
    faq: [
      {
        q: `L'acqua è simulata con fisica?`,
        a: "No — geometria/animazione shader raymarched, non sim particelle fluido.",
      },
      {
        q: "Può girare in una scena prodotto Three.js?",
        a: `Spesso come screen pass o effetto localizzato — integrazione scoped per progetto. Il tour panorama su https://iobjectm.com/demos/panorama-360/ è un esempio production.`,
      },
      {
        q: "Dove compare Spout nel tour 360?",
        a: `Guided-tour Step 3 su The Black Witness — spout/acqua con popup hotspot. Apri https://iobjectm.com/demos/panorama-360/ e Play guided tour.`,
      },
    ],
    reading: [
      {
        label: "Panorama 360 (live)",
        url: "https://iobjectm.com/demos/panorama-360/",
      },
      {
        label: "Panorama 360 — visitor preview",
        url: "https://iobjectm.com/demos/panorama-360/?mode=preview",
      },
      {
        label: "Shadertoy — Spout (P_Malin)",
        url: "https://www.shadertoy.com/view/lsXGzH",
      },
      {
        label: "Ray marching — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Ray_marching",
      },
      {
        label: "WebGL2 — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "The Black Witness — 360° Tour",
        url: "/blog/panorama-suite",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
}
